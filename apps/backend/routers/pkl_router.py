"""
PKL 文件上传与解析路由
处理文件上传、校验、数据提取
"""

import tempfile
import os

import joblib
import cv2
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

from services.validator import validate_pkl_data
from services.extractor import extract_track_data

router = APIRouter()


def get_video_frame_count(video_path: str) -> int:
    """获取视频文件总帧数"""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return -1
    count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.release()
    return count


@router.post("/parse-pkl")
async def parse_pkl(
    pkl_file: UploadFile = File(..., description="MANO PKL 文件"),
    mp4_file: UploadFile = File(..., description="源视频 MP4 文件"),
):
    """
    解析上传的 PKL 文件
    执行 V1-V15 校验后返回前端所需数据

    :param pkl_file: PKL 文件
    :param mp4_file: MP4 文件（当前仅做存在性校验）
    :return: 解析后的 MANO 数据 JSON
    """
    # V1: PKL 文件必须存在
    if not pkl_file or not pkl_file.filename:
        raise HTTPException(status_code=400, detail="PKL file is required.")

    # V2: MP4 文件必须存在
    if not mp4_file or not mp4_file.filename:
        raise HTTPException(status_code=400, detail="MP4 file is required.")

    # 读取 PKL 文件到临时目录
    tmp_path = None
    try:
        pkl_content = await pkl_file.read()

        # 写入临时文件供 joblib 加载
        with tempfile.NamedTemporaryFile(suffix=".pkl", delete=False) as tmp:
            tmp.write(pkl_content)
            tmp_path = tmp.name

        # V3: 加载 PKL 文件
        try:
            data = joblib.load(tmp_path)
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to load PKL file: {pkl_file.filename}. {str(e)}",
            )

        # V5-V15: 数据格式校验
        validation = validate_pkl_data(data)
        if not validation["success"]:
            raise HTTPException(status_code=400, detail=validation["error"])

        # 提取前端所需数据
        result = extract_track_data(data)
        return result

    finally:
        # 清理临时文件
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


OUTPUTS_DIR = "/app/data/outputs"

@router.get("/projects")
async def list_projects(path: str = ""):
    """按需获取服务器上的项目层级（非递归）"""
    # 路径安全校验：防止路径穿越
    if path:
        # 去掉开头的斜杠
        safe_path = path.lstrip('/')
        target_dir = os.path.abspath(os.path.join(OUTPUTS_DIR, safe_path))
    else:
        target_dir = os.path.abspath(OUTPUTS_DIR)

    if not target_dir.startswith(os.path.abspath(OUTPUTS_DIR)) or not os.path.exists(target_dir):
        return {"projects": []}
    
    tree = []
    try:
        items = sorted(os.listdir(target_dir))
        # 找出当前目录下所有的 pkl 和 mp4
        pkls = {f[:-4]: f for f in items if f.endswith('.pkl')}
        mp4s = [f for f in items if f.endswith('.mp4')]
        processed_pkls = set()

        for item in items:
            if item.startswith('.'): continue
            full_item_path = os.path.join(target_dir, item)
            # 计算相对于 OUTPUTS_DIR 的路径
            item_rel_path = os.path.relpath(full_item_path, OUTPUTS_DIR)
            
            if os.path.isdir(full_item_path):
                tree.append({
                    "id": item_rel_path,
                    "name": item,
                    "type": "directory",
                    "children": [] # 初始为空，由前端按需加载
                })
            
            elif item.endswith('.pkl'):
                base_name = item[:-4]
                if base_name in processed_pkls: continue
                
                # 匹配逻辑
                matching_mp4 = next((f for f in mp4s if base_name in f), None)
                if not matching_mp4 and len(mp4s) == 1:
                    matching_mp4 = mp4s[0]
                
                if matching_mp4:
                    tree.append({
                        "id": item_rel_path,
                        "name": base_name,
                        "type": "file",
                        "pkl_path": item_rel_path,
                        "mp4_path": os.path.join(os.path.dirname(item_rel_path), matching_mp4) if os.path.dirname(item_rel_path) else matching_mp4
                    })
                    processed_pkls.add(base_name)
    except Exception as e:
        print(f"Error scanning {target_dir}: {e}")
        
    return {"projects": tree}


from pydantic import BaseModel

class ParseServerPklRequest(BaseModel):
    pkl_path: str
    mp4_path: str

@router.post("/parse-server-pkl")
async def parse_server_pkl(req: ParseServerPklRequest):
    """解析服务器上的 PKL 文件并验证帧数"""
    full_pkl_path = os.path.join(OUTPUTS_DIR, req.pkl_path)
    full_mp4_path = os.path.join(OUTPUTS_DIR, req.mp4_path)
    
    # 防止路径穿越安全漏洞
    if not os.path.normpath(full_pkl_path).startswith(OUTPUTS_DIR) or \
       not os.path.normpath(full_mp4_path).startswith(OUTPUTS_DIR):
        raise HTTPException(status_code=403, detail="Invalid path")
        
    if not os.path.exists(full_pkl_path):
        raise HTTPException(status_code=404, detail="PKL file not found")
    if not os.path.exists(full_mp4_path):
        raise HTTPException(status_code=404, detail="MP4 file not found")

    try:
        data = joblib.load(full_pkl_path)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to load PKL file: {req.pkl_path}. {str(e)}",
        )

    # V5-V15: 数据格式校验
    validation = validate_pkl_data(data)
    if not validation["success"]:
        raise HTTPException(status_code=400, detail=validation["error"])

    # 提取前端所需数据
    result = extract_track_data(data)
    pkl_frames = result.get("total_frames", 0)

    # 验证视频帧数
    video_frames = get_video_frame_count(full_mp4_path)
    if video_frames > 0 and abs(pkl_frames - video_frames) > 2: # 允许 2 帧以内误差（考虑到有些视频导出的索引差异）
        raise HTTPException(
            status_code=400, 
            detail=f"数据帧数不匹配! PKL 数据为 {pkl_frames} 帧，而视频为 {video_frames} 帧。这可能不是同一个序列。"
        )

    return result

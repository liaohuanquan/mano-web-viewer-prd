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
    解析上传的 PKL 文件并验证帧数
    """
    if not pkl_file or not pkl_file.filename:
        raise HTTPException(status_code=400, detail="PKL file is required.")
    if not mp4_file or not mp4_file.filename:
        raise HTTPException(status_code=400, detail="MP4 file is required.")

    tmp_pkl = None
    tmp_mp4 = None
    try:
        # 保存 PKL 到临时文件
        pkl_content = await pkl_file.read()
        with tempfile.NamedTemporaryFile(suffix=".pkl", delete=False) as tmp:
            tmp.write(pkl_content)
            tmp_pkl = tmp.name

        # 保存 MP4 到临时文件以便 OpenCV 读取帧数
        mp4_content = await mp4_file.read()
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            tmp.write(mp4_content)
            tmp_mp4 = tmp.name

        # 加载 PKL
        try:
            data = joblib.load(tmp_pkl)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"PKL 加载失败: {str(e)}")

        # 格式校验
        validation = validate_pkl_data(data)
        if not validation["success"]:
            raise HTTPException(status_code=400, detail=validation["error"])

        # 提取数据
        result = extract_track_data(data)
        pkl_frames = result.get("total_frames", 0)

        # 校验帧数
        video_frames = get_video_frame_count(tmp_mp4)
        if video_frames > 0 and abs(pkl_frames - video_frames) > 2:
            raise HTTPException(
                status_code=400, 
                detail=f"帧数不匹配! PKL 为 {pkl_frames} 帧，视频为 {video_frames} 帧。请检查文件是否匹配。"
            )

        return result

    finally:
        if tmp_pkl and os.path.exists(tmp_pkl): os.unlink(tmp_pkl)
        if tmp_mp4 and os.path.exists(tmp_mp4): os.unlink(tmp_mp4)


OUTPUTS_DIR = os.getenv("SERVER_DATA_ROOT", "/home/ubuntu/Synadata_dev/")

import time

# 内存搜索缓存：key 为 query, value 为 (timestamp, results)
# 针对 1.73TB 内存，我们可以缓存非常大量的结果
SEARCH_CACHE = {}
CACHE_TTL = 300  # 缓存有效期 5 分钟

@router.get("/projects")
async def list_projects(path: str = "", query: str = ""):
    """列出服务器上的项目或进行全局搜索"""
    
    # 检查缓存
    if query:
        query_lower = query.lower()
        if query_lower in SEARCH_CACHE:
            ts, results = SEARCH_CACHE[query_lower]
            if time.time() - ts < CACHE_TTL:
                return {"projects": results}
        
    # 如果有查询语句，执行全局模糊搜索
    if query:
        res = await search_projects_globally(query)
        # 更新缓存
        SEARCH_CACHE[query.lower()] = (time.time(), res["projects"])
        return res
        
    # 否则执行原有的按需加载逻辑
    if (path):
        safe_path = path.lstrip('/')
        target_dir = os.path.abspath(os.path.join(OUTPUTS_DIR, safe_path))
    else:
        target_dir = os.path.abspath(OUTPUTS_DIR)
    
    print(f"[pkl_router] Scanning target_dir: {target_dir} (OUTPUTS_DIR: {OUTPUTS_DIR})")

    if not target_dir.startswith(os.path.abspath(OUTPUTS_DIR)) or not os.path.exists(target_dir):
        return {"projects": []}
    
    tree = []
    try:
        items = sorted(os.listdir(target_dir))
        # 先识别文件夹和 CSV
        for item in items:
            if item.startswith('.'): continue
            full_item_path = os.path.join(target_dir, item)
            item_rel_path = os.path.relpath(full_item_path, OUTPUTS_DIR)
            
            if os.path.isdir(full_item_path):
                tree.append({
                    "id": item_rel_path,
                    "name": item,
                    "type": "directory",
                    "isLoaded": False
                })
            elif item.endswith('.csv'):
                tree.append({
                    "id": item_rel_path,
                    "name": item,
                    "type": "csv",
                    "csv_path": item_rel_path
                })
        
        # 再识别 PKL + MP4 项目对
        pkls = {f[:-4]: f for f in items if f.endswith('.pkl')}
        mp4s = [f for f in items if f.endswith('.mp4')]
        for base_name, pkl_file in pkls.items():
            matching_mp4 = next((f for f in mp4s if base_name in f), None)
            if not matching_mp4 and len(mp4s) == 1:
                matching_mp4 = mp4s[0]
            
            if matching_mp4:
                pkl_rel_path = os.path.relpath(os.path.join(target_dir, pkl_file), OUTPUTS_DIR)
                tree.append({
                    "id": pkl_rel_path,
                    "name": base_name,
                    "type": "file",
                    "pkl_path": pkl_rel_path,
                    "mp4_path": os.path.relpath(os.path.join(target_dir, matching_mp4), OUTPUTS_DIR)
                })
    except Exception as e:
        print(f"Error scanning {target_dir}: {e}")
    return {"projects": tree}

@router.get("/parse-csv")
async def parse_csv(csv_path: str):
    """解析选中的 CSV 文件并返回记录列表"""
    full_path = os.path.join(OUTPUTS_DIR, csv_path.lstrip('/'))
    if not os.path.exists(full_path) or not csv_path.endswith('.csv'):
        return {"error": "CSV file not found", "records": []}
    
    import csv
    records = []
    try:
        with open(full_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader):
                pkl = row.get('pkl_path')
                # 兼容多种可能的视频路径列名
                mp4 = row.get('source_path') or row.get('mp4_path') or row.get('video_path')
                
                if pkl and mp4:
                    records.append({
                        "id": f"{csv_path}#{i}",
                        "name": row.get('seq_name') or f"Record {i+1}",
                        "pkl_path": pkl,
                        "mp4_path": mp4,
                        "frame_count": row.get('frame_count', 'N/A'),
                        "track_count": row.get('track_count', 'N/A')
                    })
    except Exception as e:
        return {"error": f"Failed to parse CSV: {str(e)}", "records": []}
        
    return {"records": records}

async def search_projects_globally(query: str):
    """在服务器 outputs 目录下执行全局模糊搜索"""
    results = []
    query = query.lower()
    count = 0
    # 限制搜索最大深度和结果数量以保证性能
    for root, dirs, files in os.walk(OUTPUTS_DIR):
        if count > 200: break # 服务器性能较好，限制可适当放宽
        
        # 搜索 CSV
        csvs = [f for f in files if f.endswith('.csv') and query in f.lower()]
        for csv_file in csvs:
            rel_root = os.path.relpath(root, OUTPUTS_DIR)
            csv_rel_path = os.path.join(rel_root, csv_file) if rel_root != "." else csv_file
            results.append({
                "id": csv_rel_path,
                "name": csv_file,
                "type": "csv",
                "csv_path": csv_rel_path
            })
            count += 1

        # 搜索项目对
        pkls = [f for f in files if f.endswith('.pkl') and query in f.lower()]
        mp4s = [f for f in files if f.endswith('.mp4')]
        
        for pkl in pkls:
            base_name = pkl[:-4]
            matching_mp4 = next((f for f in mp4s if base_name in f), None)
            if not matching_mp4 and len(mp4s) == 1:
                matching_mp4 = mp4s[0]
            
            if matching_mp4:
                rel_root = os.path.relpath(root, OUTPUTS_DIR)
                pkl_rel_path = os.path.join(rel_root, pkl) if rel_root != "." else pkl
                mp4_rel_path = os.path.join(rel_root, matching_mp4) if rel_root != "." else matching_mp4
                
                results.append({
                    "id": pkl_rel_path,
                    "name": f"{rel_root}/{base_name}", # 显示路径以防重名
                    "type": "file",
                    "pkl_path": pkl_rel_path,
                    "mp4_path": mp4_rel_path
                })
                count += 1
    return {"projects": results}


class ParseServerPklRequest(BaseModel):
    pkl_path: str
    mp4_path: str

@router.post("/parse-server-pkl")
async def parse_server_pkl(req: ParseServerPklRequest):
    """解析服务器上的 PKL 文件并验证帧数"""
    # 统一转换路径，确保绝对路径和相对路径都能被正确处理
    full_pkl_path = req.pkl_path if os.path.isabs(req.pkl_path) else os.path.join(OUTPUTS_DIR, req.pkl_path.lstrip('/'))
    full_mp4_path = req.mp4_path if os.path.isabs(req.mp4_path) else os.path.join(OUTPUTS_DIR, req.mp4_path.lstrip('/'))
    
    norm_out_dir = os.path.normpath(OUTPUTS_DIR)
    if not os.path.normpath(full_pkl_path).startswith(norm_out_dir) or \
       not os.path.normpath(full_mp4_path).startswith(norm_out_dir):
        raise HTTPException(status_code=403, detail="Invalid path")
        
    if not os.path.exists(full_pkl_path):
        raise HTTPException(status_code=404, detail="PKL file not found")
    if not os.path.exists(full_mp4_path):
        raise HTTPException(status_code=404, detail="MP4 file not found")

    try:
        data = joblib.load(full_pkl_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PKL 加载失败: {str(e)}")

    validation = validate_pkl_data(data)
    if not validation["success"]:
        raise HTTPException(status_code=400, detail=validation["error"])

    result = extract_track_data(data)
    pkl_frames = result.get("total_frames", 0)

    video_frames = get_video_frame_count(full_mp4_path)
    if video_frames > 0 and abs(pkl_frames - video_frames) > 2:
        raise HTTPException(
            status_code=400, 
            detail=f"数据帧数不匹配! PKL 为 {pkl_frames} 帧，而视频为 {video_frames} 帧。这可能不是同一个序列。"
        )

    rel_mp4 = os.path.relpath(full_mp4_path, OUTPUTS_DIR)

    return {
        "seq_name": data.get("seq_name", "Unknown"),
        "total_frames": pkl_frames,
        "tracks": result.get("tracks", []),
        "faces": result.get("faces", []),
        "intrinsics_pnp": result.get("intrinsics_pnp"),
        "file_info": result.get("file_info"),
        "relative_mp4_path": rel_mp4
    }

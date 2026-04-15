"""
PKL 文件上传与解析路由
处理文件上传、校验、数据提取
"""

import tempfile
import os

import joblib
from fastapi import APIRouter, UploadFile, File, HTTPException

from services.validator import validate_pkl_data
from services.extractor import extract_track_data

router = APIRouter()


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

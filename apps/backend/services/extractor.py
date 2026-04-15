"""
PKL 数据提取服务
将 PKL 中的 MANO 参数转换为前端可用的 JSON 格式
当前阶段直接返回参数数据，后续集成 MANO mesh 重建后返回顶点数据
"""

import numpy as np
from typing import Any


def extract_track_data(data: dict) -> dict:
    """
    从校验通过的 PKL 数据中提取前端所需信息

    :param data: 校验通过的 PKL dict
    :return: 前端可用的 JSON 格式数据
    """
    frame_names = data["frame_names"]
    T = len(frame_names)
    tracks_raw = data["tracks"]

    tracks_out = []
    for track_id in sorted(tracks_raw.keys()):
        track = tracks_raw[track_id]

        cam_trans = np.asarray(track["cam_trans"], dtype=np.float32)
        is_right = np.asarray(track["is_right"], dtype=np.int64)

        tracks_out.append({
            "track_id": int(track_id),
            "cam_trans": cam_trans.tolist(),
            "is_right": is_right.tolist(),
            # 后续阶段添加 verts（需要 MANO 模型重建）
            # "verts": verts.tolist(),
        })

    result = {
        "seq_name": str(data.get("seq_name", "")),
        "frame_names": list(frame_names) if isinstance(frame_names, (list,)) else [str(f) for f in frame_names],
        "total_frames": T,
        "tracks": tracks_out,
    }

    return result

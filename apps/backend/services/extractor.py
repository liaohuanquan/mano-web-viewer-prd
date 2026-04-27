"""
PKL 数据提取服务
将 PKL 中的 MANO 参数转换为前端可用的 JSON 格式
当前阶段直接返回参数数据，后续集成 MANO mesh 重建后返回顶点数据
"""

import numpy as np
from typing import Any
from .mano_builder import mano_builder

def extract_track_data(data: dict) -> dict:
    """
    从校验通过的 PKL 数据中提取前端所需信息，并利用 smplx 重建 MANO 顶点
    """
    frame_names = data["frame_names"]
    T = len(frame_names)
    tracks_raw = data["tracks"]

    tracks_out = []
    
    for track_id in sorted(tracks_raw.keys()):
        track = tracks_raw[track_id]

        cam_trans = np.asarray(track["cam_trans"], dtype=np.float32)
        is_right = np.asarray(track["is_right"], dtype=np.int64)
        body_pose = np.asarray(track["body_pose"], dtype=np.float32)
        betas = np.asarray(track["betas"], dtype=np.float32)
        global_orient = np.asarray(track["global_orient"], dtype=np.float32)
        
        # 初始化顶点数组 [T, 778, 3] 和关节点数组 [T, 16, 3]
        verts = np.zeros((T, 778, 3), dtype=np.float32)
        joints = np.zeros((T, 16, 3), dtype=np.float32)
        
        # 如果模型就绪，则进行重建
        if mano_builder.is_ready:
            for t in range(T):
                # 如果这个 frame 根本没有手（比如全零或者被过滤了） 这里可以用 cam_trans 来简单过滤
                if np.sum(np.abs(cam_trans[t])) == 0:
                    continue
                result = mano_builder.build_verts(
                    is_right=(is_right[t] == 1),
                    body_pose=body_pose[t],
                    betas=betas[t],
                    global_orient=global_orient[t]
                )
                if result is not None:
                    verts[t], joints[t] = result
        
        tracks_out.append({
            "track_id": int(track_id),
            "cam_trans": cam_trans.tolist(),
            "is_right": is_right.tolist(),
            "verts": verts.tolist(),
            "joints": joints.tolist(),
        })

    result = {
        "seq_name": str(data.get("seq_name", "")),
        "frame_names": list(frame_names) if isinstance(frame_names, (list,)) else [str(f) for f in frame_names],
        "total_frames": T,
        "tracks": tracks_out,
        "faces": mano_builder.faces.tolist() if mano_builder.is_ready else [],
    }

    return result

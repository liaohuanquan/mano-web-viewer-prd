"""
PKL 校验服务
实现 PRD V1-V20 校验规则
"""

import numpy as np
from typing import Any


def validate_pkl_data(data: Any) -> dict:
    """
    校验 PKL 解析后的数据是否符合 MANO 格式规范
    按 PRD V5-V15 顺序执行校验，首个错误即返回

    :param data: joblib.load 加载的 PKL 数据
    :return: 校验结果 dict，包含 success 和 error 字段
    """

    # V5: 顶层缺少必须字段
    required_top_keys = ["seq_name", "frame_names", "tracks"]
    for key in required_top_keys:
        if key not in data:
            return {
                "success": False,
                "error": f"Invalid PKL schema: missing required top-level key {key}.",
            }

    frame_names = data["frame_names"]
    tracks = data["tracks"]

    # V6: frame_names 不是非空数组
    if not isinstance(frame_names, (list, np.ndarray)) or len(frame_names) == 0:
        return {
            "success": False,
            "error": "Invalid PKL schema: frame_names must be a non-empty list.",
        }

    T = len(frame_names)

    # V7: tracks 不是非空字典
    if not isinstance(tracks, dict) or len(tracks) == 0:
        return {
            "success": False,
            "error": "Invalid PKL schema: tracks must be a non-empty dictionary.",
        }

    # V8: track 数量校验
    track_count = len(tracks)
    if track_count not in (1, 2):
        return {
            "success": False,
            "error": f"Invalid track count: expected 1 or 2 tracks, got {track_count}.",
        }

    # 逐 track 校验
    for track_id, track in tracks.items():
        # V9: track 缺少必须字段
        required_track_keys = ["body_pose", "global_orient", "cam_trans", "betas", "is_right", "vis_mask"]
        for key in required_track_keys:
            if key not in track:
                return {
                    "success": False,
                    "error": f"Invalid track schema for track {track_id}: missing required key {key}.",
                }

        body_pose = np.asarray(track["body_pose"])
        global_orient = np.asarray(track["global_orient"])
        cam_trans = np.asarray(track["cam_trans"])
        betas = np.asarray(track["betas"])
        is_right = np.asarray(track["is_right"])

        # V11: body_pose shape
        if body_pose.shape != (T, 15, 3):
            return {
                "success": False,
                "error": f"Invalid body_pose shape for track {track_id}: expected ({T}, 15, 3), got {body_pose.shape}.",
            }

        # V12: global_orient shape
        if global_orient.shape != (T, 3):
            return {
                "success": False,
                "error": f"Invalid global_orient shape for track {track_id}: expected ({T}, 3), got {global_orient.shape}.",
            }

        # V13: cam_trans shape
        if cam_trans.shape != (T, 3):
            return {
                "success": False,
                "error": f"Invalid cam_trans shape for track {track_id}: expected ({T}, 3), got {cam_trans.shape}.",
            }

        # V14: betas shape
        if betas.shape != (T, 10):
            return {
                "success": False,
                "error": f"Invalid betas shape for track {track_id}: expected ({T}, 10), got {betas.shape}.",
            }

        # V15: is_right shape
        if is_right.shape != (T,):
            return {
                "success": False,
                "error": f"Invalid is_right shape for track {track_id}: expected ({T},), got {is_right.shape}.",
            }

        # V16: vis_mask shape
        vis_mask = np.asarray(track["vis_mask"])
        if vis_mask.shape != (T,):
            return {
                "success": False,
                "error": f"Invalid vis_mask shape for track {track_id}: expected ({T},), got {vis_mask.shape}.",
            }

        # V17: joints2d shape (可选字段)
        if "joints2d" in track:
            joints2d = np.asarray(track["joints2d"])
            if joints2d.shape != (T, 21, 3):
                return {
                    "success": False,
                    "error": f"Invalid joints2d shape for track {track_id}: expected ({T}, 21, 3), got {joints2d.shape}.",
                }

    return {"success": True}


pkl_version: 2.0.0
file_info: {'timeline_kind': 'source', 'source_duration_sec': 2.435766666666667, 'source_fps': 29.97002997002997, 'source_frame_count': 73, 'frame_count': 73, 'pkl_fps': 29.97002997002997, 'pkl_frame_count': 73, 'source_frame_indices': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72]}
intrinsics_pnp: [871.637939453125, 871.9930419921875, 961.8453979492188, 545.5794067382812]
joints2d_source: mano_reproject
joints2d_undistorted: False

--- track 0 ---
  is_right[0]: 0
  vis_mask sum: 73 / 73
  vis_mask dtype: bool
  cam_trans[0]: [-0.00277226 -0.0398911   0.48639816]
  cam_trans[1]: [ 0.00746849 -0.03098385  0.4490061 ]

---
track 1 ---
  is_right[0]: 1
  vis_mask sum: 73 / 73
  vis_mask dtype: bool
  cam_trans[0]: [ 0.0493581  -0.07130706  0.43945417]
  cam_trans[1]: [ 0.04905058 -0.0669331   0.42205524]
---

1. **新增顶层字段** ：`pkl_version`, `file_info`, `intrinsics_pnp`, `joints2d_source`, `joints2d_undistorted`
2. **新增 track 字段** ：`vis_mask` (bool数组), `joints2d` (T,21,3)
3. **世界坐标系固定** — 不再需要 `computeOriginOffset` 做手动偏移，相机在原点
4. **`file_info`** 包含 fps、时长等元信息

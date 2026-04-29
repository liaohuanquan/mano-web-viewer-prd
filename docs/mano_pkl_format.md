# MANO Pickle Format — `update_mano_pkl` Output

> **Scope**: documents the pkl written by
> `synaego.standalone_pnp.update_mano_pkl` (the "PnP pkl").  
> This format is produced from two possible input types:  
> 1. A **standard** `{seq}_mano.pkl` (Dyn-HaMR / HaMeR pipeline output)  
> 2. A **raw HaMeR pkl** keyed by image paths (auto-converted; see §4)

---

## 1. Top-level keys

| Key | Type | Always present | Description |
|---|---|---|---|
| `seq_name` | `str` | ✅ | Sequence identifier (e.g. `"1080_9543_11988"`) |
| `frame_names` | `list[str]` len T | ✅ | Ordered frame stems, no extension (e.g. `["000001","000002",...]`) |
| `shot` | `int` | ⚠️ raw input only | Shot index from HaMeR tracker (default 0) |
| `tracks` | `dict[int, TrackDict]` | ✅ | Per-track data; keys are track ids (int) |
| `intrinsics_pnp` | `list[float]` × 4 | ✅ | `[fx, fy, cx, cy]` used for PnP (pixels) |
| `joints2d_source` | `str` | ✅ | `"observation"` or `"mano_reproject"` (see §3) |
| `joints2d_undistorted` | `bool` | ✅ | Whether `--undistort` was applied to 2D keypoints |
| `dist_coeffs_undistort` | `list[float]` | only if undistorted | OpenCV distortion coeffs `[k1,k2,p1,p2,k3]` used for undistortion |
| `_joints2d_are_real_image_coords` | `bool` | only if from raw pkl | Internal flag: joints2d came from `extra_data` (real image coords), not virtual-focal projection |

### Notes

- `frame_names` contains only the frames where HaMeR detected at least one
  hand.  Frames where no hand was detected are absent (not zero-filled).
- Frame name stems are bare (no `.jpg`/`.png` extension); use
  `resolve_img_path()` in `_video_io.py` to locate the actual image file.

---

## 2. Per-track dict (`tracks[tid]`)

T = number of frames in `frame_names`.

| Key | Shape | dtype | Description |
|---|---|---|---|
| `body_pose` | `(T, 15, 3)` | float32 | MANO finger joint rotations (axis-angle, 15 joints × 3) |
| `global_orient` | `(T, 3)` | float32 | Wrist orientation in **camera frame** (axis-angle, PnP-solved) |
| `cam_trans` | `(T, 3)` | float32 | Wrist root translation in **camera frame** (PnP-solved, j0-corrected) |
| `betas` | `(T, 10)` | float32 | MANO shape coefficients (same for all frames within a track) |
| `is_right` | `(T,)` | int64 | `1` = right hand, `0` = left hand |
| `joints2d` | `(T, 21, 3)` | float32 | 2D keypoints `[x, y, conf]` in image pixels; source depends on `joints2d_source` (see §3) |
| `vis_mask` | `(T,)` | bool | `True` for frames where this track is visible/detected |

### `cam_trans` convention

`cam_trans` uses HaMeR's **root-centred rotation** convention:

```
V_cam = V_mano_out(R_dh) + cam_trans
```

where `V_mano_out` places the wrist joint at the canonical position
`j0_canonical`.  The stored value is:

```
cam_trans = (R_eff − I) @ j0_canonical + t_eff
```

Not the bare PnP translation `t_eff`.  See *MANO root-centred rotation* in
`standalone_pnp/README.md` for full derivation.

---

## 3. `joints2d` — keypoint source

The `joints2d_source` top-level key and the keypoint loading priority:

| `joints2d_source` | Meaning |
|---|---|
| `"observation"` | 2D keypoints are the input observations used for PnP (ViTPose from compact archive / flat JSON dirs / raw `extra_data`) |
| `"mano_reproject"` | 2D keypoints are the MANO model's own reprojection under real K (`--reproject-joints2d` flag) |

When the input is a **raw HaMeR pkl**, `joints2d` is populated from the
`extra_data` field (ViTPose detections in real image pixel coordinates), and
`_joints2d_are_real_image_coords = True` is set.

Keypoint loading priority within `update_mano_pkl` (highest wins):

1. Compact track archive (`--track-preds-compact` or sibling `track_preds_compact/`)
2. Flat per-track ViTPose JSON dirs (`--track-preds`)
3. Raw HaMeR `extra_data` (when input is a raw pkl — real image coords)
4. Pkl fallback — `joints2d` already in the input pkl (HaMeR virtual-focal projection, **incorrect for real-K PnP**)

---

## 4. Input formats

`update_mano_pkl` accepts two input pkl types:

### 4a. Standard mano pkl

Produced by Dyn-HaMR or HaMeR pipeline post-processing.  Top-level keys:
`seq_name`, `frame_names`, `tracks` (with same per-track schema as §2, but
`global_orient` / `cam_trans` are under HaMeR's virtual camera).

After `update_mano_pkl`, `global_orient` and `cam_trans` are **replaced** with
PnP-solved values under real intrinsics.  All other per-track fields are
preserved.

### 4b. Raw HaMeR pkl (auto-converted)

HaMeR's raw tracker output is a dict keyed by absolute image paths:

```python
{
    "/.../images/<seq>/000001.jpg": {
        "mano": list[dict | -100],   # slot-indexed by track id; -100 = absent
            # dict has: global_orient (1,3,3), hand_pose (15,3,3),
            #           betas (10,), is_right 0|1
        "cam_trans":  list[ndarray(3) | -100],  # slot-indexed
        "extra_data": list[list[[x,y,conf]×21] | -100],  # slot-indexed, real image coords
        "tracked_ids": list[int],   # which slots are valid this frame
        "tracked_time": list[int],
        "tid": ndarray,
        "shot": int,
        "selection_data": list[dict],   # bbox, scores (not preserved in output)
    },
    ...
}
```

**Slot-indexed lists**: `mano`, `cam_trans`, `extra_data` are indexed by
**track id** (not detection order).  The sentinel `-100` marks absent tracks.
`tracked_ids` is the subset of valid slot indices for that frame.

**Auto-detection**: `_is_raw_hamer_pkl()` checks for image-extension string
keys + `mano`/`tracked_ids` in the first value.

**Conversion** (`_convert_raw_hamer_to_standard`):
- Frames sorted by basename → `frame_names`
- `seq_name` from parent dir (`.../images/<seq_name>/000001.jpg`)
- `global_orient`/`hand_pose` rotation matrices → axis-angle via `cv2.Rodrigues`
- `extra_data` → `tracks[tid].joints2d`
- Absent track slots → zero-filled row, `vis_mask[fi] = False`
- `selection_data`, `bbox_xyxy`, `tracked_time` are **not** preserved

---

## 5. Metadata written per run

These top-level keys are always written by `update_mano_pkl`, regardless of
input type:

```python
{
    # which real intrinsics were used for PnP
    "intrinsics_pnp": [fx, fy, cx, cy],        # float, pixels

    # which keypoints fed PnP
    "joints2d_source": "observation",           # or "mano_reproject"

    # undistortion
    "joints2d_undistorted": True | False,
    "dist_coeffs_undistort": [k1,k2,p1,p2,k3], # only if undistorted
}
```

---

## 6. Compatibility notes

- **v2 readers** (e.g. `PickleDataset`): read `tracks[tid]` directly; all
  fields from §2 are present.  New top-level keys are silently ignored.
- **`render_hamer` / `render_cam`**: use `cam_trans` + `global_orient` +
  `body_pose` + `betas` from each track.  `intrinsics_pnp` is used as the
  rendering camera K when available.
- **`run_vis` (world-frame)**: additionally needs `trans_world` /
  `root_orient_world` (v3 fields, not yet written by `update_mano_pkl`).
- **Frame count**: `frame_names` may be shorter than the original video if
  HaMeR did not detect a hand in every frame (tail frames often missing).

---

## 7. Example: inspect an output pkl

```python
import joblib, numpy as np

b = joblib.load("outputs/seq_pnp.pkl")

print(b["seq_name"])           # e.g. "1080_9543_11988"
print(b["frame_names"][:3])    # ['000001', '000002', '000003']
print(b["intrinsics_pnp"])     # [871.6, 872.0, 961.8, 545.6]
print(b["joints2d_undistorted"])

for tid, t in b["tracks"].items():
    hand = "right" if t["is_right"][0] else "left"
    vis  = t["vis_mask"].sum()
    T    = len(t["vis_mask"])
    print(f"track {tid} ({hand}): {vis}/{T} visible frames")
    print("  cam_trans[0]:", t["cam_trans"][0])
    print("  global_orient[0]:", t["global_orient"][0])
```

# HaMeR-Only Pure MANO PKL

This document focuses only on the pkl produced by HaMeR-only export:

```text
<output_root>/hamer_only_runs/<seq>/<seq>_hamer_only/filter_interp_mano/<seq>_filter_interp_mano.pkl
```

The pkl is intentionally minimal. It contains the filtered and interpolated MANO time series needed to reuse or render the hand motion.

## What This File Is

`<seq>_filter_interp_mano.pkl` is a `joblib.dump(...)` file containing:

- `seq_name`;
- `frame_names`;
- one MANO parameter track per exported hand.

It is not a raw HaMeR output pkl and it is not a full audit bundle. It is a pure final MANO parameter file.

## Load Example

Use the project environment that generated the file:

```python
import joblib

pkl_path = "<output_root>/hamer_only_runs/<seq>/<seq>_hamer_only/filter_interp_mano/<seq>_filter_interp_mano.pkl"
data = joblib.load(pkl_path)
```

The expected top-level keys are:

```python
data.keys()
# dict_keys(["seq_name", "frame_names", "tracks"])
```

## Shape Convention

The most common point of confusion is that fields such as `global_orient` and `cam_trans` have shape `(T, 3)`, not `(T, 2, 3)`.

This is intentional. The hand dimension is represented by the `tracks` dictionary, not by an extra axis inside each array.

```text
data
└── tracks
    ├── 0
    │   ├── body_pose:     (T, 15, 3)
    │   ├── global_orient: (T, 3)
    │   ├── cam_trans:     (T, 3)
    │   └── ...
    └── 1
        ├── body_pose:     (T, 15, 3)
        ├── global_orient: (T, 3)
        ├── cam_trans:     (T, 3)
        └── ...
```

So:

- `tracks[0]["cam_trans"]` is the camera translation sequence for one hand.
- `tracks[1]["cam_trans"]` is the camera translation sequence for the other hand.
- If both hands are present, the two-hand result is `tracks[0]` plus `tracks[1]`.

If a consumer wants a stacked array, they can build it explicitly:

```python
import numpy as np

tids = sorted(data["tracks"].keys())
cam_trans_NT3 = np.stack([data["tracks"][tid]["cam_trans"] for tid in tids], axis=0)
cam_trans_TN3 = np.transpose(cam_trans_NT3, (1, 0, 2))

print(cam_trans_NT3.shape)  # (N, T, 3)
print(cam_trans_TN3.shape)  # (T, N, 3)
```

The same pattern applies to `body_pose`, `global_orient`, `betas`, and `is_right`.

## Top-Level Schema

Let:

- `T = len(data["frame_names"])`
- `N = len(data["tracks"])`
- `tid` be a hand track id

Top-level fields:

| Key             | Type                | Shape / Length | Description                                                  |
| --------------- | ------------------- | -------------- | ------------------------------------------------------------ |
| `seq_name`    | `str`             | scalar         | Sequence name.                                               |
| `frame_names` | `list[str]`       | `T`          | Ordered frame names. All per-frame arrays follow this order. |
| `tracks`      | `dict[int, dict]` | `N` entries  | Per-hand MANO tracks. Each track stores one hand over time.  |

## Track Schema

Each `data["tracks"][tid]` contains only MANO information:

| Key               | Dtype       | Shape          | Description                                                                   |
| ----------------- | ----------- | -------------- | ----------------------------------------------------------------------------- |
| `body_pose`     | `float32` | `(T, 15, 3)` | MANO articulated hand pose, axis-angle, 15 non-root hand joints.              |
| `global_orient` | `float32` | `(T, 3)`     | MANO root/wrist orientation, axis-angle.                                      |
| `cam_trans`     | `float32` | `(T, 3)`     | HaMeR full-image camera translation used for projection/rendering.            |
| `betas`         | `float32` | `(T, 10)`    | MANO shape coefficients.                                                      |
| `is_right`      | `int64`   | `(T,)`       | Hand side. In the current global hand setup,`0` is left and `1` is right. |

Frames that are not rendered in `<seq>_filter_interp_mano_render.mp4` are also zeroed in the pkl. For those frames, `body_pose`, `global_orient`, `cam_trans`, and `betas` are all zeros. No validity mask is stored in the pkl; the zeroed MANO arrays are the compact representation of "no rendered hand for this track/frame". `is_right` remains a hand-side label.

The core MANO inputs are:

```python
track = data["tracks"][tid]

hand_pose = track["body_pose"].reshape(T, 45)
global_orient = track["global_orient"].reshape(T, 3)
betas = track["betas"].reshape(T, 10)
```

`cam_trans` should be kept separate from MANO `transl` if you want to match this project's renderer. The project forwards MANO with `transl=0`, then passes `cam_trans` to the renderer as the camera translation.

## Hand Side Convention

In the current HaMeR-only export, track id and hand side are aligned:

```text
tid = 0 -> left hand  -> is_right = 0
tid = 1 -> right hand -> is_right = 1
```

Do not assume every sequence always has both tracks. A sequence may contain only one hand.

## 21 Joints

The pkl does not store 21 joint positions directly.

There is no pkl key named `joints`, `joints3d`, `verts`, or `vertices`.

The 21-point outputs are available in two ways:

1. Raw 21-point 2D hand keypoints are in:

   ```text
   <output_root>/hamer_only_runs/<seq>/<seq>_hamer_only/keypoints/<seq>_keypoints.json
   ```

   Shape per track:

   ```text
   pose_keypoints_2d: (T, 21, 3)  # x, y, confidence
   ```
2. 21-point 3D hand joints can be recomputed by forwarding the pkl MANO parameters through this project's `body_model.MANO` wrapper. That wrapper appends fingertip vertices and remaps MANO output to 21 OpenPose-style hand joints.

If the goal is to match this project's render, remember that rendering applies the hand-side x flip and then uses `cam_trans` separately.

## Coordinate Frame

`cam_trans` is HaMeR's full-image camera translation. It is produced by converting HaMeR's crop camera to the original image camera using `cam_crop_to_full(...)`.

It should be interpreted as:

- per-frame;
- in the source camera coordinate system used for HaMeR projection/rendering;
- not a world-coordinate trajectory;
- not a DROID/Dyn-HaMR global camera pose;
- not a full camera extrinsic.

The pkl does not contain camera intrinsics, extrinsics, or a world transform.

## Rendering From Only PKL + Source Video

If you already have:

```text
<seq>_filter_interp_mano.pkl
<seq>.<ext>  # source video
```

then the pkl contains enough MANO data to render the filtered/interpolated hands back onto the video, as long as the project environment has the MANO assets and HaMeR renderer dependencies installed.

Important caveat: the current CLI does not expose a direct `render this pkl` command. With only pkl + source video, use a small one-off script that calls the existing project rendering helpers.

Run from the repository root inside the project environment:

```bash
export PYTHONPATH="$PWD/dyn-hamr:$PWD:${PYTHONPATH}"

python - <<'PY'
import cv2
import joblib
import numpy as np
from omegaconf import OmegaConf

from run_vis import (
    _compute_hamer_vertices,
    _make_hamer_renderer,
    _overlay_hamer_meshes,
    _open_video_writer,
)

pkl_path = "<path/to>/<seq>_filter_interp_mano.pkl"
video_path = "<path/to>/<seq>.mp4"
out_path = "<path/to>/<seq>_render_from_pkl.mp4"

data = joblib.load(pkl_path)
frame_names = data["frame_names"]
T = len(frame_names)

# Load the same project config used by Dyn-HaMR/HaMeR rendering.
cfg = OmegaConf.load("dyn-hamr/confs/config.yaml")

# Convert the pure pkl tracks to the internal render helper format.
tracks = []
for tid in sorted(data["tracks"].keys()):
    tr = data["tracks"][tid]
    render_mask = (
        np.any(tr["body_pose"] != 0, axis=(1, 2))
        | np.any(tr["global_orient"] != 0, axis=1)
        | np.any(tr["cam_trans"] != 0, axis=1)
        | np.any(tr["betas"] != 0, axis=1)
    )
    tracks.append({
        "tid": int(tid),
        "pose": tr["body_pose"],
        "orient": tr["global_orient"],
        "trans": tr["cam_trans"],
        "betas": tr["betas"],
        "is_right": tr["is_right"],
        "render_mask": render_mask,
        "observed_mask": render_mask,
        "anchor_mask": render_mask,
        "interp_mask": np.zeros((T,), dtype=bool),
        "interp_context_mask": np.zeros((T,), dtype=bool),
        "interp_left_anchor": np.full((T,), -1, dtype=np.int64),
        "interp_right_anchor": np.full((T,), -1, dtype=np.int64),
    })

render_data = _compute_hamer_vertices(cfg, tracks, dev_id=0)
renderer = _make_hamer_renderer(render_data["faces"])

cap = cv2.VideoCapture(video_path)
if not cap.isOpened():
    raise RuntimeError(f"Could not open source video: {video_path}")

fps = cap.get(cv2.CAP_PROP_FPS)
if not fps or fps <= 0:
    fps = 30.0

ok, first = cap.read()
if not ok:
    raise RuntimeError(f"Could not read first frame from: {video_path}")

writer = _open_video_writer(out_path, first, fps)
frame = first

try:
    for frame_idx in range(T):
        if frame_idx > 0:
            ok, frame = cap.read()
            if not ok:
                frame = np.zeros_like(first)

        hand_idcs = np.where(render_data["render_mask"][:, frame_idx])[0]
        if len(hand_idcs) > 0:
            frame = _overlay_hamer_meshes(
                frame,
                renderer,
                [render_data["verts"][hand_idx, frame_idx] for hand_idx in hand_idcs],
                [render_data["trans"][hand_idx, frame_idx] for hand_idx in hand_idcs],
                [int(render_data["is_right"][hand_idx, frame_idx]) for hand_idx in hand_idcs],
            )

        writer.write(frame)
finally:
    cap.release()
    writer.release()

print(f"Wrote {out_path}")
PY
```

The script writes one output video frame for each `frame_names[i]` in the pkl. The source video should therefore have the same frame order and at least the same number of frames.

## What To Give Another User

Minimum package for rendering:

```text
<seq>_filter_interp_mano.pkl
<seq>.<ext>  # source video with matching frame order
```

Optional package:

```text
<seq>_filter_interp_mano.pkl
<seq>_filter_interp_mano_render.mp4
<seq>.<ext>
```

The pre-rendered mp4 is useful because it is the exact render produced during export. The pkl is useful when the receiver wants to re-render, recompute joints/vertices, or use the MANO parameters in another pipeline.

## Quick Validation

```python
import joblib

data = joblib.load("<seq>_filter_interp_mano.pkl")
T = len(data["frame_names"])

assert set(data.keys()) == {"seq_name", "frame_names", "tracks"}

for tid, tr in data["tracks"].items():
    assert set(tr.keys()) == {"body_pose", "global_orient", "cam_trans", "betas", "is_right"}
    assert tr["body_pose"].shape == (T, 15, 3)
    assert tr["global_orient"].shape == (T, 3)
    assert tr["cam_trans"].shape == (T, 3)
    assert tr["betas"].shape == (T, 10)
    assert tr["is_right"].shape == (T,)
```

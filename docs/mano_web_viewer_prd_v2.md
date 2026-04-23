# MANO PKL Web 可视化工具 PRD（迭代二）

## 1. 背景

当前版本仅支持用户从本地电脑上传一个 `pkl` 文件和一个 `mp4` 文件进行可视化检查。该方式适合单次临时查看，但在实际使用中，很多数据已经存放在服务端文件系统，或已由上游流程整理为包含路径信息的 `csv` 文件。若仍要求用户先手动下载或逐个整理文件，再上传到页面，会带来额外操作成本，也不利于批量排查与高频验收。

下一版本目标是在保留“本地上传”能力的基础上，新增两种数据加载模式：

- 从服务端文件系统浏览并选择数据目录。
- 从服务端文件系统浏览并选择一个 `csv` 文件，再从 `csv` 中选择一条记录加载对应的 `pkl + mp4`。

该版本仍然聚焦“可视化检查”，不改变 2D/3D 联动查看、播放控制与错误提示的核心体验。

## 2. 目标

用户进入页面后，可通过以下三种方式之一加载一组 MANO 可视化数据：

- 从本地电脑上传一个 `pkl` 文件和一个 `mp4` 文件。
- 从服务端文件系统的受限根目录开始浏览，选择一个文件夹，系统自动在该文件夹中查找并加载 `pkl + mp4`。
- 从服务端文件系统的受限根目录开始浏览，选择一个 `csv` 文件；系统解析 `csv` 后展示记录列表，用户选择某一条记录，系统根据该记录中的 `pkl_path` 和 `source_path` 加载数据。

加载成功后，用户可在网页中：

- 左侧播放源视频，并叠加 2D 手部 mesh 渲染结果。
- 右侧查看 3D 手部结果，支持拖拽旋转、缩放、平移视角。
- 支持播放、暂停、上一帧、下一帧、拖拽进度条。
- 支持同时显示 `tracks` 中的全部手部结果。

## 3. 用户

- 算法工程师
- 结果验收/数据标注质检人员

## 4. 核心流程

### 4.1 模式 A：本地上传

1. 用户选择“本地上传”模式。
2. 用户选择一个 `pkl` 文件和一个 `mp4` 文件。
3. 系统校验文件是否可解析、帧数是否基本匹配。
4. 校验通过后，页面默认停在第 1 帧。
5. 左侧显示视频帧及 2D 手部渲染叠加。
6. 右侧显示同一帧的 3D 手部 mesh 和相机坐标轴。
7. 用户可播放、暂停、逐帧切换、拖动进度条，并在 3D 视图中调整观察角度。

### 4.2 模式 B：服务端文件系统浏览

1. 用户选择“服务端目录”模式。
2. 系统从预配置的可访问根路径开始展示目录浏览器，例如 `/home/ubuntu/Synadata_dev/`。
3. 用户通过目录浏览器逐级打开文件夹，直到定位到目标数据目录。
4. 用户选中一个文件夹后，系统在该文件夹下查找扩展名为 `.pkl` 与 `.mp4` 的文件。
5. 若同类文件存在多个，系统按文件名升序排序，并分别取第一个 `pkl` 与第一个 `mp4` 作为本次加载输入。
6. 系统执行输入校验；校验通过后进入渲染态。

### 4.3 模式 C：CSV 加载

1. 用户选择“CSV 加载”模式。
2. 系统从预配置的可访问根路径开始展示目录浏览器。
3. 用户通过目录浏览器选择一个 `csv` 文件。
4. 系统解析 `csv`，校验表头与记录内容，并展示可选记录列表。
5. 用户选择某一条记录。
6. 系统读取该记录中的 `pkl_path` 作为 `pkl` 文件路径，读取 `source_path` 作为 `mp4` 文件路径。
7. 系统执行路径可访问性校验、文件可读性校验、数据结构校验与视频校验；校验通过后进入渲染态。

## 5. 功能需求

### 5.1 数据加载模式

- 页面需提供三种互斥的数据加载模式：
  - 本地上传
  - 服务端目录
  - CSV 加载
- 用户切换模式后，页面应只展示当前模式所需的输入控件。
- 同一时刻仅允许激活一种加载模式。
- 切换模式后，上一模式下已选中的未加载输入不应污染当前模式。
- 任一模式完成加载后，用户应可重新选择数据源并刷新渲染结果。

### 5.2 服务端文件系统访问约束

- 系统需支持配置一个服务端文件系统可访问根路径，以下简称“访问根目录”。
- 目录浏览器的初始位置必须为该访问根目录。
- 用户仅可浏览访问根目录及其子目录，不可跳转到其外部路径。
- 页面不可允许用户手工输入任意绝对路径绕过目录浏览器限制。
- 当后端返回的路径超出访问根目录时，系统必须拦截并提示错误。
- 访问根目录为部署配置项，不在前端写死；PRD 示例路径可使用 `/home/ubuntu/Synadata_dev/`。

### 5.3 模式 A：本地上传

- 支持选择本地 `pkl` 文件。
- 支持选择本地 `mp4` 文件。
- 支持重新选择文件并刷新渲染结果。
- 当文件缺失、格式错误、解析失败时，给出明确错误提示。
- 文件选择完成后，系统必须先执行输入校验，校验通过后才允许进入渲染态。

### 5.4 模式 B：服务端目录浏览与自动选文件

- 提供目录浏览器，支持打开文件夹、返回上一级、显示当前路径。
- 浏览器默认从访问根目录开始。
- 用户在该模式下选择的目标对象是“文件夹”而非单个文件。
- 系统仅在被选中的文件夹内查找 `pkl` 与 `mp4`，不做递归子目录搜索。
- 系统查找文件时应按文件名升序排序。
- 当存在多个 `.pkl` 文件时，选择排序后的第一个。
- 当存在多个 `.mp4` 文件时，选择排序后的第一个。
- 系统需在界面上清晰展示本次实际选中的 `pkl` 文件名与 `mp4` 文件名，避免用户误解。
- 若文件夹内缺少任一必需文件，应直接报错，不进入渲染态。

### 5.5 模式 C：CSV 浏览、解析与选记录

- 提供目录浏览器，支持用户在访问根目录下选择一个 `csv` 文件。
- 系统应在选择 `csv` 后先校验文件可读性与编码可解析性。
- `csv` 需至少包含 `pkl_path` 和 `source_path` 两列。
- 系统需展示 `csv` 记录列表，供用户选择具体一条记录进行加载。
- 记录列表建议至少展示以下字段：`seq_name`、`frame_count`、`track_count`、`pkl_path`、`source_path`。
- 若 `csv` 中存在额外字段，如 `scenario`、`environment`、`task_label`、`subtask_label`，可作为辅助信息展示，但不是必填。
- 用户选中某条记录后，系统从该记录读取：
  - `pkl_path` 作为 `pkl` 文件路径
  - `source_path` 作为 `mp4` 文件路径
- 若 `csv` 中 `pkl_path` 或 `source_path` 为空，系统应报错。
- 若记录中的路径超出访问根目录，系统应报错。
- 若记录中的目标文件不存在、不可读或不可解析，系统应报错。

### 5.6 数据解析

- 解析 `pkl` 顶层字段：`seq_name`、`frame_names`、`tracks`。
- 支持解析 `tracks` 中的全部手部数据。
- 按 `frame_names` 顺序驱动时间轴。
- 读取每个 track 的 `body_pose`、`global_orient`、`cam_trans`、`betas`、`is_right`。
- 系统需对每个 track 进行一致性校验，确保同一 track 内各字段长度对齐后才进入后续 shape 校验与 mesh 重建。

### 5.7 左侧 2D 叠加视图

- 基于源 `mp4` 播放对应帧。
- 在视频帧上叠加手部 2D mesh 渲染。
- 播放过程中 2D 叠加与当前帧严格同步。
- 支持多个 track 同时渲染。
- 左右手需使用固定且可区分的不同颜色渲染，避免重叠时难以辨认。

### 5.8 右侧 3D 视图

- 渲染当前帧的手部 3D mesh。
- 显示相机坐标轴。
- 3D 视图中的手部位置按 `cam_trans` 的相机坐标系展示。
- 支持鼠标拖拽旋转、滚轮缩放、拖拽平移。
- 支持重置视角。
- 左右手需使用与 2D 视图一致的固定颜色渲染。

### 5.9 播放控制

- 播放
- 暂停
- 上一帧
- 下一帧
- 拖拽进度条跳转
- 显示当前帧号 / 总帧数

### 5.10 输入校验与报错

用户在任一模式下发起加载后，系统需按如下顺序执行校验；任一规则失败时，停止加载并展示对应报错。

| 编号 | 校验规则 | 报错内容（英文） |
| --- | --- | --- |
| V1 | 未选择加载模式。 | `Data loading mode is required.` |
| V2 | 本地上传模式下，未选择 `pkl` 文件。 | `PKL file is required.` |
| V3 | 本地上传模式下，未选择 `mp4` 文件。 | `MP4 file is required.` |
| V4 | 服务端目录模式下，未选择目标文件夹。 | `A server folder must be selected.` |
| V5 | CSV 加载模式下，未选择 `csv` 文件。 | `A CSV file must be selected.` |
| V6 | CSV 已解析但未选择记录。 | `A CSV row must be selected.` |
| V7 | 服务端浏览或 CSV 记录中的路径超出访问根目录。 | `Path is outside the allowed server root: {path}.` |
| V8 | 选中的 `pkl` 文件无法读取或反序列化失败。 | `Failed to load PKL file: {pkl_path}.` |
| V9 | 选中的视频文件无法打开或解码失败。 | `Failed to load video file: {video_path}.` |
| V10 | 选中的服务端目录中不存在任何 `.pkl` 文件。 | `No PKL file was found in folder: {folder_path}.` |
| V11 | 选中的服务端目录中不存在任何 `.mp4` 文件。 | `No MP4 file was found in folder: {folder_path}.` |
| V12 | `csv` 文件无法读取或解析失败。 | `Failed to load CSV file: {csv_path}.` |
| V13 | `csv` 缺少必须列 `pkl_path` 或 `source_path`。 | `Invalid CSV schema: missing required column {column}.` |
| V14 | `csv` 某条记录中的 `pkl_path` 为空。 | `CSV row {row_index} is missing pkl_path.` |
| V15 | `csv` 某条记录中的 `source_path` 为空。 | `CSV row {row_index} is missing source_path.` |
| V16 | `pkl` 顶层缺少必须字段 `seq_name`、`frame_names` 或 `tracks`。 | `Invalid PKL schema: missing required top-level key {key}.` |
| V17 | `frame_names` 不是非空数组。 | `Invalid PKL schema: frame_names must be a non-empty list.` |
| V18 | `tracks` 不是非空字典。 | `Invalid PKL schema: tracks must be a non-empty dictionary.` |
| V19 | 某个 track 缺少必须字段 `body_pose`、`global_orient`、`cam_trans`、`betas` 或 `is_right`。 | `Invalid track schema for track {track_id}: missing required key {key}.` |
| V20 | 某个 track 内部各字段长度不一致，无法按统一帧序列解析。 | `Inconsistent frame lengths in track {track_id}: {field_lengths}.` |
| V21 | 某个 track 的帧长度与 `frame_names` 长度不一致。 | `Frame count mismatch in track {track_id}: expected {expected_frames}, got {actual_frames}.` |
| V22 | `body_pose` shape 不为 `(T, 15, 3)`。 | `Invalid body_pose shape for track {track_id}: expected ({expected_frames}, 15, 3), got {actual_shape}.` |
| V23 | `global_orient` shape 不为 `(T, 3)`。 | `Invalid global_orient shape for track {track_id}: expected ({expected_frames}, 3), got {actual_shape}.` |
| V24 | `cam_trans` shape 不为 `(T, 3)`。 | `Invalid cam_trans shape for track {track_id}: expected ({expected_frames}, 3), got {actual_shape}.` |
| V25 | `betas` shape 不为 `(T, 10)`。 | `Invalid betas shape for track {track_id}: expected ({expected_frames}, 10), got {actual_shape}.` |
| V26 | `is_right` shape 不为 `(T,)`。 | `Invalid is_right shape for track {track_id}: expected ({expected_frames},), got {actual_shape}.` |
| V27 | 视频总帧数读取失败。 | `Failed to read total frame count from video: {video_path}.` |
| V28 | 视频总帧数小于 `pkl` 所需帧数。 | `Video frame count is shorter than PKL frame count: video={video_frames}, pkl={pkl_frames}.` |
| V29 | 视频分辨率读取失败，导致无法进行 2D overlay 初始化。 | `Failed to read video resolution from file: {video_path}.` |
| V30 | MANO 模型或渲染依赖初始化失败，无法重建 mesh。 | `Failed to initialize MANO renderer: {reason}.` |
| V31 | 某一帧 mesh 重建失败。 | `Failed to build hand mesh at frame {frame_index} for track {track_id}.` |

补充约束：

- 若视频帧数大于 `pkl` 帧数，允许加载，但播放器最大可播放帧应以 `pkl` 帧数为准。
- 所有报错需直接展示给用户，并保留具体变量值，便于排查输入问题。
- 同一轮校验建议优先返回首个阻塞性错误，不要求一次性展示全部错误。
- 对于 V20，`{field_lengths}` 应尽量使用对用户友好的键值形式展示，例如：`body_pose=281, global_orient=281, cam_trans=280, betas=281, is_right=281`。

## 6. 约束与边界

- 当前 `pkl` 不包含世界坐标、相机外参或完整相机模型；3D 视图仅保证展示相机坐标系下的手部结果，不承诺世界空间重建能力。
- 当前 `pkl` 不直接存储 `verts` / `joints3d`，需要基于 MANO 参数在前端或后端完成 mesh 重建。
- `mp4` 与 `pkl` 需来自同一序列，且帧顺序一致；若视频帧数少于 `pkl` 所需帧数，应提示用户文件不匹配。
- 服务端浏览能力只允许访问预配置根目录范围内的文件与目录，不支持浏览其外部路径。
- 服务端目录模式下，仅在用户选中的当前文件夹内查找文件，不支持跨子目录自动匹配。
- CSV 模式下，仅使用记录中的 `pkl_path` 与 `source_path` 作为加载依据；其他列只作为展示或辅助筛选信息。
- 本期目标是“可视化检查”，不包含结果编辑、标注回写、批量任务调度。

## 7. 非目标

- 不做算法推理。
- 不做离线导出新 `mp4` 作为核心流程。
- 不做多人协作、评论、审核流。
- 不做世界坐标系或多相机联合可视化。
- 不做自动递归扫描整个服务端目录并批量发现所有可用样本。
- 不做 CSV 内容编辑、修复或回写。

## 8. 验收标准

- 用户可在 1 个页面内完成三种模式下的数据选择、加载、查看和逐帧检查。
- 服务端目录模式下，用户可从预配置访问根目录开始浏览文件系统，并成功选择一个目录完成加载。
- 当目标目录内存在多个 `.pkl` 或多个 `.mp4` 时，系统按文件名升序选择第一个，并在界面中明确展示最终选中的文件。
- CSV 模式下，用户可从预配置访问根目录开始选择 `csv` 文件、查看记录列表并选择一条记录完成加载。
- CSV 模式下，系统能正确使用记录中的 `pkl_path` 和 `source_path` 加载数据，并对越界路径、空路径和缺列情况给出明确错误提示。
- 左侧可稳定显示视频叠加 2D 手部渲染，右侧可稳定显示 3D hand mesh 与相机坐标轴，并支持交互调视角。
- 左右手在 2D 和 3D 视图中均使用不同颜色，且同一只手在两个视图中的颜色保持一致。
- 播放、暂停、上一帧、下一帧、进度条跳转可正常工作，且 2D/3D 视图帧同步。
- 包含任意数量 track 的 `pkl` 均可正确展示。
- 当某个 track 内部字段长度不一致时，系统不会进入渲染态，而是给出用户可读、可定位问题的错误提示。

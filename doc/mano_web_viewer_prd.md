- MANO PKL Web 可视化工具 PRD

  ## 1. 背景

  当前算法产出每组结果包含一个源视频 `mp4` 和一个 MANO 结果 `pkl`。工程师为了检查 `pkl` 是否正确，需要手动运行脚本生成叠加手部渲染的新 `mp4`，流程慢、等待时间长、重复操作多，不适合日常批量排查。

  目标是提供一个 Web 工具，直接加载 `pkl + mp4`，在页面内完成 2D/3D 可视化检查，减少脚本渲染成本，提高问题定位效率。

  示例输入位于 `demo/`，`pkl` schema 定义见 `https://gitee.com/synapath/dyn-hamr/blob/dev/jeff/hamer-vis-outputs/docs/hamer_only_filter_interp_mano_pkl.md`。

  ## 2. 目标

  用户上传或选择一个 `pkl` 文件和一个 `mp4` 文件后，可在网页中：

  - 左侧播放源视频，并叠加 2D 手部 mesh 渲染结果。
  - 右侧查看 3D 手部结果，支持拖拽旋转、缩放、平移视角。
  - 支持播放、暂停、上一帧、下一帧、拖拽进度条。
  - 支持同时显示双手；若仅单手存在，也可正常展示。

  ## 3. 用户

  - 算法工程师
  - 结果验收/数据标注质检人员

  ## 4. 核心流程

  1. 用户选择一个 `pkl` 文件和一个 `mp4` 文件。
  2. 系统校验文件是否可解析、帧数是否基本匹配。
  3. 页面加载后默认停在第 1 帧。
  4. 左侧显示视频帧及 2D 手部渲染叠加。
  5. 右侧显示同一帧的 3D 手部 mesh 和相机坐标轴。
  6. 用户可播放、暂停、逐帧切换、拖动进度条，并在 3D 视图中调整观察角度。

  ## 5. 功能需求

  ### 5.1 文件输入

  - 支持选择本地 `pkl` 文件。
  - 支持选择本地 `mp4` 文件。
  - 支持重新选择文件并刷新渲染结果。
  - 当文件缺失、格式错误、解析失败时，给出明确错误提示。
  - 文件选择完成后，系统必须先执行输入校验，校验通过后才允许进入渲染态。

  ### 5.2 数据解析

  - 解析 `pkl` 顶层字段：`seq_name`、`frame_names`、`tracks`。
  - 支持 `tracks` 中 1 只手或 2 只手的数据。
  - 按 `frame_names` 顺序驱动时间轴。
  - 读取每个 track 的 `body_pose`、`global_orient`、`cam_trans`、`betas`、`is_right`。

  ### 5.3 左侧 2D 叠加视图

  - 基于源 `mp4` 播放对应帧。
  - 在视频帧上叠加手部 2D mesh 渲染。
  - 播放过程中 2D 叠加与当前帧严格同步。
  - 支持双手同时渲染。
  - 左右手需使用固定且可区分的不同颜色渲染，避免重叠时难以辨认。

  ### 5.4 右侧 3D 视图

  - 渲染当前帧的手部 3D mesh。
  - 显示相机坐标轴。
  - 3D 视图中的手部位置按 `cam_trans` 的相机坐标系展示。
  - 支持鼠标拖拽旋转、滚轮缩放、拖拽平移。
  - 支持重置视角。
  - 左右手需使用与 2D 视图一致的固定颜色渲染。

  ### 5.5 播放控制

  - 播放
  - 暂停
  - 上一帧
  - 下一帧
  - 拖拽进度条跳转
  - 显示当前帧号 / 总帧数

  ### 5.6 输入校验与报错

  用户选择 `pkl + mp4` 后，系统需按如下顺序执行校验；任一规则失败时，停止加载并展示对应报错。

  |      |                                                              |                                                              |
  | ---- | ------------------------------------------------------------ | ------------------------------------------------------------ |
  | 编号 | 校验规则                                                     | 报错内容（英文）                                             |
  | V1   | 未选择 pkl 文件。                                            | PKL file is required.                                        |
  | V2   | 未选择 mp4 文件。                                            | MP4 file is required.                                        |
  | V3   | pkl 文件无法读取或反序列化失败。                             | Failed to load PKL file: {pkl_path}.                         |
  | V4   | 视频文件无法打开或解码失败。                                 | Failed to load video file: {video_path}.                     |
  | V5   | pkl 顶层缺少必须字段 seq_name、frame_names 或 tracks。       | Invalid PKL schema: missing required top-level key {key}.    |
  | V6   | frame_names 不是非空数组。                                   | Invalid PKL schema: frame_names must be a non-empty list.    |
  | V7   | tracks 不是非空字典。                                        | Invalid PKL schema: tracks must be a non-empty dictionary.   |
  | V8   | tracks 中存在不支持的手数量；当前仅支持 1 只手或 2 只手。    | Invalid track count: expected 1 or 2 tracks, got {track_count}. |
  | V9   | 某个 track 缺少必须字段 body_pose、global_orient、cam_trans、betas 或 is_right。 | Invalid track schema for track {track_id}: missing required key {key}. |
  | V10  | 某个 track 的帧长度与 frame_names 长度不一致。               | Frame count mismatch in track {track_id}: expected {expected_frames}, got {actual_frames}. |
  | V11  | body_pose shape 不为 (T, 15, 3)。                            | Invalid body_pose shape for track {track_id}: expected ({expected_frames}, 15, 3), got {actual_shape}. |
  | V12  | global_orient shape 不为 (T, 3)。                            | Invalid global_orient shape for track {track_id}: expected ({expected_frames}, 3), got {actual_shape}. |
  | V13  | cam_trans shape 不为 (T, 3)。                                | Invalid cam_trans shape for track {track_id}: expected ({expected_frames}, 3), got {actual_shape}. |
  | V14  | betas shape 不为 (T, 10)。                                   | Invalid betas shape for track {track_id}: expected ({expected_frames}, 10), got {actual_shape}. |
  | V15  | is_right shape 不为 (T,)。                                   | Invalid is_right shape for track {track_id}: expected ({expected_frames},), got {actual_shape}. |
  | V16  | 视频总帧数读取失败。                                         | Failed to read total frame count from video: {video_path}.   |
  | V17  | 视频总帧数小于 pkl 所需帧数。                                | Video frame count is shorter than PKL frame count: video={video_frames}, pkl={pkl_frames}. |
  | V18  | 视频分辨率读取失败，导致无法进行 2D overlay 初始化。         | Failed to read video resolution from file: {video_path}.     |
  | V19  | MANO 模型或渲染依赖初始化失败，无法重建 mesh。               | Failed to initialize MANO renderer: {reason}.                |
  | V20  | 某一帧 mesh 重建失败。                                       | Failed to build hand mesh at frame {frame_index} for track {track_id}. |

  补充约束：

  - 若视频帧数大于 `pkl` 帧数，允许加载，但播放器最大可播放帧应以 `pkl` 帧数为准。
  - 所有报错需直接展示给用户，并保留具体变量值，便于排查输入问题。
  - 同一轮校验建议优先返回首个阻塞性错误，不要求一次性展示全部错误。

  ## 6. 约束与边界

  - 当前 `pkl` 不包含世界坐标、相机外参或完整相机模型；3D 视图仅保证展示相机坐标系下的手部结果，不承诺世界空间重建能力。
  - 当前 `pkl` 不直接存储 `verts` / `joints3d`，需要基于 MANO 参数在前端或后端完成 mesh 重建。
  - `mp4` 与 `pkl` 需来自同一序列，且帧顺序一致；若视频帧数少于 `pkl` 所需帧数，应提示用户文件不匹配。
  - 本期目标是“可视化检查”，不包含结果编辑、标注回写、批量任务调度。

  ## 7. 非目标

  - 不做算法推理。
  - 不做离线导出新 `mp4` 作为核心流程。
  - 不做多人协作、评论、审核流。
  - 不做世界坐标系或多相机联合可视化。

  ## 8. 验收标准

  - 用户可在 1 个页面内完成 `pkl + mp4` 选择、加载、查看和逐帧检查。
  - 左侧可稳定显示视频叠加 2D 手部渲染。
  - 右侧可稳定显示 3D hand mesh 与相机坐标轴，并支持交互调视角。
  - 左右手在 2D 和 3D 视图中均使用不同颜色，且同一只手在两个视图中的颜色保持一致。
  - 播放、暂停、上一帧、下一帧、进度条跳转可正常工作，且 2D/3D 视图帧同步。
  - 单手和双手 `pkl` 均可正确展示。

  ## 9. 架构设计

  推荐采用 **“服务端解析 + 前端渲染”** 的模式：

  - **App Router (Next.js 14+)**: 用于构建 UI 页面和交互。

  - API Routes

    : 使用 Python (通过 

    ```
    FastAPI
    ```

     或 

    ```
    Flask
    ```

     作为微服务) 或在 Node.js 中调用 Python 脚本。

    - *原因*：MANO 模型通常依赖 `torch`、`numpy` 和 `chumpy`。在前端 JS 中直接实现 MANO 重建逻辑非常复杂且性能有限，建议通过 API 将 `pkl` 转换成前端易读的 `JSON`（包含每一帧的顶点数据 `verts`）。

  - **Three.js / React Three Fiber (R3F)**: 在前端负责 3D 渲染。

  ## 10. 核心技术点实现

  ### A. 数据预处理 (API 层)

  由于 `pkl` 文件在浏览器端直接解析比较麻烦（尤其是复杂的 Python 对象），你可以利用 Next.js 的 API Route。

  1. 用户上传 `pkl`。

  2. Next.js 启动一个 Python 子进程或请求 Python 微服务。

  3. Python 使用 MANO 模型将 `body_pose` 和 `betas` 转化为 `(T, 778, 3)` 的顶点坐标。

  4. 返回 JSON 给前端：

     JSON

     ```
     {
       "tracks": {
         "track_0": {
           "verts": [[...], [...]], // 每帧 778 个点
           "is_right": true
         }
       }
     }
     ```

  ### B. 2D/3D 同步播放器

  在 Next.js 中，你需要维护一个全局的 `frameIndex` 状态。

  - **视频同步**：使用 `requestAnimationFrame` 监听视频的 `currentTime`，并计算出对应的 `frameIndex`。
  - **3D 更新**：当 `frameIndex` 改变时，更新 Three.js 中 Mesh 的 `position` 属性。

  ### C. UI 组件布局

  利用 **Tailwind CSS** 快速实现 PRD 要求的左右布局。

  TypeScript

  ```
  // 伪代码示例
  export default function ManoViewer() {
    const [currentFrame, setCurrentFrame] = useState(0);
  
    return (
      <div className="flex h-screen">
        {/* 左侧：2D 视频 + Canvas 叠加 */}
        <div className="relative w-1/2 bg-black">
          <video id="source-video" src={videoUrl} />
          <canvas id="overlay-2d" className="absolute top-0 left-0" />
        </div>
  
        {/* 右侧：3D 视图 */}
        <div className="w-1/2">
          <Canvas>
            <Scene data={pklData} frame={currentFrame} />
          </Canvas>
        </div>
  
        {/* 底部控制栏 */}
        <div className="fixed bottom-0 w-full bg-gray-800 p-4">
          <Slider value={currentFrame} onChange={...} />
        </div>
      </div>
    );
  }
  ```

  ------

  ## 3. 针对 PRD 校验规则 (V1-V19) 的 Next.js 实现

  | **校验类型**             | **实现方式**                                                 |
  | ------------------------ | ------------------------------------------------------------ |
  | **文件校验 (V1-V2)**     | React Form 状态检查。                                        |
  | **Schema 校验 (V5-V14)** | 在 API 层使用 **Zod** 或 Python 的 **Pydantic** 进行强类型校验。 |
  | **帧数匹配 (V16)**       | 在前端加载视频后，通过 `video.duration * fps` 与 `pkl` 的数组长度对比。 |
  | **渲染初始化 (V18)**     | 捕获 WebGL 上下文异常或 MANO 加载异常并弹窗告警。            |

- 

  |      |      |
  | ---- | ---- |
  |      |      |
  |      |      |
  |      |      |
  |      |      |

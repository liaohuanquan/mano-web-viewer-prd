/**
 * MANO 数据类型定义
 * 对应 PKL 文件中的数据结构
 */

/** 单个 track 的 MANO 参数（前端使用的顶点数据格式） */
export interface ManoTrack {
  /** track 标识 */
  track_id: number;
  /** 每帧的相机平移 (T 帧, xyz) */
  cam_trans: number[][];
  /** 手的类型：0=左手, 1=右手 */
  is_right: number[];
  /** 每帧的可见性遮罩 */
  vis_mask: boolean[];
  /** 每帧的顶点数据 (可选) */
  verts?: number[][][];
  /** 每帧的关节点数据 (可选, 16个关节点) */
  joints?: number[][][];
}

/** PKL 解析后的完整数据 */
export interface ManoData {
  /** 序列名称 */
  seq_name: string;
  /** 帧名称列表 */
  frame_names: string[];
  /** 总帧数 */
  total_frames: number;
  /** 所有 track 数据 */
  tracks: ManoTrack[];
  /** MANO 面片索引 (共享) */
  faces?: number[][];
  /** 相机内参 [fx, fy, cx, cy] */
  intrinsics_pnp?: number[];
  /** 文件元信息（fps、时长等） */
  file_info?: {
    timeline_kind?: string;
    source_fps?: number;
    pkl_fps?: number;
    source_frame_count?: number;
    frame_count?: number;
    source_duration_sec?: number;
  };
  /** 评分数据 (可选) */
  per_frame_validity?: number[];
  left_per_frame_validity?: number[];
  right_per_frame_validity?: number[];
}

/** API 响应包装 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** 文件上传状态 */
export interface FileUploadState {
  pklFile: File | null;
  mp4File: File | null;
}

/** 播放器状态 */
export interface PlayerState {
  /** 当前帧索引 */
  currentFrame: number;
  /** 总帧数 */
  totalFrames: number;
  /** 是否正在播放 */
  isPlaying: boolean;
  /** 播放帧率 */
  fps: number;
}

/** 加载状态 */
export type LoadingState = 'idle' | 'uploading' | 'parsing' | 'rendering' | 'ready' | 'error';

'use client';

import { useRef, useEffect, useCallback } from 'react';
import styles from './VideoOverlay.module.css';
import type { ManoTrack } from '@/types/mano';

interface VideoOverlayProps {
  /** MP4 文件 URL */
  videoUrl: string;
  /** 当前帧索引 */
  currentFrame: number;
  /** 总帧数 */
  totalFrames: number;
  /** 视频帧率 */
  fps: number;
  /** 是否正在播放 */
  isPlaying: boolean;
  /** 同步帧索引的回调 */
  onSync?: (frame: number) => void;
  /** 暂停播放的回调 */
  onPause?: () => void;
  /** 手部轨迹数据 */
  tracks?: ManoTrack[];
  /** 顶点面片（只做边界绘制） */
  faces?: number[][];
  /** 是否开启插值 */
  interpolationEnabled?: boolean;
  /** 相机内参 [fx, fy, cx, cy] */
  intrinsics_pnp?: number[];
}

/**
 * 2D 视频叠加视图
 * 负责播放源视频并在 Canvas 上叠加 2D 手部渲染
 */
export default function VideoOverlay({
  videoUrl,
  currentFrame,
  totalFrames,
  fps,
  isPlaying,
  onSync,
  onPause,
  tracks = [],
  faces = [],
  interpolationEnabled = false,
  intrinsics_pnp,
}: VideoOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /** 同步视频到指定帧 */
  const seekToFrame = useCallback((frame: number) => {
    const video = videoRef.current;
    if (!video || !fps) return;
    const targetTime = frame / fps;
    // 允许微小误差，避免频繁 seek 导致卡顿
    if (Math.abs(video.currentTime - targetTime) > (1 / fps) / 2) {
      video.currentTime = targetTime;
    }
  }, [fps]);

  /** 帧变化时同步视频。仅在暂停状态或手动拖动时进行 seek，播放时让视频自然流动 */
  useEffect(() => {
    if (!isPlaying) {
      seekToFrame(currentFrame);
    }
  }, [currentFrame, isPlaying, seekToFrame]);

  /** 切换播放/暂停 */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      // 播放前确保时间对齐
      const targetTime = currentFrame / fps;
      if (Math.abs(video.currentTime - targetTime) > 0.1) {
        video.currentTime = targetTime;
      }
      video.play().catch(err => {
        console.log('[VideoOverlay.play] 播放异常:', err.message);
      });
    } else {
      video.pause();
    }
  }, [isPlaying, fps]); // eslint-disable-line react-hooks/exhaustive-deps
  // 注意：currentFrame 故意不放入依赖，防止播放中途被不断重置
  
  /** 记录相机内参的使用状态 */
  useEffect(() => {
    if (intrinsics_pnp && intrinsics_pnp.length === 4) {
      console.log('[VideoOverlay] 使用传入的相机内参:', intrinsics_pnp);
    } else {
      console.log('[VideoOverlay] 未检测到有效相机内参，使用默认投影参数');
    }
  }, [intrinsics_pnp]);

  /** 记录帧长度对比日志 */
  useEffect(() => {
    if (tracks && tracks.length > 0) {
      const pklFrames = tracks[0].cam_trans?.length || 0;
      console.log(`[VideoOverlay] 帧长度检测 - 视频总帧数: ${totalFrames}, PKL 轨迹帧数: ${pklFrames}`);
      if (Math.abs(totalFrames - pklFrames) > 1) {
        console.warn(`[VideoOverlay] 帧数不一致警告：视频(${totalFrames}) 与 PKL(${pklFrames}) 长度不匹配，可能存在同步问题。`);
      }
    }
  }, [tracks, totalFrames]);

  /** 播放中由视频驱动全局帧同步 & Overlay 渲染循环 */
  useEffect(() => {
    let animationFrameId: number;

    const renderLoop = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // 1. 同步时间到主循环
      if (video && !video.paused && onSync && fps) {
        const frame = video.currentTime * fps;
        onSync(frame);
      }

      // 2. 将 3D Mesh 投影绘制到 Canvas
      if (canvas && video && tracks.length > 0) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // 相机内参
          let pnp_fx: number, pnp_fy: number, pnp_cx: number, pnp_cy: number;
          if (intrinsics_pnp && intrinsics_pnp.length === 4) {
            [pnp_fx, pnp_fy, pnp_cx, pnp_cy] = intrinsics_pnp;
          } else {
            // 兼容旧数据的默认值
            pnp_fx = 1382*5/2.0;
            pnp_fy = 1382*5/2.0;
            pnp_cx = 639.0;
            pnp_cy = 357.0;
          }

          // 缩放至 canvas 尺寸（优先使用视频实际分辨率）
          const origW = video.videoWidth || (intrinsics_pnp ? pnp_cx * 2 : 1280.0);
          const origH = video.videoHeight || (intrinsics_pnp ? pnp_cy * 2 : 720.0);
          const scaleX = canvas.width / origW;
          const scaleY = canvas.height / origH;
          
          if (video.videoWidth > 0 && (origW !== video.videoWidth)) {
             console.log('[renderLoop] 尺寸检测:', { videoW: video.videoWidth, origW, scaleX });
          }
          
          const fx = pnp_fx * scaleX;
          const fy = pnp_fy * scaleY;
          const cx = pnp_cx * scaleX;
          const cy = pnp_cy * scaleY;

          // 使用透传过来的高精度 currentFrame
          const frameInt = Math.floor(currentFrame);
          const alpha = interpolationEnabled ? (currentFrame % 1) : 0;

          tracks.forEach(track => {
            const totalTrackFrames = track.cam_trans?.length || 0;
            if (totalTrackFrames === 0) return;
            // 跳过不可见帧
            if (track.vis_mask && !track.vis_mask[frameInt]) return;
            const frameNext = Math.min(totalTrackFrames - 1, frameInt + 1);

            const isRight = track.is_right[frameInt] === 1;
            const colorFill = isRight ? "rgba(255, 107, 107, 0.4)" : "rgba(0, 206, 209, 0.4)";
            const colorStroke = isRight ? "rgba(255, 107, 107, 0.8)" : "rgba(0, 206, 209, 0.8)";

            const v1 = track.verts?.[frameInt];
            const v2 = track.verts?.[frameNext];
            
            if (v1 && v2 && v1.length === 778 && faces.length > 0) {
              const t1 = track.cam_trans?.[frameInt] || [0,0,0];
              const t2 = track.cam_trans?.[frameNext] || [0,0,0];

              // 插值后的位移
              const cam_tx = t1[0] + (t2[0] - t1[0]) * alpha;
              const cam_ty = t1[1] + (t2[1] - t1[1]) * alpha;
              const cam_tz = t1[2] + (t2[2] - t1[2]) * alpha;

              // 保存投影后的 2D 坐标
              const projected = new Float32Array(778 * 2);

              // 镜像翻转系数（与 3D 视图保持一致：左手镜像）
              const flipX = isRight ? 1.0 : -1.0;

              for (let i = 0; i < 778; i++) {
                // 顶点局部插值
                const lx = v1[i][0] + (v2[i][0] - v1[i][0]) * alpha;
                const ly = v1[i][1] + (v2[i][1] - v1[i][1]) * alpha;
                const lz = v1[i][2] + (v2[i][2] - v1[i][2]) * alpha;

                // 转换到相机坐标系：应用镜像(仅X)后叠加平移
                const vx = lx * flipX + cam_tx;
                const vy = ly + cam_ty;
                const vz = lz + cam_tz;

                // 针孔相机投影 (OpenCV 相机：Z 向前为正方向)
                if (vz > 0.01) {
                  projected[i*2] = cx + (vx / vz) * fx;
                  projected[i*2+1] = cy + (vy / vz) * fy;
                } else {
                  projected[i*2] = -1000;
                  projected[i*2+1] = -1000;
                }
              }

              // 绘制三角面
              ctx.fillStyle = colorFill;
              ctx.strokeStyle = colorStroke;
              ctx.lineWidth = 0.5;

              ctx.beginPath();
              
              faces.forEach(face => {
                const i1 = face[0];
                const i2 = face[1];
                const i3 = face[2];

                const x1 = projected[i1*2], y1 = projected[i1*2+1];
                const x2 = projected[i2*2], y2 = projected[i2*2+1];
                const x3 = projected[i3*2], y3 = projected[i3*2+1];

                // 如果存在越界点则丢弃该面
                if (x1 < -500 || x2 < -500 || x3 < -500) return;

                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.lineTo(x3, y3);
                ctx.lineTo(x1, y1); // 闭合面可以使得渲染更完整
              });
              ctx.fill();
              ctx.stroke();
            }
          });
        }
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, fps, onSync, currentFrame, tracks, faces]);

  /** 调整 Canvas 尺寸与视频一致 */
  const handleVideoResize = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }, []);

  /** 处理视频播放结束 */
  const handleVideoEnded = useCallback(() => {
    onSync?.(totalFrames - 1); // 确保停在最后一帧
    if (isPlaying) {
      if (onPause) onPause();
    }
  }, [onSync, totalFrames, isPlaying, onPause]);

  return (
    <div ref={containerRef} className={styles.container}>
      <video
        ref={videoRef}
        className={styles.video}
        src={videoUrl}
        muted
        playsInline
        autoPlay
        preload="auto"
        onLoadedMetadata={handleVideoResize}
        onResize={handleVideoResize}
        onEnded={handleVideoEnded}
        style={{ 
          transform: 'translateZ(0)', 
          willChange: 'transform',
          backfaceVisibility: 'hidden'
        }}
      />
      {/* 2D overlay Canvas */}
      <canvas
        ref={canvasRef}
        className={styles.overlayCanvas}
      />
    </div>
  );
}

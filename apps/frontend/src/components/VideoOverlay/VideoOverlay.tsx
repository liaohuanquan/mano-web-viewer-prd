'use client';

import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useState } from 'react';
import styles from './VideoOverlay.module.css';
import type { ManoTrack } from '@/types/mano';

export interface VideoOverlayHandle {
  startExport: (onProgress?: (p: number) => void) => Promise<void>;
}

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
const VideoOverlay = forwardRef<VideoOverlayHandle, VideoOverlayProps>(({
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
}, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSyncedFrameRef = useRef<number>(-1);
  const [isExporting, setIsExporting] = useState(false);

  // 暴露导出方法给外部
  useImperativeHandle(ref, () => ({
    startExport: async (onProgress) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || totalFrames <= 0) return;

      setIsExporting(true);
      if (isPlaying) onPause?.();

      const stream = canvas.captureStream(0); // 手动触发抓帧
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.start();

      const track = stream.getVideoTracks()[0] as any;

      try {
        for (let i = 0; i < totalFrames; i++) {
          // 1. 跳转到指定帧
          const targetTime = (i / (totalFrames - 1)) * video.duration;
          video.currentTime = targetTime;
          
          // 2. 等待视频 seek 完成且数据可用
          await new Promise<void>((resolve) => {
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              // 额外给一点点 buffer 时间确保画面渲染完成
              setTimeout(resolve, 30);
            };
            video.addEventListener('seeked', onSeeked);
          });

          // 3. 强制执行一次绘制逻辑（这里复用了渲染代码，通过 state 驱动）
          // 由于 requestAnimationFrame 在后台可能不执行，我们在这里手动调用一次绘制
          drawFrame(i);

          // 4. 抓取当前 Canvas 画面到录制流
          if (track.requestFrame) {
            track.requestFrame();
          }
          
          onProgress?.(Math.round(((i + 1) / totalFrames) * 100));
        }

        recorder.stop();
        await new Promise((resolve) => (recorder.onstop = resolve));

        // 5. 保存文件
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mano_export_${new Date().getTime()}.webm`;
        a.click();
        URL.revokeObjectURL(url);

      } catch (err) {
        console.error('[VideoOverlay.export] 导出失败:', err);
      } finally {
        setIsExporting(false);
        onProgress?.(0);
      }
    }
  }));

  // 将复杂的绘制逻辑提取出来，方便录制时手动调用
  const drawFrame = useCallback((frameIdx: number) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!video || !canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 关键：将视频帧画入 canvas 背景
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 相机内参逻辑
    let pnp_fx: number, pnp_fy: number, pnp_cx: number, pnp_cy: number;
    if (intrinsics_pnp && intrinsics_pnp.length === 4) {
      [pnp_fx, pnp_fy, pnp_cx, pnp_cy] = intrinsics_pnp;
    } else {
      pnp_fx = 1382*5/2.0; pnp_fy = 1382*5/2.0; pnp_cx = 639.0; pnp_cy = 357.0;
    }

    const videoW = video.videoWidth || (intrinsics_pnp ? pnp_cx * 2 : 1280.0);
    const videoH = video.videoHeight || (intrinsics_pnp ? pnp_cy * 2 : 720.0);
    const scaleX = canvas.width / videoW;
    const scaleY = canvas.height / videoH;
    const fx = pnp_fx * scaleX; const fy = pnp_fy * scaleY;
    const cx = pnp_cx * scaleX; const cy = pnp_cy * scaleY;

    const frameInt = Math.floor(frameIdx);
    const alpha = interpolationEnabled ? (frameIdx % 1) : 0;

    tracks.forEach(track => {
      const totalTrackFrames = track.cam_trans?.length || 0;
      if (totalTrackFrames === 0 || (track.vis_mask && !track.vis_mask[frameInt])) return;
      
      const frameNext = Math.min(totalTrackFrames - 1, frameInt + 1);
      const isRight = track.is_right[frameInt] === 1;
      const colorFill = isRight ? "rgba(255, 107, 107, 0.4)" : "rgba(0, 206, 209, 0.4)";
      const colorStroke = isRight ? "rgba(255, 107, 107, 0.8)" : "rgba(0, 206, 209, 0.8)";
      const v1 = track.verts?.[frameInt];
      const v2 = track.verts?.[frameNext];
      
      if (v1 && v2 && v1.length === 778 && faces.length > 0) {
        const t1 = track.cam_trans?.[frameInt] || [0,0,0];
        const t2 = track.cam_trans?.[frameNext] || [0,0,0];
        const cam_tx = t1[0] + (t2[0] - t1[0]) * alpha;
        const cam_ty = t1[1] + (t2[1] - t1[1]) * alpha;
        const cam_tz = t1[2] + (t2[2] - t1[2]) * alpha;
        const projected = new Float32Array(778 * 2);
        const flipX = isRight ? 1.0 : -1.0;

        for (let i = 0; i < 778; i++) {
          const lx = v1[i][0] + (v2[i][0] - v1[i][0]) * alpha;
          const ly = v1[i][1] + (v2[i][1] - v1[i][1]) * alpha;
          const lz = v1[i][2] + (v2[i][2] - v1[i][2]) * alpha;
          const vx = lx * flipX + cam_tx;
          const vy = ly + cam_ty;
          const vz = lz + cam_tz;
          if (vz > 0.01) {
            projected[i*2] = cx + (vx / vz) * fx;
            projected[i*2+1] = cy + (vy / vz) * fy;
          } else {
            projected[i*2] = -1000; projected[i*2+1] = -1000;
          }
        }
        ctx.fillStyle = colorFill; ctx.strokeStyle = colorStroke; ctx.lineWidth = 0.5;
        ctx.beginPath();
        faces.forEach(face => {
          const x1 = projected[face[0]*2], y1 = projected[face[0]*2+1];
          const x2 = projected[face[1]*2], y2 = projected[face[1]*2+1];
          const x3 = projected[face[2]*2], y3 = projected[face[2]*2+1];
          if (x1 < -500 || x2 < -500 || x3 < -500) return;
          ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x1, y1);
        });
        ctx.fill(); ctx.stroke();
      }
    });
  }, [faces, intrinsics_pnp, tracks, interpolationEnabled]);

  /** 同步视频到指定帧 */
  const seekToFrame = useCallback((frame: number) => {
    const video = videoRef.current;
    if (!video || !fps || totalFrames <= 1 || !video.duration) return;
    
    // 使用时长比例对齐，解决视频与 PKL 长度微小差异（如 1-2 帧误差）导致的末尾偏移
    const targetTime = (frame / (totalFrames - 1)) * video.duration;
    
    // 允许微小误差，避免频繁 seek 导致卡顿
    if (Math.abs(video.currentTime - targetTime) > (1 / fps) / 2) {
      video.currentTime = targetTime;
    }
  }, [fps, totalFrames]);

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
    const video = videoRef.current;
    if (tracks && tracks.length > 0) {
      const pklFrames = tracks[0].cam_trans?.length || 0;
      const videoDurationFrames = video?.duration ? Math.round(video.duration * fps) : '加载中...';
      console.log(`[VideoOverlay] 帧长度检测 - 预期总帧数: ${totalFrames}, PKL 轨迹帧数: ${pklFrames}, 视频时长对应帧数: ${videoDurationFrames}`);
      if (Math.abs(totalFrames - pklFrames) > 1) {
        console.warn(`[VideoOverlay] 帧数不一致警告：视频(${totalFrames}) 与 PKL(${pklFrames}) 长度不匹配，已启用比例对齐逻辑。`);
      }
    }
  }, [tracks, totalFrames, fps]);

  /** 播放中由视频驱动全局帧同步 & Overlay 渲染循环 */
  useEffect(() => {
    let animationFrameId: number;

    const renderLoop = () => {
      // 如果正在导出，则不执行正常的循环绘制（避免冲突）
      if (isExporting) {
        animationFrameId = requestAnimationFrame(renderLoop);
        return;
      }

      const video = videoRef.current;
      // ... 之前的 renderLoop 逻辑 ...
      if (video && !video.paused && onSync && totalFrames > 0 && video.duration) {
        const frame = Math.floor(video.currentTime * (totalFrames / video.duration));
        const clampedFrame = Math.min(totalFrames - 1, Math.max(0, frame));
        if (clampedFrame !== lastSyncedFrameRef.current) {
          onSync(clampedFrame);
          lastSyncedFrameRef.current = clampedFrame;
        }
      }

      drawFrame(currentFrame);
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
});

export default VideoOverlay;

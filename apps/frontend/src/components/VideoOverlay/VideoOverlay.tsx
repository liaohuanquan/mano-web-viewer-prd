'use client';

import { useRef, useEffect, useCallback } from 'react';
import styles from './VideoOverlay.module.css';

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
  }, [isPlaying, fps]); // 注意：currentFrame 故意不放入依赖，防止播放中途被不断重置

  /** 播放中由视频驱动全局帧同步 */
  useEffect(() => {
    if (!isPlaying || !onSync || !fps) return;

    let animationFrameId: number;
    const syncLoop = () => {
      const video = videoRef.current;
      if (video && !video.paused) {
        const frame = video.currentTime * fps;
        onSync(frame);
      }
      animationFrameId = requestAnimationFrame(syncLoop);
    };

    animationFrameId = requestAnimationFrame(syncLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, fps, onSync]);

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
      // 通过 Page 组件或者直接调用 player 状态，这里通过 props 暂时难以直接触达 setIsPlaying
      // 但由于 onSync 会更新 currentFrame，UI 会同步。
      // 为完美起见，VideoOverlay 最好也能接收一个 setPlaying 回调，但目前简化处理
    }
  }, [onSync, totalFrames, isPlaying]);

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
        onEnded={onPause} // 在 HomePage 传入 onPause
        style={{ 
          transform: 'translateZ(0)', 
          willChange: 'transform',
          backfaceVisibility: 'hidden'
        }}
      />
      {/* 2D overlay Canvas，后续用于叠加手部 mesh */}
      <canvas
        ref={canvasRef}
        className={styles.overlayCanvas}
      />
    </div>
  );
}

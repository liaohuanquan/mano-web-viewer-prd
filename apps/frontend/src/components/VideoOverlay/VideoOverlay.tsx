'use client';

import { useRef, useEffect, useCallback } from 'react';
import styles from './VideoOverlay.module.css';

interface VideoOverlayProps {
  /** MP4 文件 URL */
  videoUrl: string;
  /** 当前帧索引 */
  currentFrame: number;
  /** 视频帧率 */
  fps: number;
  /** 是否正在播放 */
  isPlaying: boolean;
}

/**
 * 2D 视频叠加视图
 * 负责播放源视频并在 Canvas 上叠加 2D 手部渲染
 * 后续阶段将集成 MANO 2D mesh overlay
 */
export default function VideoOverlay({
  videoUrl,
  currentFrame,
  fps,
  isPlaying,
}: VideoOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /** 同步视频到指定帧 */
  const seekToFrame = useCallback((frame: number) => {
    const video = videoRef.current;
    if (!video || !fps) return;
    const targetTime = frame / fps;
    // 避免重复 seek
    if (Math.abs(video.currentTime - targetTime) > 0.01) {
      video.currentTime = targetTime;
    }
  }, [fps]);

  /** 帧变化时同步视频。仅在暂停状态或手动拖动时进行 seek，播放时让视频自然流动以免卡顿 */
  useEffect(() => {
    if (!isPlaying) {
      seekToFrame(currentFrame);
    }
  }, [currentFrame, isPlaying, seekToFrame]);

  /** 播放/暂停控制 */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(() => {
        console.log('[VideoOverlay] 视频播放被阻止');
      });
    } else {
      video.pause();
    }
  }, [isPlaying]);

  /** 调整 Canvas 尺寸与视频一致 */
  const handleVideoResize = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }, []);

  return (
    <div ref={containerRef} className={styles.container}>
      <video
        ref={videoRef}
        className={styles.video}
        src={videoUrl}
        muted
        playsInline
        preload="auto"
        onLoadedMetadata={handleVideoResize}
        onResize={handleVideoResize}
      />
      {/* 2D overlay Canvas，后续用于叠加手部 mesh */}
      <canvas
        ref={canvasRef}
        className={styles.overlayCanvas}
      />
    </div>
  );
}

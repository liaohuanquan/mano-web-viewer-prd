'use client';

import { useCallback, useRef } from 'react';
import styles from './PlayerControls.module.css';

interface PlayerControlsProps {
  currentFrame: number;
  totalFrames: number;
  isPlaying: boolean;
  fps: number;
  onPlay: () => void;
  onPause: () => void;
  onPrevFrame: () => void;
  onNextFrame: () => void;
  onSeek: (frame: number) => void;
}

/**
 * 播放控制栏组件
 * 包含播放/暂停、上一帧/下一帧、进度条、帧号显示
 */
export default function PlayerControls({
  currentFrame,
  totalFrames,
  isPlaying,
  fps,
  onPlay,
  onPause,
  onPrevFrame,
  onNextFrame,
  onSeek,
}: PlayerControlsProps) {
  const progressRef = useRef<HTMLDivElement>(null);

  /** 计算进度百分比 */
  const progress = totalFrames > 0 ? (currentFrame / (totalFrames - 1)) * 100 : 0;

  /** 点击进度条跳转 */
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || totalFrames <= 0) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const frame = ratio * (totalFrames - 1);
    console.log('[handleProgressClick] 跳转到帧:', frame);
    onSeek(frame);
  }, [totalFrames, onSeek]);

  /** 拖拽进度条 */
  const handleProgressMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    handleProgressClick(e);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!progressRef.current || totalFrames <= 0) return;
      const rect = progressRef.current.getBoundingClientRect();
      const x = moveEvent.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      const frame = ratio * (totalFrames - 1);
      onSeek(frame);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [handleProgressClick, totalFrames, onSeek]);

  return (
    <div className={styles.controlBar}>
      {/* 按钮组 */}
      <div className={styles.btnGroup}>
        <button
          className={styles.controlBtn}
          onClick={onPrevFrame}
          title="上一帧"
        >
          ⏮
        </button>

        <button
          className={`${styles.controlBtn} ${styles.controlBtnPlay}`}
          onClick={isPlaying ? onPause : onPlay}
          title={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <button
          className={styles.controlBtn}
          onClick={onNextFrame}
          title="下一帧"
        >
          ⏭
        </button>
      </div>

      {/* 进度条 */}
      <div
        ref={progressRef}
        className={styles.progressContainer}
        onMouseDown={handleProgressMouseDown}
      >
        <div className={styles.progressTrack}>
          <div
            className={styles.progressFill}
            style={{ width: `${progress}%` }}
          >
            <div className={styles.progressThumb} />
          </div>
        </div>
      </div>

      {/* 帧信息 */}
      <div className={styles.frameInfo}>
        <span className={styles.frameInfoCurrent}>{Math.floor(currentFrame) + 1}</span>
        <span className={styles.frameInfoSep}>/</span>
        <span>{totalFrames}</span>
      </div>

      {/* FPS */}
      <span className={styles.fpsLabel}>{fps} fps</span>
    </div>
  );
}

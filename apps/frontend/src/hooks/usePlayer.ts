'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface UsePlayerOptions {
  totalFrames: number;
  fps?: number;
  /** 是否使用内部定时器驱动播放。如果由外部（如视频）驱动，可设为 false */
  useInternalTimer?: boolean;
}

interface UsePlayerReturn {
  currentFrame: number;
  isPlaying: boolean;
  fps: number;
  play: () => void;
  pause: () => void;
  prevFrame: () => void;
  nextFrame: () => void;
  seek: (frame: number) => void;
}

/**
 * 播放控制 hook
 * 管理帧索引状态、播放/暂停逻辑
 */
export function usePlayer({ 
  totalFrames, 
  fps = 30, 
  useInternalTimer = true 
}: UsePlayerOptions): UsePlayerReturn {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  /** 播放循环 */
  useEffect(() => {
    // 如果不使用内部定时器，或者已暂停，则不运行 tick
    if (!isPlaying || !useInternalTimer || totalFrames <= 0) return;

    const interval = 1000 / fps;

    const tick = (timestamp: number) => {
      const elapsed = timestamp - lastTimeRef.current;
      if (elapsed >= interval) {
        // 计算实际经过的帧数（支持浮动帧率）
        const framesPassed = elapsed / interval;
        lastTimeRef.current = timestamp;

        setCurrentFrame((prev) => {
          const next = prev + framesPassed;
          if (next >= totalFrames - 1) {
            setIsPlaying(false);
            return totalFrames - 1;
          }
          return next;
        });
      }
      animationRef.current = requestAnimationFrame(tick);
    };

    lastTimeRef.current = performance.now();
    animationRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, totalFrames, fps, useInternalTimer]);

  const play = useCallback(() => {
    if (totalFrames <= 0) return;
    // 若在末尾，从头开始播放
    setCurrentFrame((prev) => {
      if (prev >= totalFrames - 1) return 0;
      return prev;
    });
    setIsPlaying(true);
    console.log('[usePlayer.play] 开始播放');
  }, [totalFrames]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    console.log('[usePlayer.pause] 暂停播放');
  }, []);

  const prevFrame = useCallback(() => {
    setIsPlaying(false);
    setCurrentFrame((prev) => Math.max(0, Math.ceil(prev - 1)));
  }, []);

  const nextFrame = useCallback(() => {
    setIsPlaying(false);
    setCurrentFrame((prev) => Math.min(totalFrames - 1, Math.floor(prev + 1)));
  }, [totalFrames]);

  const seek = useCallback((frame: number) => {
    const clamped = Math.max(0, Math.min(totalFrames - 1, frame));
    setCurrentFrame((prev) => {
      // 允许 0.001 的极小差异，以支持平滑更新
      if (Math.abs(prev - clamped) < 0.001) return prev;
      return clamped;
    });
  }, [totalFrames]);

  return {
    currentFrame,
    isPlaying,
    fps,
    play,
    pause,
    prevFrame,
    nextFrame,
    seek,
  };
}

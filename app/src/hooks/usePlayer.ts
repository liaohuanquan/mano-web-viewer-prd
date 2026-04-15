'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface UsePlayerOptions {
  totalFrames: number;
  fps?: number;
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
export function usePlayer({ totalFrames, fps = 30 }: UsePlayerOptions): UsePlayerReturn {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  /** 播放循环 */
  useEffect(() => {
    if (!isPlaying || totalFrames <= 0) return;

    const interval = 1000 / fps;

    const tick = (timestamp: number) => {
      if (timestamp - lastTimeRef.current >= interval) {
        lastTimeRef.current = timestamp;
        setCurrentFrame((prev) => {
          const next = prev + 1;
          if (next >= totalFrames) {
            // 播放到末尾暂停
            setIsPlaying(false);
            return prev;
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
  }, [isPlaying, totalFrames, fps]);

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
    setCurrentFrame((prev) => Math.max(0, prev - 1));
  }, []);

  const nextFrame = useCallback(() => {
    setIsPlaying(false);
    setCurrentFrame((prev) => Math.min(totalFrames - 1, prev + 1));
  }, [totalFrames]);

  const seek = useCallback((frame: number) => {
    const clamped = Math.max(0, Math.min(totalFrames - 1, frame));
    setCurrentFrame(clamped);
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

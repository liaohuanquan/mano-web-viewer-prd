'use client';

import { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import FileUpload from '@/components/FileUpload/FileUpload';
import PlayerControls from '@/components/PlayerControls/PlayerControls';
import VideoOverlay from '@/components/VideoOverlay/VideoOverlay';
import { usePlayer } from '@/hooks/usePlayer';
import type { LoadingState, ManoTrack } from '@/types/mano';
import styles from './page.module.css';

/** 动态加载 3D 场景（禁用 SSR） */
const Scene3D = dynamic(
  () => import('@/components/Scene3D/Scene3D'),
  { ssr: false }
);

/**
 * MANO Web Viewer 主页面
 * 集成文件上传、2D/3D 视图、播放控制
 */
export default function HomePage() {
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [totalFrames, setTotalFrames] = useState(0);
  const [seqName, setSeqName] = useState<string>('');
  const [tracks, setTracks] = useState<ManoTrack[]>([]);
  const [faces, setFaces] = useState<number[][]>([]);

  const player = usePlayer({ 
    totalFrames, 
    fps: 30,
    useInternalTimer: !videoUrl // 有视频时禁用内部定时器，由视频驱动
  });

  /** 是否处于文件选择阶段 */
  const isUploadPhase = loadingState === 'idle' || loadingState === 'error';
  const isLoading = loadingState === 'uploading' || loadingState === 'parsing';
  const isReady = loadingState === 'ready';

  /** 处理文件选择提交 */
  const handleFilesSelected = useCallback(async (pklFile: File, mp4File: File) => {
    console.log('[handleFilesSelected] 开始处理文件:', pklFile.name, mp4File.name);
    setError(null);
    setLoadingState('uploading');

    try {
      // 创建 MP4 播放 URL
      const mp4Url = URL.createObjectURL(mp4File);
      setVideoUrl(mp4Url);

      // 上传 PKL 到后端解析
      const formData = new FormData();
      formData.append('pkl_file', pklFile);
      formData.append('mp4_file', mp4File);

      setLoadingState('parsing');

      const response = await fetch('http://localhost:8000/api/parse-pkl', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ detail: '服务端错误' }));
        throw new Error(errData.detail || `HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('[handleFilesSelected] 解析成功:', result.seq_name, '帧数:', result.total_frames, 'Tracks:', result.tracks?.length);

      setSeqName(result.seq_name || '');
      setTotalFrames(result.total_frames || 0);
      setTracks(result.tracks || []);
      setFaces(result.faces || []);
      setLoadingState('ready');

    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      console.log('[handleFilesSelected] 加载失败:', message);
      setError(message);
      setLoadingState('error');
      // 清理视频 URL
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
        setVideoUrl(null);
      }
    }
  }, [videoUrl]);

  /** 重新选择文件 */
  const handleReset = useCallback(() => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoUrl(null);
    setTotalFrames(0);
    setSeqName('');
    setTracks([]);
    setFaces([]);
    setError(null);
    setLoadingState('idle');
  }, [videoUrl]);

  /** 头部信息 */
  const headerInfoText = useMemo(() => {
    if (isReady && seqName) return seqName;
    return '';
  }, [isReady, seqName]);

  return (
    <div className={styles.container}>
      {/* 顶部标题栏 */}
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>MANO Web Viewer</h1>
        <div className={styles.headerInfo}>
          {headerInfoText}
          {isReady && (
            <button
              className={styles.headerInfo}
              onClick={handleReset}
              style={{ marginLeft: 16, cursor: 'pointer', border: 'none', background: 'none', color: 'var(--color-text-muted)', textDecoration: 'underline' }}
            >
              重新选择
            </button>
          )}
        </div>
      </header>

      {/* 错误提示 */}
      {error && (
        <div className={styles.errorBanner}>
          <span className={styles.errorIcon}>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* 主内容区域 */}
      <div className={styles.main}>
        {isUploadPhase || isLoading ? (
          /* 上传/加载阶段 - 居中显示上传组件 */
          <div className={styles.emptyState}>
            <FileUpload
              onFilesSelected={handleFilesSelected}
              isLoading={isLoading}
            />
          </div>
        ) : (
          /* 就绪阶段 - 左右分栏 */
          <>
            {/* 左侧：2D 视频叠加视图 */}
            <div className={styles.panelLeft}>
              <span className={styles.panelLabel}>2D Overlay</span>
              <div className={styles.viewContainer}>
                {videoUrl && (
                  <VideoOverlay
                    videoUrl={videoUrl}
                    currentFrame={player.currentFrame}
                    totalFrames={totalFrames}
                    fps={player.fps}
                    isPlaying={player.isPlaying}
                    onSync={player.seek}
                    onPause={player.pause}
                    tracks={tracks}
                    faces={faces}
                    interpolationEnabled={player.interpolationEnabled}
                  />
                )}
              </div>
            </div>

            {/* 右侧：3D 视图 */}
            <div className={styles.panelRight}>
              <span className={styles.panelLabel}>3D View</span>
              <div className={styles.viewContainer}>
                <Scene3D 
                  currentFrame={player.currentFrame} 
                  tracks={tracks} 
                  faces={faces} 
                  interpolationEnabled={player.interpolationEnabled}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* 底部控制栏 */}
      {isReady && (
        <div className={styles.controlBar}>
          <PlayerControls
            currentFrame={player.currentFrame}
            totalFrames={totalFrames}
            isPlaying={player.isPlaying}
            fps={player.fps}
            onPlay={player.play}
            onPause={player.pause}
            onPrevFrame={player.prevFrame}
            onNextFrame={player.nextFrame}
            onSeek={player.seek}
            interpolationEnabled={player.interpolationEnabled}
            onToggleInterpolation={() => player.setInterpolationEnabled(!player.interpolationEnabled)}
          />
        </div>
      )}
    </div>
  );
}

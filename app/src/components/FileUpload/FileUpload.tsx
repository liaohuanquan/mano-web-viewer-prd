'use client';

import { useRef, useState, useCallback } from 'react';
import styles from './FileUpload.module.css';

interface FileUploadProps {
  onFilesSelected: (pklFile: File, mp4File: File) => void;
  isLoading: boolean;
}

/**
 * 文件上传组件
 * 支持 PKL 和 MP4 文件的拖拽上传或点击选择
 */
export default function FileUpload({ onFilesSelected, isLoading }: FileUploadProps) {
  const [pklFile, setPklFile] = useState<File | null>(null);
  const [mp4File, setMp4File] = useState<File | null>(null);
  const [pklDragActive, setPklDragActive] = useState(false);
  const [mp4DragActive, setMp4DragActive] = useState(false);

  const pklInputRef = useRef<HTMLInputElement>(null);
  const mp4InputRef = useRef<HTMLInputElement>(null);

  /** 格式化文件大小 */
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  /** 处理 PKL 文件选择 */
  const handlePklChange = useCallback((file: File) => {
    console.log('[handlePklChange] 选择 PKL 文件:', file.name);
    setPklFile(file);
  }, []);

  /** 处理 MP4 文件选择 */
  const handleMp4Change = useCallback((file: File) => {
    console.log('[handleMp4Change] 选择 MP4 文件:', file.name);
    setMp4File(file);
  }, []);

  /** 处理拖拽进入 */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  /** 处理拖拽放下 */
  const handleDrop = useCallback((e: React.DragEvent, type: 'pkl' | 'mp4') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'pkl') setPklDragActive(false);
    else setMp4DragActive(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (type === 'pkl') {
      handlePklChange(file);
    } else {
      handleMp4Change(file);
    }
  }, [handlePklChange, handleMp4Change]);

  /** 提交加载 */
  const handleSubmit = useCallback(() => {
    if (!pklFile || !mp4File) return;
    console.log('[handleSubmit] 开始加载文件');
    onFilesSelected(pklFile, mp4File);
  }, [pklFile, mp4File, onFilesSelected]);

  /** 重置文件 */
  const handleReset = useCallback(() => {
    setPklFile(null);
    setMp4File(null);
    if (pklInputRef.current) pklInputRef.current.value = '';
    if (mp4InputRef.current) mp4InputRef.current.value = '';
  }, []);

  if (isLoading) {
    return (
      <div className={styles.uploadContainer}>
        <div className={styles.loadingOverlay}>
          <div className={styles.spinner} />
          <span className={styles.loadingText}>正在解析文件，请稍候...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.uploadContainer}>
      <h2 className={styles.uploadTitle}>MANO Web Viewer</h2>
      <p className={styles.uploadSubtitle}>选择 PKL 和 MP4 文件开始可视化检查</p>

      <div className={styles.uploadFields}>
        {/* PKL 文件上传 */}
        <div className={styles.uploadField}>
          <div
            className={`${styles.dropZone} ${pklDragActive ? styles.dropZoneActive : ''} ${pklFile ? styles.dropZoneSelected : ''}`}
            onClick={() => pklInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragEnter={(e) => { e.preventDefault(); setPklDragActive(true); }}
            onDragLeave={() => setPklDragActive(false)}
            onDrop={(e) => handleDrop(e, 'pkl')}
          >
            {pklFile ? (
              <>
                <span className={styles.dropIcon}>📦</span>
                <span className={styles.fileName}>{pklFile.name}</span>
                <span className={styles.fileSize}>{formatSize(pklFile.size)}</span>
              </>
            ) : (
              <>
                <span className={styles.dropIcon}>📦</span>
                <span className={styles.dropLabel}>PKL 文件</span>
                <span className={styles.dropHint}>点击或拖拽上传</span>
              </>
            )}
          </div>
          <input
            ref={pklInputRef}
            type="file"
            accept=".pkl"
            className={styles.hiddenInput}
            onChange={(e) => e.target.files?.[0] && handlePklChange(e.target.files[0])}
          />
        </div>

        {/* MP4 文件上传 */}
        <div className={styles.uploadField}>
          <div
            className={`${styles.dropZone} ${mp4DragActive ? styles.dropZoneActive : ''} ${mp4File ? styles.dropZoneSelected : ''}`}
            onClick={() => mp4InputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragEnter={(e) => { e.preventDefault(); setMp4DragActive(true); }}
            onDragLeave={() => setMp4DragActive(false)}
            onDrop={(e) => handleDrop(e, 'mp4')}
          >
            {mp4File ? (
              <>
                <span className={styles.dropIcon}>🎬</span>
                <span className={styles.fileName}>{mp4File.name}</span>
                <span className={styles.fileSize}>{formatSize(mp4File.size)}</span>
              </>
            ) : (
              <>
                <span className={styles.dropIcon}>🎬</span>
                <span className={styles.dropLabel}>MP4 文件</span>
                <span className={styles.dropHint}>点击或拖拽上传</span>
              </>
            )}
          </div>
          <input
            ref={mp4InputRef}
            type="file"
            accept=".mp4,video/mp4"
            className={styles.hiddenInput}
            onChange={(e) => e.target.files?.[0] && handleMp4Change(e.target.files[0])}
          />
        </div>
      </div>

      <div className={styles.uploadActions}>
        <button
          className={styles.btnPrimary}
          disabled={!pklFile || !mp4File}
          onClick={handleSubmit}
        >
          开始加载
        </button>
        {(pklFile || mp4File) && (
          <button className={styles.btnSecondary} onClick={handleReset}>
            重置
          </button>
        )}
      </div>
    </div>
  );
}

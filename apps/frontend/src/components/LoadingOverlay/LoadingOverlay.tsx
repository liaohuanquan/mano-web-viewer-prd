import React from 'react';
import styles from './LoadingOverlay.module.css';
import { LoadingState } from '@/types/mano';

interface LoadingOverlayProps {
  state: LoadingState;
  message?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ state, message }) => {
  if (state === 'idle' || state === 'ready' || state === 'error') return null;

  const getStatusText = () => {
    switch (state) {
      case 'uploading': return '正在传输数据...';
      case 'parsing': return '后端正在解析 PKL 序列...';
      case 'rendering': return '前端正在初始化 3D 渲染...';
      default: return '正在处理中...';
    }
  };

  const getProgress = () => {
    switch (state) {
      case 'uploading': return 30;
      case 'parsing': return 60;
      case 'rendering': return 90;
      default: return 0;
    }
  };

  const progress = getProgress();

  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <div className={styles.spinner}>
          <div className={styles.doubleBounce1}></div>
          <div className={styles.doubleBounce2}></div>
        </div>
        <div className={styles.textContainer}>
          <h3 className={styles.statusText}>{getStatusText()}</h3>
          <div className={styles.progressInfo}>
            <span className={styles.percentage}>{progress}%</span>
            {message && <span className={styles.subText}> - {message}</span>}
          </div>
        </div>
        <div className={styles.progressBar}>
          <div 
            className={styles.progressFill} 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay;

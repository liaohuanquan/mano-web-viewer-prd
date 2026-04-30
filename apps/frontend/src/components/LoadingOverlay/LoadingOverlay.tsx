import React, { useState, useEffect, useRef } from 'react';
import styles from './LoadingOverlay.module.css';
import { LoadingState } from '@/types/mano';

interface LoadingOverlayProps {
  state: LoadingState;
  message?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ state, message }) => {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const lastStateRef = useRef<LoadingState>(state);
  
  // 处理组件的挂载与卸载逻辑（支持淡出）
  useEffect(() => {
    if (state !== 'idle' && state !== 'error') {
      setShouldRender(true);
      // 给一点延迟让 DOM 渲染后再开始动画
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    } else if (state === 'idle' || state === 'error') {
      // 只有当进度达到 100 或处于错误状态时才关闭
      if (displayProgress >= 100 || state === 'error') {
        setIsVisible(false);
        const timer = setTimeout(() => {
          setShouldRender(false);
          setDisplayProgress(0);
        }, 500); // 匹配 CSS transition 时间
        return () => clearTimeout(timer);
      }
    }
  }, [state, displayProgress]);

  const getTargetProgress = () => {
    switch (state) {
      case 'uploading': return 30;
      case 'parsing': return 65;
      case 'rendering': return 92;
      case 'ready': return 100;
      default: return displayProgress; // 保持当前值
    }
  };

  const getStatusText = () => {
    switch (state) {
      case 'uploading': return '正在传输数据...';
      case 'parsing': return '后端正在解析 PKL 序列...';
      case 'rendering': return '前端正在初始化 3D 渲染...';
      case 'ready': return '加载完成！';
      default: return '正在处理中...';
    }
  };

  useEffect(() => {
    if (!shouldRender) return;

    const target = getTargetProgress();
    
    const interval = setInterval(() => {
      setDisplayProgress(prev => {
        if (prev < target) {
          const diff = target - prev;
          // 状态切换到 ready 时，冲刺到 100
          const speed = state === 'ready' ? 0.15 : 0.1;
          const step = Math.max(0.1, diff * speed); 
          return Math.min(prev + step, target);
        } else if (prev < 98 && state !== 'ready') {
          return prev + 0.03;
        }
        return prev;
      });
    }, 40);

    return () => clearInterval(interval);
  }, [state, shouldRender]);

  if (!shouldRender) return null;

  const roundedProgress = Math.floor(displayProgress);

  return (
    <div className={`${styles.overlay} ${isVisible ? styles.visible : ''}`}>
      <div className={styles.content}>
        <div className={styles.spinner}>
          <div className={styles.doubleBounce1}></div>
          <div className={styles.doubleBounce2}></div>
        </div>
        <div className={styles.textContainer}>
          <h3 className={styles.statusText}>{getStatusText()}</h3>
          <div className={styles.progressInfo}>
            <span className={styles.percentage}>{roundedProgress}%</span>
            {message && <span className={styles.subText}> - {message}</span>}
          </div>
        </div>
        <div className={styles.progressBar}>
          <div 
            className={styles.progressFill} 
            style={{ width: `${displayProgress}%` }}
          >
            <div className={styles.progressGlow}></div>
          </div>
        </div>
        <div className={styles.loadingHint}>请稍候，大型序列解析可能需要 5-10 秒</div>
      </div>
    </div>
  );
};

export default LoadingOverlay;

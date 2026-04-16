'use client';

import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import { useEffect } from 'react';
import type { ManoTrack } from '@/types/mano';
import styles from './Scene3D.module.css';

interface Scene3DProps {
  /** 当前帧索引 */
  currentFrame: number;
  /** 手部轨迹数据 */
  tracks: ManoTrack[];
}

/**
 * 相机坐标轴辅助器
 * 显示 XYZ 坐标轴
 */
function CameraAxes() {
  return (
    <axesHelper args={[0.5]} />
  );
}

/**
 * 网格地面
 * 辅助空间感知
 */
function Ground() {
  return (
    <gridHelper
      args={[2, 20, '#2a2a3a', '#1a1a24']}
      position={[0, -0.5, 0]}
    />
  );
}

/**
 * 占位手部 mesh
 * 后续阶段将替换为真实 MANO mesh 渲染
 */
function PlaceholderHand({ position, color }: { position: [number, number, number]; color: string }) {
  const meshRef = useRef<THREE.Mesh>(null);

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.1, 16, 16]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.6}
        roughness={0.3}
        metalness={0.1}
      />
    </mesh>
  );
}

/**
 * 3D 视图组件
 * 使用 React Three Fiber 渲染手部 3D mesh
 * 支持轨道控制（旋转/缩放/平移）
 */
export default function Scene3D({ currentFrame, tracks }: Scene3DProps) {
  // 打印调试信息
  useEffect(() => {
    if (tracks && tracks.length > 0) {
      const frameData = tracks.map(t => ({
        tid: t.trackId,
        trans: t.camTrans?.[currentFrame],
        side: t.isRight?.[currentFrame] === 1 ? 'Right' : 'Left'
      }));
      console.log(`[Scene3D] frame=${currentFrame}`, frameData);
    }
  }, [currentFrame, tracks]);

  return (
    <div className={styles.container}>
      <Canvas
        camera={{
          position: [0, 0.3, 1.5],
          fov: 50,
          near: 0.01,
          far: 100,
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        style={{ background: '#0a0a0f' }}
      >
        {/* 灯光 */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[2, 3, 2]} intensity={0.8} />
        <directionalLight position={[-2, 1, -1]} intensity={0.3} />

        {/* 坐标轴 */}
        <CameraAxes />

        {/* 网格地面 */}
        <Ground />

        {/* 动态手部渲染 */}
        {tracks.map((track) => {
          const pos = track.camTrans?.[currentFrame];
          if (!pos || (pos[0] === 0 && pos[1] === 0 && pos[2] === 0)) return null;

          // 这里的颜色保持与 2D 视图一致
          const color = track.isRight[currentFrame] === 1 ? '#FF6B6B' : '#00CED1';

          return (
            <group key={track.trackId} position={[pos[0], pos[1], pos[2]]}>
              <PlaceholderHand position={[0, 0, 0]} color={color} />
              {/* 可视化 track ID */}
              <mesh position={[0, 0.15, 0]}>
                <sphereGeometry args={[0.02, 8, 8]} />
                <meshBasicMaterial color="white" />
              </mesh>
            </group>
          );
        })}

        {/* 轨道控制器 */}
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          minDistance={0.3}
          maxDistance={10}
        />

        {/* 视角指示器 */}
        <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
          <GizmoViewport
            axisColors={['#FF4060', '#40FF60', '#4060FF']}
            labelColor="white"
          />
        </GizmoHelper>
      </Canvas>
    </div>
  );
}

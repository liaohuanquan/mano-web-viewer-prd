'use client';

import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import styles from './Scene3D.module.css';

interface Scene3DProps {
  /** 当前帧索引 */
  currentFrame: number;
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
export default function Scene3D({ currentFrame }: Scene3DProps) {
  // currentFrame 后续用于驱动 mesh 更新
  void currentFrame;

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

        {/* 占位手部（左手-青色，右手-珊瑚色） */}
        <PlaceholderHand position={[-0.15, 0, 0]} color="#00CED1" />
        <PlaceholderHand position={[0.15, 0, 0]} color="#FF6B6B" />

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

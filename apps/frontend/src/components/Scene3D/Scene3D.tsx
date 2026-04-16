'use client';


import { Canvas } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import { useEffect, useMemo, useRef } from 'react';
import type { ManoTrack } from '@/types/mano';
import styles from './Scene3D.module.css';

interface Scene3DProps {
  /** 当前帧索引 */
  currentFrame: number;
  /** 手部轨迹数据 */
  tracks: ManoTrack[];
  /** MANO 顶点面片连接数据 */
  faces?: number[][];
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
 * 真实手部 Mesh 将通过传入的顶点(verts)和面(faces)构建
 */
function ManoMesh({ position, color, verts, faces }: { position: [number, number, number]; color: string; verts: number[][]; faces: number[][] }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // 当 verts 和 faces 改变时动态重新构建 Geometry
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const vertices = new Float32Array(verts.flat());
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    
    if (faces && faces.length > 0) {
      const indices = new Uint16Array(faces.flat());
      geo.setIndex(new THREE.BufferAttribute(indices, 1));
    }
    
    // 重新计算法线以便接受光照
    geo.computeVertexNormals();
    return geo;
  }, [verts, faces]);

  return (
    <mesh ref={meshRef} position={position} geometry={geometry}>
      <meshStandardMaterial
        color={color}
        side={THREE.DoubleSide}
        roughness={0.4}
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
export default function Scene3D({ currentFrame, tracks, faces }: Scene3DProps) {
  // 打印调试信息
  useEffect(() => {
    if (tracks && tracks.length > 0) {
      const frameData = tracks.map(t => ({
        tid: t.track_id,
        trans: t.cam_trans?.[currentFrame],
        vertsLen: t.verts?.[currentFrame]?.length,
        side: t.is_right?.[currentFrame] === 1 ? 'Right' : 'Left'
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
          const rawPos = track.cam_trans?.[currentFrame];
          if (!rawPos || (rawPos[0] === 0 && rawPos[1] === 0 && rawPos[2] === 0)) return null;

          // 坐标系转换：OpenCV (X-右, Y-下, Z-前) -> Three.js (X-右, Y-上, Z-后)
          // 转换规则：Three_X = Cam_X, Three_Y = -Cam_Y, Three_Z = -Cam_Z
          const pos: [number, number, number] = [rawPos[0], -rawPos[1], -rawPos[2]];

          // 颜色保持与 2D 视图一致
          const color = track.is_right[currentFrame] === 1 ? '#FF6B6B' : '#00CED1';

          // 如果存在顶点数据并且存在全局 faces，则渲染真实的 MANO mesh；否则抛个异常（或先不渲染）
          const frameVerts = track.verts?.[currentFrame];
          const hasMesh = frameVerts && frameVerts.length > 0 && faces && faces.length > 0;

          // 针对 MANO mesh 的局部坐标取反，因为 MANO 的局部坐标和 OpenCV cam 坐标也是保持一致的
          // 需要在 shader 或 JS 层面反转，以保持视觉对齐
          const flippedVerts = hasMesh ? frameVerts.map(v => [v[0], -v[1], -v[2]]) : [];

          return (
            <group key={track.track_id} position={pos}>
               {hasMesh ? (
                 <ManoMesh position={[0, 0, 0]} color={color} verts={flippedVerts} faces={faces!} />
               ) : (
                 <mesh position={[0, 0, 0]}>
                   <sphereGeometry args={[0.05, 16, 16]} />
                   <meshStandardMaterial color={color} roughness={0.3} />
                 </mesh>
               )}
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

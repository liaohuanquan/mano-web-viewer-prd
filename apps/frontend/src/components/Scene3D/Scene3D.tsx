"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, GizmoHelper, GizmoViewport } from "@react-three/drei";
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import type { ManoTrack } from "@/types/mano";
import styles from "./Scene3D.module.css";
import React from "react";

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
  return <axesHelper args={[0.5]} />;
}

/**
 * 网格地面
 * 辅助空间感知
 */
function Ground() {
  return (
    <gridHelper args={[2, 20, "#2a2a3a", "#1a1a24"]} position={[0, -0.5, 0]} />
  );
}

const ManoMesh = React.memo(({
  position,
  color,
  verts,
  faces,
}: {
  position: [number, number, number];
  color: string;
  verts: number[][];
  faces: number[][];
}) => {
  const meshRef = useRef<THREE.Mesh>(null);

  // 初始化固定拓扑和 BufferAttribute
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const vertices = new Float32Array(778 * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));

    if (faces && faces.length > 0) {
      const indices = new Uint16Array(faces.flat());
      geo.setIndex(new THREE.BufferAttribute(indices, 1));
    }
    return geo;
  }, [faces]);

  // 更新顶点数据
  useEffect(() => {
    if (verts && verts.length === 778) {
      const positionAttribute = geometry.getAttribute("position") as THREE.BufferAttribute;
      const array = positionAttribute.array as Float32Array;
      for (let i = 0; i < 778; i++) {
        array[i * 3]     = verts[i][0];
        array[i * 3 + 1] = -verts[i][1];
        array[i * 3 + 2] = -verts[i][2];
      }
      positionAttribute.needsUpdate = true;
      geometry.computeVertexNormals();
    }
  }, [verts, geometry]);

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
});

ManoMesh.displayName = "ManoMesh";

/**
 * 3D 视图组件
 * 使用 React Three Fiber 渲染手部 3D mesh
 * 支持轨道控制（旋转/缩放/平移）
 */
export default function Scene3D({ currentFrame, tracks, faces }: Scene3DProps) {
  // 计算基础偏移量。OpenCV 坐标系以相机光心为原点，手往往在Z轴远处（例如 Z=2.5m）
  // 导致放在 Threejs 中心时偏离网格中心。我们提取出第一帧的手部位置将它拉回原点附近
  const centerOffset = useMemo((): [number, number, number] => {
    if (!tracks || tracks.length === 0) return [0, 0, 0];
    
    // 寻找整个序列中第一个出现的有效坐标作为偏移基准
    const firstValidTrack = tracks.find(t => t.cam_trans.some(p => p[0] !== 0 || p[1] !== 0 || p[2] !== 0));
    if (!firstValidTrack) return [0, 0, 0];

    const firstValidPos = firstValidTrack.cam_trans.find(p => p[0] !== 0 || p[1] !== 0 || p[2] !== 0);
    if (!firstValidPos) return [0, 0, 0];

    return [firstValidPos[0], -firstValidPos[1], -firstValidPos[2]];
  }, [tracks]);

  const controlsRef = useRef<React.ElementRef<typeof OrbitControls>>(null);

  /** 重置相机视角到默认位置 */
  const handleResetView = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  // 打印调试信息
  useEffect(() => {
    // 仅在调试时检查数据
  }, [currentFrame, tracks]);

  return (
    <div className={styles.container}>

      {/* 重置视角按钮 */}
      <button className={styles.resetButton} onClick={handleResetView}>
        重置视角
      </button>

      <Canvas
        camera={{
          position: [0, 0.3, 1.5],
          fov: 50,
          near: 0.01,
          far: 100,
        }}
        dpr={1} // 锁定像素比，减轻显卡压力
        gl={{
          antialias: false, // 关闭抗锯齿，大幅提升性能
          alpha: false,
          powerPreference: "high-performance",
        }}
        style={{ background: "#0a0a0f" }}
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
          const totalTrackFrames = track.cam_trans?.length || 0;
          if (totalTrackFrames === 0) return null;

          // 计算插值参数
          const frameInt = Math.floor(currentFrame);
          const frameNext = Math.min(totalTrackFrames - 1, frameInt + 1);
          const alpha = currentFrame % 1;

          // 1. 插值位置 (cam_trans)
          const p1 = track.cam_trans?.[frameInt];
          const p2 = track.cam_trans?.[frameNext];
          
          if (!p1 || !p2 || (p1[0] === 0 && p1[1] === 0 && p1[2] === 0)) return null;

          // 线性插值坐标
          const interpolatedPos: [number, number, number] = [
            (p1[0] + (p2[0] - p1[0]) * alpha) - centerOffset[0],
            -(p1[1] + (p2[1] - p1[1]) * alpha) - centerOffset[1] + 0.1,
            -(p1[2] + (p2[2] - p1[2]) * alpha) - centerOffset[2],
          ];

          // 颜色与左右手设置
          const isRight = track.is_right[frameInt] === 1;
          const color = isRight ? "#FF6B6B" : "#00CED1";

          // 2. 插值顶点 (verts)
          const v1 = track.verts?.[frameInt];
          const v2 = track.verts?.[frameNext];
          let interpolatedVerts: number[][] | undefined = undefined;

          if (v1 && v2 && v1.length === 778 && v2.length === 778) {
            interpolatedVerts = v1.map((v, i) => [
              v[0] + (v2[i][0] - v[0]) * alpha,
              v[1] + (v2[i][1] - v[1]) * alpha,
              v[2] + (v2[i][2] - v[2]) * alpha,
            ]);
          }

          const hasMesh = interpolatedVerts && faces && faces.length > 0;

          return (
            <group key={track.track_id} position={interpolatedPos}>
              {hasMesh ? (
                <group scale={[isRight ? 1 : -1, 1, 1]}>
                  <ManoMesh
                    position={[0, 0, 0]}
                    color={color}
                    verts={interpolatedVerts!}
                    faces={faces!}
                  />
                </group>
              ) : (
                <mesh position={[0, 0, 0]}>
                  <sphereGeometry args={[0.05, 16, 16]} />
                  <meshStandardMaterial color={color} roughness={0.3} />
                </mesh>
              )}
            </group>
          );
        })}

        {/* 轨道控制器 */}
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={0.3}
          maxDistance={10}
        />

        {/* 视角指示器 */}
        <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
          <GizmoViewport
            axisColors={["#FF4060", "#40FF60", "#4060FF"]}
            labelColor="white"
          />
        </GizmoHelper>
      </Canvas>
    </div>
  );
}

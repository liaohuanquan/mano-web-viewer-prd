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
  /** 是否开启插值 */
  interpolationEnabled?: boolean;
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

/**
 * 数据坐标中的相机标记
 * 用小坐标轴 + 锥体表示相机位置与朝向
 */
function DataCameraMarker({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <axesHelper args={[0.18]} />
      <mesh position={[0, 0, 0.06]}>
        <sphereGeometry args={[0.015, 12, 12]} />
        <meshStandardMaterial color="#ffd166" emissive="#6b5310" emissiveIntensity={0.7} />
      </mesh>
      {/* OpenCV 前向通常为 +Z；当前场景做了 z 反向，因此锥体朝向 -Z */}
      <mesh position={[0, 0, -0.09]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.06, 0.18, 24, 1, true]} />
        <meshStandardMaterial color="#ffd166" wireframe transparent opacity={0.7} />
      </mesh>
    </group>
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

/** MANO 关节索引常量 */
const JOINT_WRIST = 0;
const JOINT_MIDDLE1 = 4; // 中指MCP关节（第一排指关节）

/**
 * 计算第一帧手部位置作为世界坐标原点偏移量
 * 取第一个有效帧的 cam_trans 作为原点
 */
function computeOriginOffset(tracks: ManoTrack[]): [number, number, number] {
  for (const track of tracks) {
    if (!track.cam_trans || track.cam_trans.length === 0) continue;
    const pos = track.cam_trans[0];
    if (pos[0] !== 0 || pos[1] !== 0 || pos[2] !== 0) {
      // OpenCV -> Three.js 坐标转换 (Y, Z 翻转)
      return [pos[0], -pos[1], -pos[2]];
    }
  }
  return [0, 0, 0];
}

/**
 * 计算 3D 空间中两点距离（米），转换为 cm
 */
function distance3D(a: [number, number, number], b: [number, number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz) * 100; // 米转厘米
}

/**
 * 计算当前帧的测量数据
 */
function computeMetrics(
  tracks: ManoTrack[],
  currentFrame: number,
  interpolationEnabled: boolean,
) {
  const frameInt = Math.floor(currentFrame);
  const alpha = interpolationEnabled ? (currentFrame % 1) : 0;

  let leftCamDist: number | null = null;
  let rightCamDist: number | null = null;
  let leftBackLen: number | null = null;
  let rightBackLen: number | null = null;

  // 相机在原始坐标系中位于 (0,0,0)
  const camPos: [number, number, number] = [0, 0, 0];

  for (const track of tracks) {
    const totalFrames = track.cam_trans?.length || 0;
    if (totalFrames === 0) continue;
    const frameNext = Math.min(totalFrames - 1, frameInt + 1);

    const p1 = track.cam_trans?.[frameInt];
    const p2 = track.cam_trans?.[frameNext];
    if (!p1 || !p2 || (p1[0] === 0 && p1[1] === 0 && p1[2] === 0)) continue;

    // 手根部(cam_trans)在原始坐标系中的位置
    const handRoot: [number, number, number] = [
      p1[0] + (p2[0] - p1[0]) * alpha,
      p1[1] + (p2[1] - p1[1]) * alpha,
      p1[2] + (p2[2] - p1[2]) * alpha,
    ];

    // 相机到手根部距离
    const dist = distance3D(camPos, handRoot);

    // 手背长度：手腕(joint 0) 到 中指MCP(joint 4) 的距离
    let backLen: number | null = null;
    const j1 = track.joints?.[frameInt];
    const j2 = track.joints?.[frameNext];
    if (j1 && j2 && j1.length >= 16 && j2.length >= 16) {
      const wrist = [
        j1[JOINT_WRIST][0] + (j2[JOINT_WRIST][0] - j1[JOINT_WRIST][0]) * alpha,
        j1[JOINT_WRIST][1] + (j2[JOINT_WRIST][1] - j1[JOINT_WRIST][1]) * alpha,
        j1[JOINT_WRIST][2] + (j2[JOINT_WRIST][2] - j1[JOINT_WRIST][2]) * alpha,
      ] as [number, number, number];
      const mcp = [
        j1[JOINT_MIDDLE1][0] + (j2[JOINT_MIDDLE1][0] - j1[JOINT_MIDDLE1][0]) * alpha,
        j1[JOINT_MIDDLE1][1] + (j2[JOINT_MIDDLE1][1] - j1[JOINT_MIDDLE1][1]) * alpha,
        j1[JOINT_MIDDLE1][2] + (j2[JOINT_MIDDLE1][2] - j1[JOINT_MIDDLE1][2]) * alpha,
      ] as [number, number, number];
      backLen = distance3D(wrist, mcp);
    }

    const isRight = track.is_right[frameInt] === 1;
    if (isRight) {
      rightCamDist = dist;
      rightBackLen = backLen;
    } else {
      leftCamDist = dist;
      leftBackLen = backLen;
    }
  }

  return { leftCamDist, rightCamDist, leftBackLen, rightBackLen };
}

/**
 * 3D 视图组件
 * 使用 React Three Fiber 渲染手部 3D mesh
 * 支持轨道控制（旋转/缩放/平移）
 */
export default function Scene3D({ 
  currentFrame, 
  tracks, 
  faces,
  interpolationEnabled = false 
}: Scene3DProps) {
  // 以第一帧手部位置作为世界坐标原点
  const originOffset = useMemo(() => computeOriginOffset(tracks), [tracks]);

  const controlsRef = useRef<React.ElementRef<typeof OrbitControls>>(null);

  /** 重置相机视角到默认位置 */
  const handleResetView = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  // 计算相机在新坐标系下的位置（原始相机在 0,0,0，减去原点偏移）
  const dataCameraPos: [number, number, number] = useMemo(() => [
    -originOffset[0],
    -originOffset[1],
    -originOffset[2],
  ], [originOffset]);

  // 计算当前帧的测量数据
  const metrics = useMemo(
    () => computeMetrics(tracks, currentFrame, interpolationEnabled),
    [tracks, currentFrame, interpolationEnabled]
  );

  /** 格式化数值显示 */
  const fmt = (v: number | null) => v !== null ? v.toFixed(1) : '--';

  return (
    <div className={styles.container}>

      {/* 重置视角按钮 */}
      <button className={styles.resetButton} onClick={handleResetView}>
        重置视角
      </button>

      {/* 测量数据面板 */}
      <div className={styles.metricsPanel}>
        <div className={styles.metricsTitle}>测量数据</div>
        <div className={styles.metricsRow}>
          <span className={styles.metricsLabel}>📷↔🤚 左手距离</span>
          <span className={styles.metricsValue}>{fmt(metrics.leftCamDist)} cm</span>
        </div>
        <div className={styles.metricsRow}>
          <span className={styles.metricsLabel}>📷↔✋ 右手距离</span>
          <span className={styles.metricsValue}>{fmt(metrics.rightCamDist)} cm</span>
        </div>
        <div className={styles.metricsDivider} />
        <div className={styles.metricsRow}>
          <span className={styles.metricsLabel}>🤚 左手背长</span>
          <span className={styles.metricsValue}>{fmt(metrics.leftBackLen)} cm</span>
        </div>
        <div className={styles.metricsRow}>
          <span className={styles.metricsLabel}>✋ 右手背长</span>
          <span className={styles.metricsValue}>{fmt(metrics.rightBackLen)} cm</span>
        </div>
      </div>

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

        {/* 坐标轴（世界原点 = 第一帧手部位置） */}
        <CameraAxes />

        {/* 网格地面 */}
        <Ground />

        {/* 数据相机位置标记：相对于新世界原点的偏移位置 */}
        <DataCameraMarker position={dataCameraPos} />

        {/* 动态手部渲染 */}
        {tracks.map((track) => {
          const totalTrackFrames = track.cam_trans?.length || 0;
          if (totalTrackFrames === 0) return null;

          // 计算插值参数
          const frameInt = Math.floor(currentFrame);
          const frameNext = Math.min(totalTrackFrames - 1, frameInt + 1);
          const alpha = interpolationEnabled ? (currentFrame % 1) : 0;

          // 1. 插值位置 (cam_trans)
          const p1 = track.cam_trans?.[frameInt];
          const p2 = track.cam_trans?.[frameNext];
          
          if (!p1 || !p2 || (p1[0] === 0 && p1[1] === 0 && p1[2] === 0)) return null;

          // 相机坐标 -> Three.js 坐标（Y, Z 翻转），再减去原点偏移
          const interpolatedPos: [number, number, number] = [
            (p1[0] + (p2[0] - p1[0]) * alpha) - originOffset[0],
            -(p1[1] + (p2[1] - p1[1]) * alpha) - originOffset[1],
            -(p1[2] + (p2[2] - p1[2]) * alpha) - originOffset[2],
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

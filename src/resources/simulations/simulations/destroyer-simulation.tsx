'use client';

/**
 * 055型驱逐舰航向控制仿真
 * 模块化重构版本 - 使用统一物理引擎和控制器
 */

import { useState, useRef, useCallback, useEffect, useMemo, useLayoutEffect } from 'react';
import { Canvas, useFrame, useThree, extend, type ReactThreeFiber } from '@react-three/fiber';
import { Line, useGLTF, PerspectiveCamera, shaderMaterial, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import {
  Play,
  Pause,
  RotateCcw,
  Settings,
  ChevronLeft,
  ChevronRight,
  Target,
  Compass,
  Gauge,
  Timer,
} from 'lucide-react';
import { Chart, registerables } from 'chart.js';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';

import { destroyer055Profile } from '../profiles/destroyer-055';
import {
  createNomotoState,
  nomotoStep,
  nomotoToSimulationState,
  createPIDState,
  pidControl,
  type NomotoState,
  type PIDControllerState,
} from '../physics/models/nomoto-1st-order';
import type { ControlMode, PIDGains } from '../core/types';
import {
  clamp,
  toRadians,
  toDegrees,
  angleDelta,
  DEFAULT_NOMOTO_PARAMS,
  DEFAULT_PID_GAINS,
} from '../core/constants';
import {
  UnifiedCameraController,
  CameraViewSwitcher,
  type CameraMode,
} from '../components';

Chart.register(...registerables);

// ============ 类型定义 ============

type TaskScenario = 'turn90' | 'obstacle' | 'circle';

interface TaskDef {
  id: string;
  title: string;
  scenario: TaskScenario;
  duration: number;
  description: string;
}

interface HudState {
  heading: number;
  yawRate: number;
  rudder: number;
  speed: number;
  position: { x: number; z: number };
  avgError: number;
  currentError: number;
  time: number;
}

interface ChartData {
  time: number[];
  desiredHeading: number[];
  actualHeading: number[];
  speed: number[];
  rudder: number[];
}

interface HeadingPoint {
  time: number;
  heading: number;
}

interface SimulationState {
  position: THREE.Vector3;
  headingRad: number;
  yawRateRad: number;
  rudderDeg: number;
  manualRudderDeg: number;
  speedMps: number;
  integral: number;
  prevErrorRad: number;
  waveY: number;
  wavePitch: number;
  waveRoll: number;
}

// ============ 常量 ============

const nomotoParams = destroyer055Profile.dynamics.nomoto ?? DEFAULT_NOMOTO_PARAMS;

const shipDimensions = {
  length: destroyer055Profile.dimensions.length,
  width: destroyer055Profile.dimensions.beam,
};

const waveParams = [
  { amplitude: 1.2, frequency: 0.018, speed: 0.9, direction: { x: 1.0, z: 0.1 } },
  { amplitude: 0.9, frequency: 0.035, speed: 1.1, direction: { x: 0.4, z: 0.9 } },
  { amplitude: 0.6, frequency: 0.06, speed: 1.3, direction: { x: -0.6, z: 0.5 } },
  { amplitude: 0.35, frequency: 0.12, speed: 1.6, direction: { x: 0.3, z: -0.7 } },
  { amplitude: 0.15, frequency: 0.25, speed: 2.0, direction: { x: -0.5, z: -0.6 } },
];

const REF_SPEED = nomotoParams.speedMps;

const tasks: TaskDef[] = [
  {
    id: 'turn-90',
    title: '直角转向任务',
    scenario: 'turn90',
    duration: 180,
    description: '60秒后执行90度右转阶跃信号。',
  },
  {
    id: 'obstacle',
    title: '复杂避障任务',
    scenario: 'obstacle',
    duration: 180,
    description: '依次执行 0° → 45° → 0° → -45° → 0° 变向。',
  },
  {
    id: 'circle',
    title: '定常回转任务',
    scenario: 'circle',
    duration: 360,
    description: '切入圆形航迹并执行定常回转。',
  },
];


// ============ 工具函数 ============

function getWaveHeight(x: number, z: number, time: number): number {
  let y = 0;
  waveParams.forEach((wave) => {
    const phase = (x * wave.direction.x + z * wave.direction.z) * wave.frequency + time * wave.speed;
    y += wave.amplitude * Math.sin(phase);
  });
  return y;
}

const normalizeHeading = (heading: number) => ((heading % 360) + 360) % 360;

const normalizeSignedHeading = (heading: number) => {
  const normalized = normalizeHeading(heading);
  return normalized > 180 ? normalized - 360 : normalized;
};

type ScenarioLogic = {
  getDesiredHeading: (t: number) => number;
  startPos: { x: number; z: number; headingDeg: number };
};

const getScenarioLogic = (scenario: TaskScenario): ScenarioLogic => {
  switch (scenario) {
    case 'turn90':
      return {
        startPos: { x: -6000, z: 0, headingDeg: 0 },
        getDesiredHeading: (t: number) => (t < 60 ? 0 : 90),
      };
    case 'obstacle':
      return {
        startPos: { x: -2000, z: 0, headingDeg: 0 },
        getDesiredHeading: (t: number) => {
          if (t < 60) return 0;
          if (t < 90) return 45;
          if (t < 120) return 0;
          if (t < 150) return -45;
          return 0;
        },
      };
    case 'circle':
      const radius = 1350;
      const circumference = 2 * Math.PI * radius;
      const turnTime = circumference / REF_SPEED;
      const degPerSec = 360 / turnTime;
      return {
        startPos: { x: 0, z: -(radius + 900), headingDeg: 0 },
        getDesiredHeading: (t: number) => (t < 60 ? 0 : -90 + degPerSec * (t - 60)),
      };
  }
};

const generateGuidePath = (logic: ScenarioLogic, duration: number) => {
  const points: THREE.Vector3[] = [];
  let x = logic.startPos.x;
  let z = logic.startPos.z;
  const dt = 0.5;

  points.push(new THREE.Vector3(x, 0.5, z));

  for (let t = 0; t <= duration; t += dt) {
    const headingDeg = logic.getDesiredHeading(t);
    const headingRad = toRadians(headingDeg);
    x += REF_SPEED * Math.cos(headingRad) * dt;
    z += REF_SPEED * Math.sin(headingRad) * dt;
    points.push(new THREE.Vector3(x, 0.5, z));
  }
  return points;
};

const getCrossTrackError = (position: THREE.Vector3, guidePath: THREE.Vector3[]) => {
  if (guidePath.length < 2) return 0;

  let minDist = Infinity;
  for (let i = 0; i < guidePath.length - 1; i++) {
    const a = guidePath[i];
    const b = guidePath[i + 1];
    const ab = new THREE.Vector3().subVectors(b, a);
    const ap = new THREE.Vector3().subVectors(position, a);
    const t = clamp(ap.dot(ab) / ab.dot(ab), 0, 1);
    const closest = a.clone().add(ab.multiplyScalar(t));
    const dist = position.distanceTo(closest);
    if (dist < minDist) minDist = dist;
  }

  return minDist;
};

// ============ 着色器材质 ============

const WaterShaderMaterial = shaderMaterial(
  {
    uTime: 0,
    uColor: new THREE.Color('#124060'),
    uFoamColor: new THREE.Color('#ffffff'),
    uSunPosition: new THREE.Vector3(200, 150, 200),
  },
  // Vertex Shader
  `
    uniform float uTime;
    varying vec2 vUv;
    varying float vElevation;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    const int WAVE_COUNT = 5;

    const float waves[25] = float[](
      1.2, 0.018, 0.9, 1.0, 0.1,
      0.9, 0.035, 1.1, 0.4, 0.9,
      0.6, 0.06,  1.3, -0.6, 0.5,
      0.35, 0.12, 1.6, 0.3, -0.7,
      0.15, 0.25, 2.0, -0.5, -0.6
    );

    void main() {
      vUv = uv;
      vec3 pos = position;
      float elevation = 0.0;
      float dHdx = 0.0;
      float dHdz = 0.0;

      for(int i = 0; i < WAVE_COUNT; i++) {
        int idx = i * 5;
        float amp = waves[idx];
        float freq = waves[idx + 1];
        float speed = waves[idx + 2];
        float dx = waves[idx + 3];
        float dz = waves[idx + 4];

        float phase = (pos.x * dx + pos.z * dz) * freq + uTime * speed;
        elevation += amp * sin(phase);

        float derivative = amp * cos(phase) * freq;
        dHdx += derivative * dx;
        dHdz += derivative * dz;
      }

      pos.y += elevation;
      vElevation = elevation;

      vec3 normal = normalize(vec3(-dHdx, 1.0, -dHdz));
      vNormal = normalMatrix * normal;

      vec4 modelPosition = modelMatrix * vec4(pos, 1.0);
      vec4 viewPosition = viewMatrix * modelPosition;
      vViewPosition = viewPosition.xyz;

      gl_Position = projectionMatrix * viewPosition;
    }
  `,
  // Fragment Shader
  `
    uniform vec3 uColor;
    uniform vec3 uFoamColor;
    uniform vec3 uSunPosition;

    varying float vElevation;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec2 vUv;

    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    float noise(vec2 st) {
      vec2 i = floor(st);
      vec2 f = fract(st);
      float a = random(i);
      float b = random(i + vec2(1.0, 0.0));
      float c = random(i + vec2(0.0, 1.0));
      float d = random(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }

    void main() {
      vec3 viewDirection = normalize(-vViewPosition);
      vec3 normal = normalize(vNormal);
      vec3 sunDir = normalize(uSunPosition);

      float light = max(dot(normal, sunDir), 0.0);
      float specular = pow(max(dot(reflect(-sunDir, normal), viewDirection), 0.0), 64.0);
      float fresnel = pow(1.0 - max(dot(viewDirection, normal), 0.0), 3.0);

      float noiseVal = noise(vUv * 300.0);
      float foamThreshold = 0.9;
      float foamFactor = smoothstep(foamThreshold, foamThreshold + 0.3, vElevation + noiseVal * 0.4);

      vec3 waterColor = mix(uColor * 0.5, uColor * 1.3, light * 0.7 + 0.3);
      vec3 finalColor = mix(waterColor, vec3(0.7, 0.85, 0.95), fresnel * 0.4);
      finalColor += vec3(specular * 0.4);
      finalColor = mix(finalColor, uFoamColor, foamFactor * 0.85);

      gl_FragColor = vec4(finalColor, 0.92);

      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `
);

extend({ WaterShaderMaterial });

// 类型声明在 environment/wave-water.tsx 中定义

// ============ 3D 组件 ============

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

function SkyDome() {
  const geometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(10000, 64, 64);
    const colors: number[] = [];
    const positions = geo.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      const normalizedY = (y / 10000 + 1) / 2;

      const horizonColor = new THREE.Color('#d4e8f7');
      const zenithColor = new THREE.Color('#4a7ba7');
      const blendFactor = Math.pow(Math.max(0, normalizedY - 0.5) * 2, 0.6);
      const color = horizonColor.clone().lerp(zenithColor, blendFactor);

      colors.push(color.r, color.g, color.b);
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }, []);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} />
    </mesh>
  );
}

function ProceduralClouds() {
  const cloudsRef = useRef<THREE.InstancedMesh>(null);

  const cloudInstances = useMemo(() => {
    const random = seededRandom(42);
    const instances: Array<{
      position: THREE.Vector3;
      scale: THREE.Vector3;
      rotation: number;
    }> = [];

    for (let i = 0; i < 50; i++) {
      const angle = random() * Math.PI * 2;
      const distance = 3000 + random() * 4000;
      const height = 800 + random() * 600;
      const size = 80 + random() * 150;

      instances.push({
        position: new THREE.Vector3(
          Math.cos(angle) * distance,
          height,
          Math.sin(angle) * distance
        ),
        scale: new THREE.Vector3(size, size * 0.4, size * 0.7),
        rotation: random() * Math.PI * 2,
      });
    }

    return instances;
  }, []);

  useLayoutEffect(() => {
    if (!cloudsRef.current) return;

    const tempMatrix = new THREE.Matrix4();
    cloudInstances.forEach((cloud, i) => {
      tempMatrix.makeRotationY(cloud.rotation);
      tempMatrix.setPosition(cloud.position);
      tempMatrix.scale(cloud.scale);
      cloudsRef.current!.setMatrixAt(i, tempMatrix);
    });

    cloudsRef.current.instanceMatrix.needsUpdate = true;
  }, [cloudInstances]);

  return (
    <instancedMesh ref={cloudsRef} args={[undefined, undefined, 50]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.8} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

function WaveWater({ simRef }: { simRef: React.MutableRefObject<SimulationState> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => new THREE.PlaneGeometry(60000, 60000, 512, 512), []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    if (meshRef.current) {
      meshRef.current.position.x = simRef.current.position.x;
      meshRef.current.position.z = simRef.current.position.z;
    }

    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = time;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
      <waterShaderMaterial ref={materialRef} side={THREE.DoubleSide} transparent />
    </mesh>
  );
}

function GridHelper({ simRef }: { simRef: React.MutableRefObject<SimulationState> }) {
  const gridRef = useRef<THREE.Group>(null);
  const gridSize = 100;
  const gridExtent = 50;

  const lines = useMemo(() => {
    const linePoints: THREE.Vector3[][] = [];
    const halfExtent = gridExtent / 2;
    const gridHeight = 4;

    for (let x = -halfExtent; x <= halfExtent; x++) {
      linePoints.push([
        new THREE.Vector3(x * gridSize, gridHeight, -halfExtent * gridSize),
        new THREE.Vector3(x * gridSize, gridHeight, halfExtent * gridSize),
      ]);
    }

    for (let z = -halfExtent; z <= halfExtent; z++) {
      linePoints.push([
        new THREE.Vector3(-halfExtent * gridSize, gridHeight, z * gridSize),
        new THREE.Vector3(halfExtent * gridSize, gridHeight, z * gridSize),
      ]);
    }

    return linePoints;
  }, []);

  useFrame(() => {
    if (!gridRef.current) return;
    const sim = simRef.current;

    const snappedX = Math.round(sim.position.x / gridSize) * gridSize;
    const snappedZ = Math.round(sim.position.z / gridSize) * gridSize;

    gridRef.current.position.set(snappedX, 0, snappedZ);
  });

  return (
    <group ref={gridRef}>
      {lines.map((points, i) => (
        <Line key={i} points={points} color="#88ccff" lineWidth={1.0} transparent opacity={0.35} />
      ))}
    </group>
  );
}

function GuideRoute({ points }: { points: THREE.Vector3[] }) {
  if (!points || points.length < 2) return null;
  return <Line points={points} color="#ef4444" lineWidth={3} dashed={false} />;
}

function ShipTrail({
  simRef,
  resetToken,
}: {
  simRef: React.MutableRefObject<SimulationState>;
  resetToken: number;
}) {
  const [points, setPoints] = useState<THREE.Vector3[]>([]);
  const lastRecordRef = useRef(0);

  useEffect(() => {
    setPoints([]);
    lastRecordRef.current = 0;
  }, [resetToken]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (time - lastRecordRef.current < 0.25) return;
    lastRecordRef.current = time;

    setPoints((prev) => {
      const next = [...prev, simRef.current.position.clone().setY(0.7)];
      return next.length > 4000 ? next.slice(-4000) : next;
    });
  });

  if (points.length < 2) return null;

  return <Line points={points} color="#22c55e" lineWidth={2} />;
}

function ShipWake({ simRef }: { simRef: React.MutableRefObject<SimulationState> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const wakeLength = 150;
  const wakeWidth = 35;
  const segments = 12;

  const { geometry } = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    positions.push(0, 0.5, 0);
    colors.push(1, 1, 1, 0.85);

    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const x = -t * wakeLength;
      const spreadHalf = t * wakeWidth * 0.5;
      const alpha = (1 - t) * 0.7;

      positions.push(x, 0.3, spreadHalf);
      colors.push(1, 1, 1, alpha);

      positions.push(x, 0.3, -spreadHalf);
      colors.push(1, 1, 1, alpha);
    }

    indices.push(0, 1, 2);

    for (let i = 1; i < segments; i++) {
      const leftCurr = i * 2 - 1;
      const rightCurr = i * 2;
      const leftNext = (i + 1) * 2 - 1;
      const rightNext = (i + 1) * 2;

      indices.push(leftCurr, leftNext, rightNext);
      indices.push(leftCurr, rightNext, rightCurr);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    return { geometry: geo };
  }, []);

  useFrame(() => {
    if (!meshRef.current) return;
    const sim = simRef.current;

    meshRef.current.position.set(sim.position.x, 0, sim.position.z);
    meshRef.current.rotation.y = -sim.headingRad + Math.PI / 2 + Math.PI;
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshBasicMaterial vertexColors transparent side={THREE.DoubleSide} />
    </mesh>
  );
}

/** 驱逐舰3D模型 */
function DestroyerModel({
  simRef,
}: {
  simRef: React.MutableRefObject<SimulationState>;
}) {
  const { scene } = useGLTF('/assets/destroyer.glb');
  const groupRef = useRef<THREE.Group>(null);

  const { model, scale, modelHeight } = useMemo(() => {
    const cloned = scene.clone(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    cloned.position.sub(center);

    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const targetLength = shipDimensions.length;
    const calculatedScale = targetLength / maxDim;

    return { model: cloned, scale: calculatedScale, modelHeight: size.y * calculatedScale };
  }, [scene]);

  useFrame(() => {
    if (!groupRef.current) return;
    const sim = simRef.current;

    groupRef.current.position.set(sim.position.x, sim.waveY + modelHeight * 0.5, sim.position.z);
    groupRef.current.rotation.set(sim.wavePitch, -sim.headingRad + Math.PI / 2, sim.waveRoll);
  });

  return (
    <group ref={groupRef}>
      <primitive object={model} scale={scale} />
    </group>
  );
}

useGLTF.preload('/assets/destroyer.glb');


/** 仿真物理引擎 */
function SimulationEngine({
  simRef,
  shipRef,
  isRunning,
  controlMode,
  pidGains,
  headingPoints,
  duration,
  guidePath,
  onHudUpdate,
  onChartDataUpdate,
}: {
  simRef: React.MutableRefObject<SimulationState>;
  shipRef: React.MutableRefObject<THREE.Group | null>;
  isRunning: boolean;
  controlMode: ControlMode;
  pidGains: PIDGains;
  headingPoints: HeadingPoint[];
  duration: number;
  guidePath: THREE.Vector3[];
  onHudUpdate: (state: HudState) => void;
  onChartDataUpdate: (time: number, desired: number, actual: number, speed: number, rudder: number) => void;
}) {
  const lastFrameTimeRef = useRef(0);
  const simTimeRef = useRef(0);
  const lastHudUpdateRef = useRef(0);
  const lastChartSampleRef = useRef(0);
  const totalErrorRef = useRef(0);
  const errorSampleCountRef = useRef(0);

  const interpolateHeading = useCallback(
    (t: number) => {
      if (headingPoints.length === 0) return 0;
      const sorted = [...headingPoints].sort((a, b) => a.time - b.time);
      if (t <= sorted[0].time) return sorted[0].heading;
      const lastPoint = sorted[sorted.length - 1];
      if (t >= lastPoint.time) return lastPoint.heading;
      for (let i = 0; i < sorted.length - 1; i++) {
        const start = sorted[i];
        const end = sorted[i + 1];
        if (t <= end.time) {
          const span = end.time - start.time;
          if (span <= 0.0001) return end.heading;
          const ratio = (t - start.time) / span;
          return start.heading + ratio * (end.heading - start.heading);
        }
      }
      return lastPoint.heading;
    },
    [headingPoints]
  );

  useFrame((state) => {
    if (!isRunning) {
      lastFrameTimeRef.current = state.clock.getElapsedTime();
      return;
    }

    const elapsedTime = state.clock.getElapsedTime();
    const frameDt = elapsedTime - lastFrameTimeRef.current;
    lastFrameTimeRef.current = elapsedTime;

    if (frameDt <= 0 || frameDt > 0.5) return;

    const dt = Math.min(frameDt, 0.05);
    simTimeRef.current += dt;
    const simTime = simTimeRef.current;

    if (simTime > duration) return;

    const sim = simRef.current;
    const targetHeading = interpolateHeading(simTime);

    // PID 控制
    if (controlMode === 'manual') {
      sim.rudderDeg = sim.manualRudderDeg;
    } else {
      const currentHeading = normalizeHeading(toDegrees(sim.headingRad));
      const errorDeg = angleDelta(targetHeading, currentHeading);
      const errorRad = toRadians(errorDeg);
      const derivative = (errorRad - sim.prevErrorRad) / dt;
      sim.integral += errorRad * dt;

      let kp = pidGains.kp;
      let ki = pidGains.ki;
      let kd = pidGains.kd;
      if (controlMode === 'p') {
        ki = 0;
        kd = 0;
      } else if (controlMode === 'pd') {
        ki = 0;
      }

      const deltaRad = kp * errorRad + ki * sim.integral + kd * derivative;
      sim.rudderDeg = clamp(toDegrees(deltaRad), -nomotoParams.maxRudderDeg, nomotoParams.maxRudderDeg);
      sim.prevErrorRad = errorRad;
    }

    // Nomoto 动力学
    const rudderRad = toRadians(sim.rudderDeg);
    sim.yawRateRad += ((nomotoParams.K * rudderRad - sim.yawRateRad) / nomotoParams.T) * dt;
    sim.headingRad += sim.yawRateRad * dt;

    sim.position.x += sim.speedMps * Math.cos(sim.headingRad) * dt;
    sim.position.z += sim.speedMps * Math.sin(sim.headingRad) * dt;

    // 波浪运动
    const posX = sim.position.x;
    const posZ = sim.position.z;
    const heading = sim.headingRad;
    const halfLength = shipDimensions.length / 2;
    const halfWidth = shipDimensions.width / 2;
    const cosH = Math.cos(heading);
    const sinH = Math.sin(heading);

    const centerY = getWaveHeight(posX, posZ, elapsedTime);
    const bowY = getWaveHeight(posX + cosH * halfLength, posZ + sinH * halfLength, elapsedTime);
    const sternY = getWaveHeight(posX - cosH * halfLength, posZ - sinH * halfLength, elapsedTime);
    const portY = getWaveHeight(posX - sinH * halfWidth, posZ + cosH * halfWidth, elapsedTime);
    const starboardY = getWaveHeight(posX + sinH * halfWidth, posZ - cosH * halfWidth, elapsedTime);

    const targetPitch = Math.atan2(bowY - sternY, shipDimensions.length);
    const targetRoll = Math.atan2(portY - starboardY, shipDimensions.width);

    const heaveLerp = 0.02;
    const rotLerp = 0.02;

    sim.waveY = THREE.MathUtils.lerp(sim.waveY, centerY, heaveLerp);
    sim.wavePitch = THREE.MathUtils.lerp(sim.wavePitch, targetPitch, rotLerp);
    sim.waveRoll = THREE.MathUtils.lerp(sim.waveRoll, targetRoll, rotLerp);

    // 误差计算
    const currentError = getCrossTrackError(sim.position, guidePath);
    if (simTime > 0) {
      totalErrorRef.current += currentError;
      errorSampleCountRef.current += 1;
    }
    const avgError = errorSampleCountRef.current > 0 ? totalErrorRef.current / errorSampleCountRef.current : 0;

    // HUD 更新
    if (elapsedTime - lastHudUpdateRef.current > 0.1) {
      lastHudUpdateRef.current = elapsedTime;
      onHudUpdate({
        heading: normalizeHeading(toDegrees(sim.headingRad)),
        yawRate: toDegrees(sim.yawRateRad),
        rudder: sim.rudderDeg,
        speed: sim.speedMps,
        position: { x: sim.position.x, z: sim.position.z },
        avgError,
        currentError,
        time: simTime,
      });
    }

    // 图表数据
    if (simTime - lastChartSampleRef.current > 0.5) {
      lastChartSampleRef.current = simTime;
      const headingDeg = normalizeSignedHeading(toDegrees(sim.headingRad));
      const targetHeadingSigned = normalizeSignedHeading(targetHeading);
      onChartDataUpdate(simTime, targetHeadingSigned, headingDeg, sim.speedMps, sim.rudderDeg);
    }
  });

  return null;
}

// ============ UI 组件 ============

/** HUD 显示 */
function HUD({
  state,
  isRunning,
  controlMode,
}: {
  state: HudState;
  isRunning: boolean;
  controlMode: ControlMode;
}) {
  return (
    <div className="absolute left-4 top-4 space-y-2">
      <Card className="bg-slate-900/90 border-slate-700 w-56">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Compass className="w-4 h-4 text-cyan-400" />
            导航状态
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-3 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">航向</span>
            <span className="text-cyan-300 font-mono">{state.heading.toFixed(1)}°</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">转艏速率</span>
            <span className="text-cyan-300 font-mono">{state.yawRate.toFixed(2)}°/s</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">舵角</span>
            <span className="text-cyan-300 font-mono">{state.rudder.toFixed(1)}°</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">航速</span>
            <span className="text-cyan-300 font-mono">{state.speed.toFixed(1)} m/s</span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/90 border-slate-700 w-56">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="w-4 h-4 text-green-400" />
            航迹误差
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-3 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">当前误差</span>
            <span className="text-green-300 font-mono">{state.currentError.toFixed(1)} m</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">平均误差</span>
            <span className="text-green-300 font-mono">{state.avgError.toFixed(1)} m</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">仿真时间</span>
            <span className="text-green-300 font-mono">{state.time.toFixed(1)} s</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-xs">
        <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
        <span className="text-slate-400">{isRunning ? '运行中' : '已暂停'}</span>
        <span className="text-slate-500">|</span>
        <span className="text-cyan-400 uppercase">{controlMode}</span>
      </div>
    </div>
  );
}

/** 控制面板 */
function ControlPanel({
  isRunning,
  controlMode,
  pidGains,
  cameraMode,
  selectedTask,
  onStart,
  onPause,
  onReset,
  onControlModeChange,
  onPidGainsChange,
  onCameraModeChange,
  onTaskChange,
  onShowChart,
}: {
  isRunning: boolean;
  controlMode: ControlMode;
  pidGains: PIDGains;
  cameraMode: CameraMode;
  selectedTask: number;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onControlModeChange: (mode: ControlMode) => void;
  onPidGainsChange: (gains: PIDGains) => void;
  onCameraModeChange: (mode: CameraMode) => void;
  onTaskChange: (index: number) => void;
  onShowChart: () => void;
}) {
  return (
    <div className="absolute right-4 top-4 w-72">
      <Card className="bg-slate-900/90 border-slate-700">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="w-4 h-4" />
            控制面板
          </CardTitle>
        </CardHeader>
        <CardContent className="py-3 px-4 space-y-4">
          {/* 任务选择 */}
          <div className="space-y-2">
            <Label className="text-xs text-slate-400">任务选择</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => onTaskChange(Math.max(0, selectedTask - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex-1 text-center">
                <p className="text-sm font-medium">{tasks[selectedTask].title}</p>
                <p className="text-xs text-slate-400">{tasks[selectedTask].description}</p>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => onTaskChange(Math.min(tasks.length - 1, selectedTask + 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* 控制模式 */}
          <div className="space-y-2">
            <Label className="text-xs text-slate-400">控制模式</Label>
            <div className="grid grid-cols-4 gap-1">
              {(['manual', 'p', 'pd', 'pid'] as ControlMode[]).map((mode) => (
                <Button
                  key={mode}
                  variant={controlMode === mode ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs uppercase"
                  onClick={() => onControlModeChange(mode)}
                >
                  {mode}
                </Button>
              ))}
            </div>
          </div>

          {/* PID 增益 */}
          {controlMode !== 'manual' && (
            <div className="space-y-3">
              <Label className="text-xs text-slate-400">PID 增益</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-8 text-xs text-cyan-400">Kp</span>
                  <Slider
                    value={[pidGains.kp]}
                    min={0}
                    max={5}
                    step={0.1}
                    onValueChange={([v]) => onPidGainsChange({ ...pidGains, kp: v })}
                    className="flex-1"
                  />
                  <span className="w-10 text-right text-xs font-mono">{pidGains.kp.toFixed(1)}</span>
                </div>
                {(controlMode === 'pid' || controlMode === 'pd') && (
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-xs text-cyan-400">Kd</span>
                    <Slider
                      value={[pidGains.kd]}
                      min={0}
                      max={50}
                      step={1}
                      onValueChange={([v]) => onPidGainsChange({ ...pidGains, kd: v })}
                      className="flex-1"
                    />
                    <span className="w-10 text-right text-xs font-mono">{pidGains.kd.toFixed(0)}</span>
                  </div>
                )}
                {controlMode === 'pid' && (
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-xs text-cyan-400">Ki</span>
                    <Slider
                      value={[pidGains.ki]}
                      min={0}
                      max={0.1}
                      step={0.001}
                      onValueChange={([v]) => onPidGainsChange({ ...pidGains, ki: v })}
                      className="flex-1"
                    />
                    <span className="w-10 text-right text-xs font-mono">{pidGains.ki.toFixed(3)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 视角切换 */}
          <div className="space-y-2">
            <Label className="text-xs text-slate-400">视角</Label>
            <div className="grid grid-cols-3 gap-1">
              {(['chase', 'overhead', 'tactical'] as const).map((view) => (
                <Button
                  key={view}
                  variant={cameraMode === view ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onCameraModeChange(view)}
                >
                  {view === 'chase' ? '主视角' : view === 'overhead' ? '俯瞰' : '战术'}
                </Button>
              ))}
            </div>
            {cameraMode === 'free' && (
              <p className="text-xs text-blue-400">当前: 自由视角 (拖动/滚轮)</p>
            )}
          </div>

          {/* 控制按钮 */}
          <div className="flex gap-2">
            {isRunning ? (
              <Button variant="outline" className="flex-1" onClick={onPause}>
                <Pause className="w-4 h-4 mr-2" />
                暂停
              </Button>
            ) : (
              <Button variant="default" className="flex-1" onClick={onStart}>
                <Play className="w-4 h-4 mr-2" />
                开始
              </Button>
            )}
            <Button variant="outline" onClick={onReset}>
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={onShowChart}>
              <Gauge className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** 仿真曲线图表 */
function SimulationChart({ data, onBack }: { data: ChartData; onBack: () => void }) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    chartInstanceRef.current = new Chart(chartRef.current, {
      type: 'line',
      data: {
        labels: data.time.map((t) => t.toFixed(1)),
        datasets: [
          {
            label: '期望航向',
            data: data.desiredHeading,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            yAxisID: 'y-heading',
            fill: false,
            borderWidth: 2,
            pointRadius: 0,
          },
          {
            label: '实际航向',
            data: data.actualHeading,
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            yAxisID: 'y-heading',
            fill: false,
            borderWidth: 2,
            pointRadius: 0,
          },
          {
            label: '航速',
            data: data.speed,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            yAxisID: 'y-speed',
            fill: false,
            borderWidth: 2,
            pointRadius: 0,
          },
          {
            label: '舵角',
            data: data.rudder,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            yAxisID: 'y-rudder',
            fill: false,
            borderWidth: 2,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#e2e8f0' },
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleColor: '#e2e8f0',
            bodyColor: '#cbd5e1',
            borderColor: '#475569',
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            title: { display: true, text: '时间 (秒)', color: '#cbd5e1' },
            ticks: { color: '#94a3b8', maxTicksLimit: 15 },
            grid: { color: 'rgba(148, 163, 184, 0.1)' },
          },
          'y-heading': {
            type: 'linear',
            position: 'left',
            title: { display: true, text: '航向角 (°)', color: '#cbd5e1' },
            min: -180,
            max: 180,
            ticks: { color: '#94a3b8', stepSize: 45 },
            grid: { color: 'rgba(148, 163, 184, 0.2)' },
          },
          'y-speed': {
            type: 'linear',
            position: 'right',
            title: { display: true, text: '航速 (m/s)', color: '#cbd5e1' },
            ticks: { color: '#94a3b8' },
            grid: { drawOnChartArea: false },
          },
          'y-rudder': {
            type: 'linear',
            position: 'right',
            offset: true,
            title: { display: true, text: '舵角 (°)', color: '#cbd5e1' },
            min: -nomotoParams.maxRudderDeg,
            max: nomotoParams.maxRudderDeg,
            ticks: { color: '#94a3b8', stepSize: 10 },
            grid: { drawOnChartArea: false },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [data]);

  return (
    <div className="flex h-full w-full flex-col bg-slate-950 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-slate-100">仿真曲线</h2>
        <Button onClick={onBack} variant="default" size="lg">
          返回场景
        </Button>
      </div>
      <div className="flex-1 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
        <canvas ref={chartRef} />
      </div>
    </div>
  );
}

// ============ 主组件 ============

export default function DestroyerSimulation() {
  // 状态
  const [isRunning, setIsRunning] = useState(false);
  const [controlMode, setControlMode] = useState<ControlMode>('pid');
  const [pidGains, setPidGains] = useState<PIDGains>(DEFAULT_PID_GAINS);
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [selectedTask, setSelectedTask] = useState(0);
  const [resetToken, setResetToken] = useState(0);
  const [showChart, setShowChart] = useState(false);
  const [hudState, setHudState] = useState<HudState>({
    heading: 0,
    yawRate: 0,
    rudder: 0,
    speed: REF_SPEED,
    position: { x: 0, z: 0 },
    avgError: 0,
    currentError: 0,
    time: 0,
  });
  const [chartData, setChartData] = useState<ChartData>({
    time: [],
    desiredHeading: [],
    actualHeading: [],
    speed: [],
    rudder: [],
  });

  // Refs
  const simRef = useRef<SimulationState>({
    position: new THREE.Vector3(),
    headingRad: 0,
    yawRateRad: 0,
    rudderDeg: 0,
    manualRudderDeg: 0,
    speedMps: REF_SPEED,
    integral: 0,
    prevErrorRad: 0,
    waveY: 0,
    wavePitch: 0,
    waveRoll: 0,
  });
  const shipRef = useRef<THREE.Group | null>(null);

  // 计算场景逻辑
  const task = tasks[selectedTask];
  const scenarioLogic = useMemo(() => getScenarioLogic(task.scenario), [task.scenario]);
  const guidePath = useMemo(() => generateGuidePath(scenarioLogic, task.duration), [scenarioLogic, task.duration]);
  const headingPoints = useMemo(() => {
    const points: HeadingPoint[] = [];
    const step = task.duration / 10;
    for (let t = 0; t <= task.duration; t += step) {
      points.push({ time: t, heading: normalizeSignedHeading(scenarioLogic.getDesiredHeading(t)) });
    }
    return points;
  }, [scenarioLogic, task.duration]);

  // 重置仿真
  const handleReset = useCallback(() => {
    setIsRunning(false);
    setResetToken((prev) => prev + 1);
    setChartData({ time: [], desiredHeading: [], actualHeading: [], speed: [], rudder: [] });

    const start = scenarioLogic.startPos;
    simRef.current = {
      position: new THREE.Vector3(start.x, 0, start.z),
      headingRad: toRadians(start.headingDeg),
      yawRateRad: 0,
      rudderDeg: 0,
      manualRudderDeg: 0,
      speedMps: REF_SPEED,
      integral: 0,
      prevErrorRad: 0,
      waveY: 0,
      wavePitch: 0,
      waveRoll: 0,
    };

    setHudState({
      heading: start.headingDeg,
      yawRate: 0,
      rudder: 0,
      speed: REF_SPEED,
      position: { x: start.x, z: start.z },
      avgError: 0,
      currentError: 0,
      time: 0,
    });
  }, [scenarioLogic]);

  // 任务切换时重置
  useEffect(() => {
    handleReset();
  }, [selectedTask, handleReset]);

  // 图表数据更新
  const handleChartDataUpdate = useCallback(
    (time: number, desired: number, actual: number, speed: number, rudder: number) => {
      setChartData((prev) => ({
        time: [...prev.time, time],
        desiredHeading: [...prev.desiredHeading, desired],
        actualHeading: [...prev.actualHeading, actual],
        speed: [...prev.speed, speed],
        rudder: [...prev.rudder, rudder],
      }));
    },
    []
  );

  if (showChart) {
    return <SimulationChart data={chartData} onBack={() => setShowChart(false)} />;
  }

  return (
    <div className="relative h-screen w-full">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 200, 500]} fov={60} near={1} far={50000} />

        <ambientLight intensity={0.4} />
        <directionalLight position={[200, 300, 200]} intensity={1.5} castShadow />

        <SkyDome />
        <ProceduralClouds />
        <WaveWater simRef={simRef} />
        <GridHelper simRef={simRef} />
        <GuideRoute points={guidePath} />
        <ShipTrail simRef={simRef} resetToken={resetToken} />
        <ShipWake simRef={simRef} />
        <DestroyerModel simRef={simRef} />

        <OrbitControls
          ref={controlsRef}
          enablePan
          enableZoom
          enableRotate
          minDistance={100}
          maxDistance={5000}
          maxPolarAngle={Math.PI / 2.1}
          onStart={() => setCameraMode('free')}
        />
        <UnifiedCameraController
          position={{ x: simRef.current.position.x, z: simRef.current.position.z }}
          headingRad={simRef.current.headingRad}
          cameraMode={cameraMode}
          controlsRef={controlsRef}
        />
        <SimulationEngine
          simRef={simRef}
          shipRef={shipRef}
          isRunning={isRunning}
          controlMode={controlMode}
          pidGains={pidGains}
          headingPoints={headingPoints}
          duration={task.duration}
          guidePath={guidePath}
          onHudUpdate={setHudState}
          onChartDataUpdate={handleChartDataUpdate}
        />
      </Canvas>

      <HUD state={hudState} isRunning={isRunning} controlMode={controlMode} />

      <ControlPanel
        isRunning={isRunning}
        controlMode={controlMode}
        pidGains={pidGains}
        cameraMode={cameraMode}
        selectedTask={selectedTask}
        onStart={() => setIsRunning(true)}
        onPause={() => setIsRunning(false)}
        onReset={handleReset}
        onControlModeChange={setControlMode}
        onPidGainsChange={setPidGains}
        onCameraModeChange={setCameraMode}
        onTaskChange={setSelectedTask}
        onShowChart={() => setShowChart(true)}
      />

      {/* 视角切换器 */}
      <CameraViewSwitcher
        currentMode={cameraMode}
        onModeChange={setCameraMode}
        className="absolute bottom-4 left-1/2 -translate-x-1/2"
      />
    </div>
  );
}

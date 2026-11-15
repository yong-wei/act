'use client';
import {MarineGrid as Grid} from '../scene/lines/marine-grid';

/** 天鲸原场景承载钢桩、锚缆、桥架和切削的常驻物理会话。 */
import {Suspense, useState, useRef, useCallback, useEffect, type MutableRefObject, type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {OrbitControls, Html, PerspectiveCamera} from '@react-three/drei';
import type {OrbitControls as OrbitControlsImpl} from 'three-stdlib';
import * as THREE from 'three';
import {MarineCanvas} from '../scene/marine-canvas';
import {MarineWater} from '../scene/water/marine-water';
import {SimulationClock} from '@/lib/simulation';
import {VersionedFleetShip} from '../components/versioned-fleet-ship';
import type {BindingTelemetrySource} from '../components/semantic-bindings-rig';
import {RightClickFreeModeBridge} from '../components/camera-controller';
import {SCENE_CAMERA_SHOTS, StayPutCameraController} from '../scene/camera';
import {CameraViewSwitcher} from '../components/camera-view-switcher';
import {ModelLoadingPlaceholder} from '../components/model-loading-placeholder';
import {SimulationTopBar, simulationUi} from '../components/simulation-ui';
import {dredgerCourseExperiment as dredgerExperiment, dredgerTraceSamples, DREDGER_MODE_LABELS} from '../experiments/dredger-experiment';
import {dredgerCourseAdapter} from '../experiments/dredger-course-adapter';
import {DredgerCourseControls} from '../experiments/dredger-course-controls';
import {VesselModelWorkbench} from '../experiments/model-workbench';
import {vesselSampleMark} from './vessel-experiment';
import {VesselExperimentDocks} from './vessel-experiment-panels';
import {useVesselExperiment} from './use-vessel-experiment';
import type {VesselSessionFrame} from '@/lib/control-engine/vessel-session';
import {useSimulationSceneTheme, simulationScenePalette} from '../components/simulation-theme';
import {EnvironmentScene, MARINE_SCENE_LAYOUTS, marineLayoutSedimentPlume, MarineSceneLayoutObjects,
  SceneEnvironmentProvider, useEnvironmentWaterColors} from '../scene/environment';
import {GERSTNER_WATER_BASE_Y} from '../scene/water';
import {SceneSoundscapeProvider, SoundscapeAmbienceDriver} from '../scene/audio';
import {TeachingAnnotationsProvider, useTeachingAnnotations} from '../scene/annotations';
import {SceneQualityDriver, SceneQualityProvider, useSceneQuality, MarinePerformanceEvidenceProbe} from '../scene/quality';
import {ScenePostEffects} from '../scene/post';
import {dredgerTianjingSceneVisual} from '../profiles/dredger-tianjing-scene';
import {platformHeadingToSceneRad} from '../scene/heading';
import {WaterHuggingLine} from '../scene/lines';
import {ArrowDownFromLine, Compass, Crosshair, Orbit, Video} from 'lucide-react';
import {SimNotice, SimPanelSection, SimPanelStack, SimReadout, SimReadoutGrid, SimStatusStrip} from '../components/simulation-panels';
import type {Vector2} from '../core/types';
import {toRadians, toDegrees, TIANJING_DREDGER_PARAMS} from '../core/constants';
import {SIMULATION_FIXED_STEP_SECONDS, SIMULATION_MAX_SUB_STEPS, getSimulationDeltaFromMilliseconds} from '../lib/simulation-timing';

interface DredgerScenePose {x: number; y: number; psi: number; u: number; v: number}

// ============ 3D 组件 ============

/** 挖泥船模型 */
function DredgerModel(props: {
  position: Vector2;
  heading: number;
  simRef: MutableRefObject<BindingTelemetrySource>;
  resetToken: number;
  heaveM: number;
  rollRad: number;
  pitchRad: number;
}) {
  return (
    <VersionedFleetShip
      logicalId="dredger"
      simRef={props.simRef}
      position={props.position}
      waterYSampler={() => GERSTNER_WATER_BASE_Y + props.heaveM}
      extraEuler={{x: props.pitchRad, z: props.rollRad}}
      headingRad={props.heading}
      sceneLengthMeters={120}
      resetToken={props.resetToken}
      legacyYawOffsetRad={0}
      fallbackDraftMeters={TIANJING_DREDGER_PARAMS.DRAFT}
    />
  );
}

/** 目标位置标记 */
function TargetMarker({ position, heading }: { position: Vector2; heading: number }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(clock.getElapsedTime() * 2) * 2 + 5;
    }
  });

  return (
    <group name="marine-annotations" ref={groupRef} position={[position.x, 5, position.z]}>
      {/* 目标圆圈 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[8, 10, 32]} />
        <meshBasicMaterial color={simulationScenePalette.success} side={THREE.DoubleSide} transparent opacity={0.6} />
      </mesh>
      {/* 航向箭头 */}
      <mesh rotation={[0, -toRadians(heading), 0]} position={[0, 0, 0]}>
        <coneGeometry args={[3, 10, 8]} />
        <meshBasicMaterial color={simulationScenePalette.success} transparent opacity={0.8} />
      </mesh>
      {/* 标签 */}
      <Html position={[0, 15, 0]} center>
        <div className="rounded bg-[hsl(var(--platform-brand-success)/0.78)] px-2 py-1 text-xs text-platform-fg-inverse">
          作业参考
        </div>
      </Html>
    </group>
  );
}

/** 航迹线 */
function TrajectoryLine({ points, waterOriginSampler, }: { points: Vector2[]; waterOriginSampler?: () => { x: number; z: number } }) {
  if (points.length < 2) return null;
  return <WaterHuggingLine points={points} waterOriginSampler={waterOriginSampler} color={simulationScenePalette.dredgerPrimary} lineWidth={2} />;
}

/** 相机控制器 */

// ============ UI 组件 ============

/** HUD 显示 */
function HUD({frame, isRunning}: {frame: VesselSessionFrame | null; isRunning: boolean}) {
  const point = frame?.dredger;
  const observation = point?.observation;
  const reading = (name: string, scale = 1, digits = 3) => {
    const sample = point?.samples.find((sample) => {
      const signal = typeof sample.signal === 'string' ? sample.signal
        : Object.entries(sample.signal).map(([key, index]) => `${key}${index}`)[0];
      return signal === name;
    })?.measurement;
    return sample?.quality === 'Good' && sample.value !== null ? (sample.value / scale).toFixed(digits) : '待量测';
  };
  const propulsionPower = frame?.truth.actuator_states.motor_torques_nm.reduce((sum, torque, index) =>
    sum + Math.max(0, torque * frame.truth.actuator_states.propeller_shaft_speed_rad_s[index]), 0) ?? 0;
  const power = propulsionPower + Math.max(0, observation?.cutterPowerW ?? 0)
    + (observation?.winchPowerW.reduce((sum, value) => sum + Math.max(0, value), 0) ?? 0);
  return <SimPanelStack>
    <SimStatusStrip state={isRunning ? 'running' : (frame?.timeS ?? 0) > 0 ? 'paused' : 'idle'}
      time={`${(frame?.timeS ?? 0).toFixed(1)}s`} />
    <SimPanelSection title="作业状态" icon={Crosshair} tone={frame?.dredgerController?.tripLatched ? 'warning' : 'neutral'}>
      <SimReadoutGrid>
        <SimReadout label="当前模式" value={point ? DREDGER_MODE_LABELS[point.mode] : '准备中'} span />
        <SimReadout label="横移速度量测" value={reading('SwaySpeed')} unit="m/s" />
        <SimReadout label="横移参考" value={(point?.referenceMps ?? 0).toFixed(3)} unit="m/s" />
        <SimReadout label="刀位深度量测" value={reading('Depth')} unit="m" />
        <SimReadout label="绞刀转速量测" value={reading('CutterRpm', 1, 2)} unit="rpm" />
        <SimReadout label="左缆张力量测" value={reading('CableTension0', 1000, 1)} unit="kN" />
        <SimReadout label="右缆张力量测" value={reading('CableTension1', 1000, 1)} unit="kN" />
        <SimReadout label="钢桩反力量测" value={reading('SpudForce', 1000, 1)} unit="kN" />
        <SimReadout label="台车行程" value={(observation?.carriageM ?? 0).toFixed(2)} unit="m" />
        <SimReadout label="实际移除体积" value={(observation?.productionM3 ?? 0).toFixed(3)} unit="m³" />
        <SimReadout label="正机械功率" value={(power / 1e6).toFixed(3)} unit="MW" />
      </SimReadoutGrid>
    </SimPanelSection>
    {frame?.dredgerController?.tripLatched ? <SimNotice tone="warning" title="作业保护已触发">
      已执行停止切削与抬刀保护，请根据实际张力、刀位和事件记录解释后续安全保持。
    </SimNotice> : null}
  </SimPanelStack>;
}

// ============ 管线桥接组件 ============

const CAMERA_SHOT_VIEWS = [
  { id: SCENE_CAMERA_SHOTS.chase.id, label: '跟船', shortLabel: '跟', icon: Video, description: SCENE_CAMERA_SHOTS.chase.description },
  { id: SCENE_CAMERA_SHOTS.orbit.id, label: '环绕', shortLabel: '环', icon: Orbit, description: SCENE_CAMERA_SHOTS.orbit.description },
  { id: SCENE_CAMERA_SHOTS.tactical.id, label: '战术', shortLabel: '战', icon: Compass, description: SCENE_CAMERA_SHOTS.tactical.description },
  { id: SCENE_CAMERA_SHOTS.topDown.id, label: '顶视', shortLabel: '顶', icon: ArrowDownFromLine, description: SCENE_CAMERA_SHOTS.topDown.description },
];

/** QA 钩子：把质量档位与派生预算暴露为 DOM 属性（性能 spec 与视觉 QA 消费）。 */
function SceneQualityAttributes() {
  const { tier, override, params } = useSceneQuality();
  return (
    <span
      hidden
      data-scene-quality-tier={tier}
      data-scene-quality-override={override ?? ''}
      data-wake-particle-cap={Math.round(2200 * params.particleScale)}
      data-water-tier={params.waterTier}
      data-post-enabled={params.postEnabled}
    />
  );
}

/** 海面颜色随环境预设、细分随质量档位的桥接组件（船位直读 ref）。 */
function DredgerWater({
  poseRef,
  resetToken,
  playing,
}: {
  poseRef: RefObject<DredgerScenePose>;
  resetToken: number;
  playing: boolean;
}) {
  const water = useEnvironmentWaterColors();
  const { params } = useSceneQuality();
  return (
    <MarineWater
      worldSpeedSampler={() => playing ? Math.hypot(poseRef.current.u, poseRef.current.v) : 0}
      vesselLengthMeters={127.5} vesselBeamMeters={23}
      resetToken={resetToken}
      tier={params.waterTier}
      positionSampler={() => ({ x: poseRef.current.x, z: poseRef.current.y })}
      shipHeadingSampler={() => platformHeadingToSceneRad(toDegrees(poseRef.current.psi))}
      shoreSegments={MARINE_SCENE_LAYOUTS['shallow-construction-site'].shoreSegments}
      sedimentPlume={marineLayoutSedimentPlume('shallow-construction-site')}
      waterColor={water.waterColor}
      deepColor={water.deepColor}
      horizonColor={water.horizonColor}
      foamColor={simulationScenePalette.waterFoam}
      seaState={3}
      sunDirection={water.sunDirection}
      sunIllumination={water.sunIllumination}
    />
  );
}

/** 教学标注开关门控：默认关闭，开启时显示目标点标记。 */
function TeachingAnnotationsGate({
  position,
  heading,
}: {
  position: Vector2;
  heading: number;
}) {
  const { showAnnotations } = useTeachingAnnotations();
  if (!showAnnotations) return null;
  return <TargetMarker position={position} heading={heading} />;
}

// ============ 主组件 ============

export function DredgerSimulation({ticket = ''}: {ticket?: string}) {
  const session = useVesselExperiment(dredgerExperiment, ticket, dredgerCourseAdapter);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const poseRef = useRef<DredgerScenePose>({x: 0, y: 0, psi: 0, u: 0, v: 0});
  const bindingRef = useRef<BindingTelemetrySource>({rudderDeg: 0, speedMps: 0, attainedCount: 0, advancing: false, cutterRpm: 0});
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const lastHudRef = useRef(0);
  const lastTrailRef = useRef(0);
  const markRef = useRef(-1);
  const speedScaleRef = useRef(8);
  const clockRef = useRef(new SimulationClock({dt: SIMULATION_FIXED_STEP_SECONDS, maxSubSteps: SIMULATION_MAX_SUB_STEPS}));
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [frame, setFrame] = useState<VesselSessionFrame | null>(null);
  const [trajectory, setTrajectory] = useState<Vector2[]>([]);
  const [cameraMode, setCameraMode] = useState('chase');
  const [showGrid, setShowGrid] = useState(true);
  const [speedScale, setSpeedScale] = useState(8);
  const [resetCount, setResetCount] = useState(0);
  const [viewResetCount, setViewResetCount] = useState(0);
  const sceneTheme = useSimulationSceneTheme();
  const projectFrame = useCallback((next: VesselSessionFrame) => {
    const actual = next.truth.actuator_states;
    poseRef.current = {x: next.truth.position_ned[0], y: next.truth.position_ned[1],
      psi: next.attitudeDeg.heading * Math.PI / 180, u: next.waterVelocityBody[0], v: next.waterVelocityBody[1]};
    bindingRef.current = {rudderDeg: (actual.control_surface_angles_rad[0] ?? 0) * 180 / Math.PI,
      speedMps: Math.hypot(next.waterVelocityBody[0], next.waterVelocityBody[1]), attainedCount: 0,
      advancing: sessionRef.current.course?.running ?? false, cutterRpm: next.dredger?.observation.cutterRpm ?? 0,
      cutterPhaseRad: next.truth.specialist_states[2] ?? 0, ladderAngleRad: next.truth.specialist_states[0] ?? 0};
  }, []);
  useEffect(() => {
    const initial = sessionRef.current.course?.ready ? sessionRef.current.course.read() : null;
    if (!initial) return;
    projectFrame(initial); setFrame(initial); setTrajectory([]); setResetCount((value) => value + 1);
    clockRef.current.reset(); lastTimeRef.current = 0; lastHudRef.current = initial.timeS;
    lastTrailRef.current = initial.timeS; markRef.current = vesselSampleMark(initial.timeS);
  }, [session.course?.ready, session.activeSeq, projectFrame]);
  const loop = useCallback((timestamp: number) => {
    const current = sessionRef.current;
    const course = current.course;
    if (!course?.ready || !course.running) return;
    const elapsed = getSimulationDeltaFromMilliseconds(timestamp, lastTimeRef.current, speedScaleRef.current);
    lastTimeRef.current = timestamp;
    let next = course.read();
    clockRef.current.advance(elapsed, (dt) => {
      next = course.advance(dt);
      if (!next) return;
      projectFrame(next);
      const point = course.latestPoint();
      if (point) {
        const sample = dredgerTraceSamples([point])[0];
        current.trackLatest(sample);
        const mark = vesselSampleMark(next.timeS);
        if (mark > markRef.current) { markRef.current = mark; current.observe(sample); }
      }
    });
    if (next && (next.timeS - lastHudRef.current >= 0.1 || next.paused)) { setFrame(next); lastHudRef.current = next.timeS; }
    if (next && next.timeS - lastTrailRef.current >= 0.5) {
      lastTrailRef.current = next.timeS;
      const point = {x: next.truth.position_ned[0], z: next.truth.position_ned[1]};
      setTrajectory((previous) => [...previous.slice(-1200), point]);
    }
    if (course.running) animationRef.current = requestAnimationFrame(loop);
  }, [projectFrame]);
  useEffect(() => { speedScaleRef.current = speedScale; }, [speedScale]);
  useEffect(() => {
    if (session.course?.running) {
      clockRef.current.reset(); lastTimeRef.current = performance.now();
      animationRef.current = requestAnimationFrame(loop);
    } else {
      const next = sessionRef.current.course?.read();
      if (next) { projectFrame(next); setFrame(next); }
      bindingRef.current = {...bindingRef.current, advancing: false};
    }
    return () => { if (animationRef.current !== null) cancelAnimationFrame(animationRef.current); };
  }, [session.course?.running, loop, projectFrame]);
  const isRunning = session.course?.running ?? false;
  const shipPosition = {x: poseRef.current.x, z: poseRef.current.y};
  const shipHeading = poseRef.current.psi;

  return (
    <SceneEnvironmentProvider>
    <SceneSoundscapeProvider>
    <TeachingAnnotationsProvider>
    <SceneQualityProvider>
    <div className={simulationUi.root} data-sim-ui>
      <SceneQualityAttributes />
      {/* 3D 场景 */}
      <MarineCanvas shadows={{ type: THREE.PCFShadowMap }}>
        <PerspectiveCamera makeDefault position={[300, 200, 300]} fov={60} near={1} far={50000} />
        <OrbitControls
          ref={controlsRef}
          enablePan
          enableZoom
          enableRotate
          minDistance={50}
          maxDistance={2000}
          maxPolarAngle={Math.PI / 2.1}
        />
        <RightClickFreeModeBridge onRequestFreeMode={() => setCameraMode('free')} />

        <Suspense fallback={null}>
          <EnvironmentScene subjectPositionSampler={() => ({ x: poseRef.current.x, z: poseRef.current.y })} />
        <MarineSceneLayoutObjects layoutId="shallow-construction-site" />
        </Suspense>
        <SoundscapeAmbienceDriver />
        <SceneQualityDriver />
        <MarinePerformanceEvidenceProbe contextInput={() => ({ vesselId: 'dredger', cameraView: String(cameraMode), seaState: 3 })} />
        <Suspense fallback={null}>
          <DredgerWater playing={isRunning} poseRef={poseRef} resetToken={resetCount} />
        </Suspense>

        {/* 网格 */}
        {showGrid ? (
          <Grid name="marine-grid"
            position={[0, 0.35, 0]}
            args={[20000, 20000]}
            cellSize={100}
            cellThickness={0.5}
            cellColor={sceneTheme.gridCellColor}
            sectionSize={500}
            sectionThickness={1}
            sectionColor={sceneTheme.gridSectionColor}
            fadeDistance={9000}
            fadeStrength={1}
          />
        ) : null}

        {/* 目标标记（教学标注门控，默认关闭；坐标在控制面板数值可读） */}
        <TeachingAnnotationsGate position={{x: 0, z: 0}} heading={0} />

        {/* 挖泥船 */}
        <Suspense
          fallback={(
            <ModelLoadingPlaceholder
              label="挖泥船模型加载中"
              sublabel="场景已就绪，可先查看施工环境"
            />
          )}
        >
          <DredgerModel
            position={shipPosition}
            heading={shipHeading}
            simRef={bindingRef}
            resetToken={resetCount}
            heaveM={-(frame?.truth.position_ned[2] ?? 0)}
            rollRad={(frame?.attitudeDeg.roll ?? 0) * Math.PI / 180}
            pitchRad={(frame?.attitudeDeg.pitch ?? 0) * Math.PI / 180}
          />
        </Suspense>

        {/* 航迹 */}
        {trajectory.length > 1 && <TrajectoryLine points={trajectory} waterOriginSampler={() => ({ x: poseRef.current.x, z: poseRef.current.y })} />}


        <StayPutCameraController
          view={cameraMode}
          positionSampler={() => ({ x: poseRef.current.x, z: poseRef.current.y })}
          headingSampler={() => platformHeadingToSceneRad(toDegrees(poseRef.current.psi))}
          shipLength={dredgerTianjingSceneVisual.shipLengthMeters}
          controlsRef={controlsRef}
        resetSignal={viewResetCount}
        />
        <ScenePostEffects />
      </MarineCanvas>

      <CameraViewSwitcher
        currentMode={cameraMode}
        onModeChange={setCameraMode}
        onViewReset={() => setViewResetCount((previous) => previous + 1)}
        views={CAMERA_SHOT_VIEWS}
        gridEnabled={showGrid}
        onToggleGrid={() => setShowGrid((previous) => !previous)}
        speedScale={speedScale}
        onSpeedChange={setSpeedScale}
        maxSpeedScale={8}
        className={simulationUi.cameraSwitcherPosition}
      />

      <VesselExperimentDocks
        experiment={dredgerExperiment}
        session={session}
        status={<HUD frame={frame} isRunning={isRunning} />}
        controls={<DredgerCourseControls session={session} timeS={frame?.timeS ?? 0} />}
        assessment={session.course && !session.tour.active ? <VesselModelWorkbench scopeKey={session.course.scopeKey}
          runs={session.course.runs} onArtifactsChange={session.course.onArtifactsChange}
          defaultChannel="winch-reference-to-sway" /> : null}
      />

      <SimulationTopBar
        title="天鲸号工况切换与作业定位"
        subtitle="钢桩与弹性锚缆 · 桥架、绞刀及六自由度耦合"
        badge="天鲸号"
      />
    </div>
    </SceneQualityProvider>
    </TeachingAnnotationsProvider>
    </SceneSoundscapeProvider>
    </SceneEnvironmentProvider>
  );
}

export default DredgerSimulation;

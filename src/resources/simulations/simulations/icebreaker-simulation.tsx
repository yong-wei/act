'use client';
import { MarineGrid as Grid } from '../scene/lines/marine-grid';
import { MarineLine as Line } from '@/resources/simulations/scene/lines/marine-line';

/**
 * 雪龙2号极地科考破冰船仿真
 * 保留既有场景和面板，投影六自由度接触、有限浮冰与受限双吊舱会话。
 */

import { Suspense, useState, useRef, useCallback, useEffect, type MutableRefObject, type ReactNode } from 'react';
import {
  OrbitControls,
  PerspectiveCamera,
  } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { MarineCanvas } from '../scene/marine-canvas';
import { MarineWater } from '../scene/water/marine-water';
import { SimulationClock } from '@/lib/simulation';
import { VersionedFleetShip } from '@/resources/simulations/components/versioned-fleet-ship';
import type { BindingTelemetrySource } from '@/resources/simulations/components/semantic-bindings-rig';
import { RightClickFreeModeBridge } from '../components/camera-controller';
import { SCENE_CAMERA_SHOTS, StayPutCameraController } from '../scene/camera';
import { CameraViewSwitcher } from '../components/camera-view-switcher';
import { ModelLoadingPlaceholder } from '../components/model-loading-placeholder';
import { SimulationTopBar, simulationUi } from '../components/simulation-ui';
import { icebreakerCourseExperiment as iceExperiment, icebreakerTraceSamples } from '../experiments/icebreaker-experiment';
import { icebreakerCourseAdapter } from '../experiments/icebreaker-course-adapter';
import { IcebreakerCourseControls } from '../experiments/icebreaker-course-controls';
import { VesselModelWorkbench } from '../experiments/model-workbench';
import type { VesselSessionFrame } from '@/lib/control-engine/vessel-session';
import { IceContactField } from '../scene/ice-contact-field';
import { vesselSampleMark } from './vessel-experiment';
import { VesselExperimentDocks } from './vessel-experiment-panels';
import { useVesselExperiment } from './use-vessel-experiment';
import { useSimulationSceneTheme, simulationScenePalette, type SimulationSceneTheme } from '../components/simulation-theme';
import {
  EnvironmentScene,
  MarineSceneLayoutObjects,
  SceneEnvironmentProvider,
  useEnvironmentWaterColors,
} from '../scene/environment';
import { GERSTNER_WATER_BASE_Y } from '../scene/water';
import {
  SceneSoundscapeProvider,
  SoundscapeAmbienceDriver,
} from '../scene/audio';
import {
  TeachingAnnotationsProvider,
  useTeachingAnnotations,
} from '../scene/annotations';
import {
  SceneQualityDriver,
  SceneQualityProvider,
  useSceneQuality,
  MarinePerformanceEvidenceProbe,
} from '../scene/quality';
import { ScenePostEffects } from '../scene/post';
import { icebreakerXuelongSceneVisual } from '../profiles/icebreaker-xuelong-scene';
import { platformHeadingToSceneRad } from '../scene/heading';
import { WaterHuggingLine } from '../scene/lines';
import { ArrowDownFromLine, Compass, Gauge, Orbit, Snowflake, Video } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  SimPanelSection, SimPanelStack, SimReadout, SimReadoutGrid, SimStatusStrip, SimNotice,
} from '../components/simulation-panels';
import { icebreakerXuelongProfile } from '../profiles/icebreaker-xuelong';
import type { Vector2 } from '../core/types';
import { toRadians, toDegrees, XUELONG_ICEBREAKER_PARAMS } from '../core/constants';
import { SIMULATION_FIXED_STEP_SECONDS, SIMULATION_MAX_SUB_STEPS, getSimulationDeltaFromMilliseconds } from '../lib/simulation-timing';

// ============ 着色器材质 ============

/** 破冰船模型 */
function IcebreakerModel(props: {
  position: Vector2;
  heading: number;
  azimuth1: number;
  azimuth2: number;
  simRef: MutableRefObject<BindingTelemetrySource>;
  resetToken: number;
  rollRad: number;
  pitchRad: number;
  heaveM: number;
}) {
  return (
    <VersionedFleetShip
      logicalId="icebreaker"
      simRef={props.simRef}
      position={props.position}
      waterYSampler={() => GERSTNER_WATER_BASE_Y + props.heaveM}
      extraEuler={{ x: props.pitchRad, z: props.rollRad }}
      headingRad={props.heading}
      sceneLengthMeters={XUELONG_ICEBREAKER_PARAMS.LENGTH}
      resetToken={props.resetToken}
      legacyYawOffsetRad={Math.PI / 2}
      fallbackDraftMeters={XUELONG_ICEBREAKER_PARAMS.DRAFT}
      legacyOverlay={(scale) => (
        <>
          <group position={[-50 * scale / 122.5, 2, 5 * scale / 122.5]}>
            <arrowHelper
              args={[
                new THREE.Vector3(Math.cos(props.azimuth1), 0, Math.sin(props.azimuth1)),
                new THREE.Vector3(0, 0, 0),
                10,
                0x00ff00,
              ]}
            />
          </group>
          <group position={[-50 * scale / 122.5, 2, -5 * scale / 122.5]}>
            <arrowHelper
              args={[
                new THREE.Vector3(Math.cos(props.azimuth2), 0, Math.sin(props.azimuth2)),
                new THREE.Vector3(0, 0, 0),
                10,
                0x00ff00,
              ]}
            />
          </group>
        </>
      )}
    />
  );
}

/** 航向指示器 */
function HeadingIndicator({
  position,
  targetHeading,
}: {
  position: Vector2;
  targetHeading: number;
}) {
  const headingRad = toRadians(targetHeading);
  const length = 100;
  const endX = position.x + Math.sin(headingRad) * length;
  const endZ = position.z + Math.cos(headingRad) * length;

  return (
    <Line name="marine-annotations"
      points={[
        [position.x, 5, position.z],
        [endX, 5, endZ],
      ]}
      color={simulationScenePalette.icebreakerPrimary}
      lineWidth={2}
      dashed
      dashSize={10}
      gapSize={5}
    />
  );
}

/** 航迹线 */
function TrailLine({ points, waterOriginSampler, }: { points: Vector2[]; waterOriginSampler?: () => { x: number; z: number } }) {
  if (points.length < 2) return null;
  return <WaterHuggingLine points={points} waterOriginSampler={waterOriginSampler} color={simulationScenePalette.icebreakerPrimary} lineWidth={1} opacity={0.5} transparent />;
}

/** 3D 场景 */
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

/** 海面颜色随环境预设、细分随质量档位的桥接组件。 */
function IcebreakerWater({ position, heading, speed, playing, resetToken, inIce }: { position: Vector2; heading: number; speed: number; playing: boolean; resetToken: number; inIce: boolean }) {
  const water = useEnvironmentWaterColors();
  const { params } = useSceneQuality();
  return (
    <MarineWater
      worldSpeedSampler={() => playing ? speed : 0}
      vesselLengthMeters={122.5} vesselBeamMeters={22.3}
      resetToken={resetToken}
      tier={params.waterTier}
      positionSampler={() => ({ x: position.x, z: position.z })}
      shipHeadingSampler={() => platformHeadingToSceneRad(toDegrees(heading))}
      waterColor={water.waterColor}
      deepColor={water.deepColor}
      horizonColor={water.horizonColor}
      foamColor={simulationScenePalette.waterFoam}
      seaState={inIce ? 0 : 3}
      sunDirection={water.sunDirection}
      sunIllumination={water.sunIllumination}
    />
  );
}

/** 教学标注开关门控：默认关闭，开启时显示目标航向指示。 */
function TeachingAnnotationsGate({
  position,
  targetHeading,
}: {
  position: Vector2;
  targetHeading: number;
}) {
  const { showAnnotations } = useTeachingAnnotations();
  if (!showAnnotations) return null;
  return <HeadingIndicator position={position} targetHeading={targetHeading} />;
}

function Scene({
  position,
  heading,
  targetHeading,
  azimuth1,
  azimuth2,
  trail,
  speed,
  playing,
  showGrid,
  sceneTheme,
  controlsRef,
  cameraMode,
  onCameraModeChange,
  resetToken,
  resetSignal,
  simRef,
  frame,
}: {
  position: Vector2;
  heading: number;
  targetHeading: number;
  azimuth1: number;
  azimuth2: number;
  trail: Vector2[];
  speed: number;
  playing: boolean;
  showGrid: boolean;
  sceneTheme: SimulationSceneTheme;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  cameraMode: string;
  onCameraModeChange: (mode: string) => void;
  resetToken: number;
  resetSignal: number;
  simRef: MutableRefObject<BindingTelemetrySource>;
  frame: VesselSessionFrame | null;
}) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[200, 150, 200]} fov={60} near={1} far={50000} />
      <OrbitControls
        ref={controlsRef}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={50}
        maxDistance={500}
        enablePan
        enableZoom
        enableRotate
      />
      <RightClickFreeModeBridge onRequestFreeMode={() => onCameraModeChange('free')} />
      <StayPutCameraController
        view={cameraMode}
        positionSampler={() => ({ x: position.x, z: position.z })}
        headingSampler={() => platformHeadingToSceneRad(toDegrees(heading))}
        shipLength={icebreakerXuelongSceneVisual.shipLengthMeters}
        controlsRef={controlsRef}
      resetSignal={resetSignal}
      />

      <Suspense fallback={null}>
        <EnvironmentScene subjectPositionSampler={() => ({ x: position.x, z: position.z })} />
        <MarineSceneLayoutObjects
          layoutId="polar-ice-field"
          iceCoverageOverride={() => 0}
        />
      </Suspense>
      <IceContactField scene={frame?.iceScene} />
      <SoundscapeAmbienceDriver />
      <SceneQualityDriver />
        <MarinePerformanceEvidenceProbe contextInput={() => ({ vesselId: 'icebreaker', cameraView: String(cameraMode), seaState: 3 })} />
      <Suspense fallback={null}>
        <IcebreakerWater speed={speed} playing={playing} position={position} heading={heading} resetToken={resetToken} inIce={Boolean(frame?.iceScene)} />
      </Suspense>

      <Suspense
        fallback={(
          <ModelLoadingPlaceholder
            label="破冰船模型加载中"
            sublabel="场景已就绪，可先查看冰区与航向目标"
          />
        )}
      >
        <IcebreakerModel
          position={position}
          heading={heading}
          azimuth1={azimuth1}
          azimuth2={azimuth2}
          rollRad={toRadians(frame?.attitudeDeg.roll ?? 0)}
          pitchRad={toRadians(frame?.attitudeDeg.pitch ?? 0)}
          heaveM={-(frame?.truth.position_ned[2] ?? 0)}
          simRef={simRef}
          resetToken={resetToken}
        />
      </Suspense>

      <TeachingAnnotationsGate position={position} targetHeading={targetHeading} />
      <TrailLine points={trail} waterOriginSampler={() => ({ x: position.x, z: position.z })} />


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
          infiniteGrid
        />
      ) : null}
      <ScenePostEffects />
    </>
  );
}

// ============ UI 组件 ============

function IceStatusPanel({ frame }: { frame: VesselSessionFrame | null }) {
  const ice = frame?.iceContact;
  return <SimPanelSection title="冰区状态" icon={Snowflake}>
    <SimReadoutGrid>
      <SimReadout label="接触点" value={String(ice?.contactCount ?? 0)} />
      <SimReadout label="破碎面积" value={(ice?.brokenAreaM2 ?? 0).toFixed(1)} unit="m²" />
      <SimReadout label="冰接触纵向阻力" value={(-(ice?.loadBody[0] ?? 0) / 1000).toFixed(1)} unit="kN" />
      <SimReadout label="有限浮冰" value={String(ice?.floeCount ?? 0)} unit="块" />
      <SimReadout label="压碎耗散" value={((ice?.crushingWorkJ ?? 0) / 1e6).toFixed(3)} unit="MJ" />
      <SimReadout label="弯折破坏" value={((ice?.fractureWorkJ ?? 0) / 1e6).toFixed(3)} unit="MJ" />
      <SimReadout label="摩擦耗散" value={((ice?.frictionWorkJ ?? 0) / 1e6).toFixed(3)} unit="MJ" />
      <SimReadout label="浮冰水阻耗散" value={((ice?.waterDissipationJ ?? 0) / 1e6).toFixed(3)} unit="MJ" />
    </SimReadoutGrid>
    <p className="mt-2 text-xs leading-5 text-platform-fg-secondary">冰载荷与能量为模型真值。辨识只使用实际吊舱角与转艏速率量测。</p>
  </SimPanelSection>;
}

function AzipodStatusPanel({ frame }: { frame: VesselSessionFrame | null }) {
  const actual = frame?.truth.actuator_states;
  return <SimPanelSection title="Azipod 推进器" icon={Gauge}>
    <div className="space-y-2.5">
      {['左舷', '右舷'].map((side, index) => <SimReadoutGrid key={side}>
        <SimReadout label={`${side}实际偏转`} value={toDegrees(actual?.azimuth_angles_rad[index] ?? 0).toFixed(1)} unit="°" />
        <SimReadout label={`${side}实际轴速`} value={((actual?.propeller_shaft_speed_rad_s[index] ?? 0) * 30 / Math.PI).toFixed(1)} unit="rpm" />
        <SimReadout label={`${side}推力`} value={((frame?.propulsorThrustN?.[index] ?? 0) / 1000).toFixed(1)} unit="kN" />
        <SimReadout label={`${side}机械功率`} value={((actual?.motor_torques_nm[index] ?? 0)
          * (actual?.propeller_shaft_speed_rad_s[index] ?? 0) / 1e6).toFixed(2)} unit="MW" />
      </SimReadoutGrid>)}
    </div>
  </SimPanelSection>;
}

// ============ 主组件 ============

export default function IcebreakerSimulation({ ticket = '' }: { ticket?: string }) {
  const session = useVesselExperiment(iceExperiment, ticket, icebreakerCourseAdapter);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const lastHudRef = useRef(0);
  const lastTrailRef = useRef(0);
  const markRef = useRef(-1);
  const clockRef = useRef(new SimulationClock({ dt: SIMULATION_FIXED_STEP_SECONDS, maxSubSteps: SIMULATION_MAX_SUB_STEPS }));
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const bindingRef = useRef<BindingTelemetrySource>({ rudderDeg: 0, speedMps: 0, attainedCount: 0, advancing: false });
  const speedScaleRef = useRef(8);
  const [frame, setFrame] = useState<VesselSessionFrame | null>(null);
  const [trail, setTrail] = useState<Vector2[]>([]);
  const [cameraMode, setCameraMode] = useState('chase');
  const [showGrid, setShowGrid] = useState(true);
  const [resetCount, setResetCount] = useState(0);
  const [viewResetCount, setViewResetCount] = useState(0);
  const [speedScale, setSpeedScale] = useState(8);
  const sceneTheme = useSimulationSceneTheme();

  useEffect(() => {
    const course = sessionRef.current.course;
    const initial = course?.ready ? course.read() : null;
    if (!initial) return;
    setFrame(initial);
    setTrail([]);
    setResetCount((value) => value + 1);
    clockRef.current.reset();
    lastTimeRef.current = 0;
    lastHudRef.current = initial.timeS;
    lastTrailRef.current = initial.timeS;
    markRef.current = vesselSampleMark(initial.timeS);
  }, [session.course?.ready, session.activeSeq]);

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
      const point = course.latestPoint();
      if (point) {
        const sample = icebreakerTraceSamples([point])[0];
        current.trackLatest(sample);
        const mark = vesselSampleMark(next.timeS);
        if (mark > markRef.current) { markRef.current = mark; current.observe(sample); }
      }
      const actual = next.truth.actuator_states;
      bindingRef.current = { rudderDeg: 0, speedMps: next.waterVelocityBody[0], attainedCount: 0, advancing: course.running,
        azipod: {
          P: { azimuthRad: actual.azimuth_angles_rad[0] ?? 0, rpm: (actual.propeller_shaft_speed_rad_s[0] ?? 0) * 30 / Math.PI },
          S: { azimuthRad: actual.azimuth_angles_rad[1] ?? 0, rpm: (actual.propeller_shaft_speed_rad_s[1] ?? 0) * 30 / Math.PI },
        } };
    });
    if (next && (next.timeS - lastHudRef.current >= .1 || next.paused)) {
      setFrame(next);
      lastHudRef.current = next.timeS;
    }
    if (next && next.timeS - lastTrailRef.current >= .5) {
      lastTrailRef.current = next.timeS;
      const point = { x: next.truth.position_ned[0], z: next.truth.position_ned[1] };
      setTrail((previous) => [...previous.slice(-1200), point]);
    }
    if (course.running) animationRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => { speedScaleRef.current = speedScale; }, [speedScale]);
  useEffect(() => {
    if (session.course?.running) {
      clockRef.current.reset();
      lastTimeRef.current = performance.now();
      animationRef.current = requestAnimationFrame(loop);
    } else {
      const next = sessionRef.current.course?.read();
      if (next) setFrame(next);
      bindingRef.current = { ...bindingRef.current, advancing: false };
    }
    return () => { if (animationRef.current !== null) cancelAnimationFrame(animationRef.current); };
  }, [session.course?.running, loop]);

  const position = { x: frame?.truth.position_ned[0] ?? 0, z: frame?.truth.position_ned[1] ?? 0 };
  const heading = toRadians(frame?.attitudeDeg.heading ?? 0);
  const time = frame?.timeS ?? 0;
  const running = session.course?.running ?? false;
  const course = session.course;
  return (
    <SceneEnvironmentProvider><SceneSoundscapeProvider><TeachingAnnotationsProvider><SceneQualityProvider>
      <div className={simulationUi.root} data-sim-ui>
        <SceneQualityAttributes />
        <MarineCanvas shadows={{ type: THREE.PCFShadowMap }}>
          <Scene position={position} heading={heading} targetHeading={frame?.input.targetHeadingDeg ?? 0}
            azimuth1={frame?.truth.actuator_states.azimuth_angles_rad[0] ?? 0}
            azimuth2={frame?.truth.actuator_states.azimuth_angles_rad[1] ?? 0}
            trail={trail} speed={frame?.waterVelocityBody[0] ?? 0} playing={running} showGrid={showGrid}
            sceneTheme={sceneTheme} controlsRef={controlsRef} cameraMode={cameraMode} onCameraModeChange={setCameraMode}
            resetToken={resetCount} resetSignal={viewResetCount} simRef={bindingRef} frame={frame} />
        </MarineCanvas>
        <VesselExperimentDocks experiment={iceExperiment} session={session}
          status={<SimPanelStack>
            <SimStatusStrip state={running ? 'running' : time > 0 ? 'paused' : 'idle'} time={`${time.toFixed(1)}s`} />
            <SimPanelSection title="航行状态" icon={Compass}><SimReadoutGrid>
              <SimReadout label="航向" value={toDegrees(heading).toFixed(1)} unit="°" size="lg" />
              <SimReadout label="北向 / 东向" value={`${position.x.toFixed(1)} / ${position.z.toFixed(1)}`} unit="m" />
              <SimReadout label="对水航速" value={(frame?.waterVelocityBody[0] ?? 0).toFixed(2)} unit="m/s" />
              <SimReadout label="横摇 / 纵摇" value={`${(frame?.attitudeDeg.roll ?? 0).toFixed(2)} / ${(frame?.attitudeDeg.pitch ?? 0).toFixed(2)}`} unit="°" />
            </SimReadoutGrid></SimPanelSection>
            <IceStatusPanel frame={frame} /><AzipodStatusPanel frame={frame} />
          </SimPanelStack>}
          controls={<IcebreakerCourseControls session={session} timeS={time} />}
          assessment={<div className="space-y-3">
            {Math.abs(position.z) > 25 ? <SimNotice tone="warning">实际横偏超过25m通道边界，本次结果继续保存。</SimNotice> : null}
            {course ? <SimPanelSection title="本机实验轮次" icon={Gauge}>
              <select className="sim-hud-input" aria-label="本机实验轮次" value={course.scopeKey}
                disabled={session.busy || session.tour.active || !course.ready}
                onChange={(event) => { void course.selectRound(event.target.value); }}>
                {course.rounds.map((draft) => <option key={draft.scopeKey} value={draft.scopeKey}>
                  {new Date(draft.updatedAtMs).toLocaleString('zh-CN')} · 已保存{draft.completedSteps.length}步
                </option>)}
              </select>
              <Button size="sm" variant="outline" className={simulationUi.buttonOutline} disabled={session.busy || session.tour.active || !course.ready}
                onClick={() => { void session.restartIlabSession(); }}>开启新一轮实验</Button>
            </SimPanelSection> : null}
            {course ? <Button size="sm" variant="outline" className={simulationUi.buttonOutline} disabled={session.busy || session.tour.active}
              onClick={() => { void course.upload(); }}>上传或重试保存本人证据</Button> : null}
            {course && !session.tour.active ? <VesselModelWorkbench scopeKey={course.scopeKey} runs={course.runs}
              onArtifactsChange={course.onArtifactsChange} defaultChannel="azimuth-to-yaw" /> : null}
            {session.tour.active ? <SimNotice>只读导览中已隔离本人模型库，退出后可继续实验。</SimNotice> : null}
          </div>} />
        <CameraViewSwitcher currentMode={cameraMode} onModeChange={setCameraMode}
          onViewReset={() => setViewResetCount((value) => value + 1)} views={CAMERA_SHOT_VIEWS}
          gridEnabled={showGrid} onToggleGrid={() => setShowGrid((value) => !value)} speedScale={speedScale}
          onSpeedChange={setSpeedScale} maxSpeedScale={8} className={simulationUi.cameraSwitcherPosition} />
        <SimulationTopBar title="雪龙2号吊舱与冰区控制" subtitle="双吊舱约束 · 六自由度冰接触 · 本人局部模型"
          badge={icebreakerXuelongProfile.name} />
      </div>
    </SceneQualityProvider></TeachingAnnotationsProvider></SceneSoundscapeProvider></SceneEnvironmentProvider>
  );
}

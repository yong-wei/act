'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useFrame, useThree } from '@react-three/fiber';

import * as THREE from 'three';

import { buildMarinePerformanceReport } from './performance-evidence';
import {
  marineGpuTimerPassActive,
  marineGpuTimerStartWindow,
  marineGpuTimerStopWindow,
  readMarineGpuTimerEvidence,
} from './gpu-frame-timer';
import {
  bindMarineStageTimer,
  collectStageWindow,
  measureOffscreenBatch,
  type OffscreenRenderer,
  type StageTimerBinding,
  type StageTimerDescription,
  type TimingSample,
} from './stage-performance';
import { Gauge } from 'lucide-react';

import { ChromePopoverButton } from '../chrome';

import {
  createQualityGovernor,
  probeDefaultQualityTier,
  SCENE_QUALITY_TIERS,
  type QualityGovernor,
  type QualityTierId,
  type QualityTierParams,
} from './quality-tiers';

interface SceneQualityContextValue {
  readonly tier: QualityTierId;
  readonly params: QualityTierParams;
  readonly override: QualityTierId | null;
  readonly setOverride: (tier: QualityTierId | null) => void;
  readonly governor: QualityGovernor;
  /** 由 Canvas 内驱动在 governor 降档后调用，把新档位同步进 context。 */
  readonly syncTierFromGovernor: () => void;
}

const SceneQualityContext = createContext<SceneQualityContextValue | null>(null);

function probeClientSignals() {
  const nav = typeof navigator === 'undefined' ? null : navigator;
  let softwareRenderer = false;
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') as WebGLRenderingContext | null;
      const debugInfo = gl?.getExtension('WEBGL_debug_renderer_info');
      const renderer = debugInfo ? String(gl?.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) ?? '') : '';
      softwareRenderer = /swiftshader|llvmpipe|software|basic render/i.test(renderer);
    } catch {
      softwareRenderer = false;
    }
  }
  return {
    isMobile: nav ? /Android|iPhone|iPad|Mobile/i.test(nav.userAgent) : false,
    hardwareConcurrency: nav?.hardwareConcurrency ?? 4,
    devicePixelRatio: typeof window === 'undefined' ? 1 : window.devicePixelRatio,
    softwareRenderer,
  };
}

/** 质量分级状态：启动探测默认档、governor 自动降档、手动覆盖。 */
export function SceneQualityProvider({
  children,
  initialTier,
}: {
  readonly children: ReactNode;
  readonly initialTier?: QualityTierId;
}) {
  const [governor] = useState(() => createQualityGovernor({
    initialTier: initialTier ?? probeDefaultQualityTier(probeClientSignals()),
  }));
  const [tier, setTier] = useState<QualityTierId>(governor.tier);
  const [override, setOverrideState] = useState<QualityTierId | null>(null);

  const value = useMemo<SceneQualityContextValue>(() => ({
    tier,
    params: SCENE_QUALITY_TIERS[tier],
    override,
    setOverride: (next) => {
      governor.setOverride(next);
      setOverrideState(next);
      setTier(governor.tier);
    },
    governor,
    syncTierFromGovernor: () => setTier(governor.tier),
  }), [tier, override, governor]);

  return (
    <SceneQualityContext.Provider value={value}>
      {children}
    </SceneQualityContext.Provider>
  );
}

export function useSceneQuality(): SceneQualityContextValue {
  const value = useContext(SceneQualityContext);
  if (!value) throw new Error('useSceneQuality must be used within SceneQualityProvider');
  return value;
}

/** governor 预热窗口（毫秒）：冷启动编译/预热不参与降档判定。 */
export const GOVERNOR_WARMUP_MS = 8000;

/** Canvas 内的帧时间上报驱动：推动 governor 的自动降档并同步回 context（挂一次即可）。 */
export function SceneQualityDriver({ onTierChange }: { readonly onTierChange?: (tier: QualityTierId) => void }) {
  const { governor, syncTierFromGovernor, params } = useSceneQuality();
  const setDpr = useThree((state) => state.setDpr);
  const gl = useThree((state) => state.gl);
  const lastRef = useRef(0);
  // 预热与后台保护（#2120）：冷启动编译/预热不参与降档判定；页面隐藏时
  // 不推进判定，恢复帧的巨大间隔被丢弃（不算一次超预算帧）。
  const mountedAtRef = useRef(0);
  const hiddenRef = useRef(false);
  const hiddenAccumRef = useRef(0);
  const lastVisibilityTsRef = useRef(0);
  useEffect(() => {
    mountedAtRef.current = performance.now();
    // 挂载即隐藏的页面（后台打开/会话恢复）：visibilitychange 已发生——
    // 用当前 document.hidden 初始化，隐藏期间不推进降档判定。
    hiddenRef.current = document.hidden;
    // 挂载时若已隐藏，驻留计时从挂载点开始。
    lastVisibilityTsRef.current = performance.now();
    const onVisibility = () => {
      const now = performance.now();
      const wasHidden = hiddenRef.current;
      const isHidden = document.hidden;
      // 预热期以可见墙钟计（P2 三轮）：**恢复可见时**累计刚结束的后台驻留
      //（按转换前状态判定——隐藏挂载/预热期隐藏都不消耗预热窗口）。
      if (wasHidden && !isHidden) hiddenAccumRef.current += now - lastVisibilityTsRef.current;
      lastVisibilityTsRef.current = now;
      hiddenRef.current = isHidden;
      if (!isHidden) lastRef.current = 0;
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // 档位渲染器消费：DPR 上限与阴影开关随档位/降档生效。
  useEffect(() => {
    setDpr(Math.min(window.devicePixelRatio, params.dprCap));
    gl.shadowMap.enabled = params.shadowsEnabled;
    gl.shadowMap.needsUpdate = true;
  }, [setDpr, gl, params.dprCap, params.shadowsEnabled]);

  useFrame(() => {
    const now = performance.now();
    const frameMs = lastRef.current === 0 ? 0 : now - lastRef.current;
    lastRef.current = now;
    const inWarmup = now - mountedAtRef.current - hiddenAccumRef.current < GOVERNOR_WARMUP_MS;
    if (inWarmup || hiddenRef.current) return;
    const before = governor.tier;
    governor.reportFrame(frameMs, now);
    if (governor.tier !== before) {
      syncTierFromGovernor();
      onTierChange?.(governor.tier);
    }
  });

  return null;
}

/** 场景 chrome 中的手动质量覆盖选择器（底部 chrome 家族弹出式按钮）。 */
export function SceneQualitySelect({ className }: { readonly className?: string }) {
  const { override, tier, setOverride } = useSceneQuality();
  const labelOf = (candidate: QualityTierId) => (candidate === 'high' ? '高' : candidate === 'medium' ? '中' : '低');
  const currentLabel = override ? labelOf(override) : `自动·${labelOf(tier)}`;
  return (
    <div className={className} data-scene-quality-select="true">
      <ChromePopoverButton
        icon={<Gauge className="h-4 w-4" />}
        label="画质"
        currentLabel={currentLabel}
        tooltip={`画质档位：后处理/粒子/阴影/水面分级（当前：${currentLabel}；再次点选取消手动覆盖）`}
        options={(['high', 'medium', 'low'] as const).map((candidate) => ({ id: candidate, label: labelOf(candidate) }))}
        currentId={override}
        onSelect={(candidate) => setOverride(override === candidate ? null : candidate)}
        dataHook="quality"
        ariaLabel="画质档位"
        optionDataHook="quality-tier"
      />
    </div>
  );
}

/**
 * 性能证据 QA 采集（#2103）：?qa=marine-performance 时挂载。滚动帧样本环形缓冲，
 * 经 window.__marinePerformanceEvidence.read() 构建完整报告（测量上下文 +
 * 帧间隔统计 + GPU timer 可用性探测）；无扩展时 method='frame-intervals'。
 */
export interface MarinePerformanceEvidenceContextInput {
  readonly vesselId: string;
  readonly cameraView: string;
  readonly seaState: number;
}

export function MarinePerformanceEvidenceProbe({
  contextInput,
}: {
  /** 场景真实状态归因（复审）：船包/镜头/海况由各场景传入，不再占位。 */
  readonly contextInput?: () => MarinePerformanceEvidenceContextInput;
}) {
  // 绑定本 Canvas 的 R3F renderer（#2120 复审）：多 canvas 页面探针不再
  // 不再按任意画布猜绑定。
  const renderer = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  // ref 化（二轮复审）：read() 时调用最新回调——镜头等运行态切换后归因随场景。
  const contextInputRef = useRef(contextInput);
  contextInputRef.current = contextInput;
  useEffect(() => {
    window.__marineConsumerObservation = {
      collect: async () => {
        const input = contextInputRef.current?.();
        const context = renderer.getContext() as WebGLRenderingContext | null;
        let started = readWaterTime(scene);
        let later = started;
        let hull = readFleetShip(scene);
        let firstHull = hull && hull.radius > 1 ? hull : null;
        const deadline = performance.now() + 12000;
        while (performance.now() < deadline) {
          await new Promise((resolve) => {
            requestAnimationFrame(() => resolve(undefined));
          });
          const sample = readWaterTime(scene);
          if (started === null && sample !== null) {
            started = sample;
            continue;
          }
          later = sample;
          hull = readFleetShip(scene);
          if (!firstHull && hull && hull.radius > 1) {
            firstHull = hull;
            continue;
          }
          const moved = started !== null && later !== null && Math.abs(later - started) > 0;
          const channels = firstHull && hull ? poseChannels(firstHull, hull) : null;
          const navigation = Boolean(channels && (channels.horizontalDelta > 1e-4 || channels.yawDelta > 1e-4 || channels.propulsionDelta > 1e-4));
          const cruiseRollReady = input?.vesselId !== 'cruise' || Boolean(channels && channels.rollDelta > 1e-4);
          if (moved && navigation && cruiseRollReady) break;
        }
        const width = context?.drawingBufferWidth ?? 0;
        const height = context?.drawingBufferHeight ?? 0;
        let pixelMean = 0;
        if (context && width > 0 && height > 0) {
          const pixel = new Uint8Array(4);
          context.readPixels(
            Math.floor(width / 2),
            Math.floor(height / 2),
            1,
            1,
            context.RGBA,
            context.UNSIGNED_BYTE,
            pixel,
          );
          pixelMean = (pixel[0]! + pixel[1]! + pixel[2]!) / (3 * 255);
        }
        const settledHull = hull ?? readFleetShip(scene);
        const telemetry = (scene.userData as { marineShipTelemetry?: { roll?: number } }).marineShipTelemetry;
        const channels = firstHull && settledHull
          ? poseChannels(firstHull, settledHull)
          : { horizontalDelta: 0, yawDelta: 0, pitchDelta: 0, rollDelta: 0, propulsionDelta: 0 };
        return {
          consumerId: input?.vesselId ?? 'unknown',
          drawingBufferWidth: width,
          drawingBufferHeight: height,
          pixelMean,
          waveDelta: started === null || later === null ? 0 : Math.abs(later - started),
          shipRadius: settledHull?.radius ?? 0,
          shipX: settledHull?.x ?? null,
          shipY: settledHull?.y ?? null,
          shipZ: settledHull?.z ?? null,
          shipYaw: settledHull?.yaw ?? null,
          horizontalDelta: channels.horizontalDelta,
          yawDelta: channels.yawDelta,
          rollDelta: channels.rollDelta,
          propulsionDelta: channels.propulsionDelta,
          resolvedRoll: settledHull?.roll ?? null,
          telemetryRoll: typeof telemetry?.roll === 'number' ? telemetry.roll : null,
        };
      },
    };
    return () => {
      delete window.__marineConsumerObservation;
    };
  }, [renderer, scene]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // QA 入口（复审对齐）：既有帧契约入口 marine-frame 与本采集入口 marine-performance 均接受。
    const qaParams = new URLSearchParams(window.location.search).getAll('qa');
    if (!qaParams.includes('marine-performance') && !qaParams.includes('marine-frame')) return;
    const stageTimer = bindMarineStageTimer(renderer);
    // 预热后 60s 时间窗（二轮复审）：按经过时间维护窗口，start() 显式开始并重置
    // （丢弃启动/加载/编译帧），stop() 结束采集。
    const WINDOW_MS = 60_000;
    const samples: Array<{ ms: number; at: number }> = [];
    let stallTotalCount = 0;
    let stallWorstMs = 0;
    let collecting = false;
    let lastMs = performance.now();
    // 后台标签页忽略（四轮复审）：隐藏期间暂停采样并重置时间基准——
    // 恢复后的首个间隔是挂起时长，不计为长帧（不污染 p95/worst/长帧数）。
    let suspended = document.visibilityState === 'hidden';
    let wasSuspended = false;
    const onVisibilityChange = () => {
      const hidden = document.visibilityState === 'hidden';
      // 进入与恢复都重置时间基准；恢复后首个间隔是挂起时长，跳过（五轮复审）。
      if (hidden !== suspended) {
        suspended = hidden;
        lastMs = performance.now();
        if (!suspended) wasSuspended = true;
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    const tick = () => {
      const nowMs = performance.now();
      const delta = nowMs - lastMs;
      lastMs = nowMs;
      const skipThisFrame = wasSuspended;
      wasSuspended = false;
      if (!suspended && !skipThisFrame && collecting && delta > 0) {
        if (delta >= 1000) {
          // 复审修复（#2120 / 二轮）：前台 >=1s 卡顿不再静默丢弃——按测量窗口
          // 聚合（总数+最差，无截断），start() 重置（窗口切分干净）。
          stallTotalCount += 1;
          stallWorstMs = Math.max(stallWorstMs, delta);
          raf = requestAnimationFrame(tick);
          return;
        }
        samples.push({ ms: delta, at: nowMs });
        while (samples.length > 0 && nowMs - samples[0]!.at > WINDOW_MS) samples.shift();
      }
      raf = requestAnimationFrame(tick);
    };
    let raf = requestAnimationFrame(tick);
    // 复审修复（#2120）：绑定本 Canvas 的 R3F renderer（多 canvas 页面里
    // 猜画布可能取到图表画布）。
    const canvas = renderer.domElement;
    const gl = renderer.getContext() as WebGLRenderingContext | null;
    // GPU 渲染器身份（二轮复审）：WEBGL_debug_renderer_info 可用时读实际字符串，
    // 不可得才回退 null——硬件分级报告可按 GPU 归因。
    let gpuRenderer: string | null = null;
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const raw = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        if (typeof raw === 'string' && raw.length > 0) gpuRenderer = raw;
      }
    }
    window.__marinePerformanceEvidence = {
      start: () => {
        samples.length = 0;
        stallTotalCount = 0;
        stallWorstMs = 0;
        // 时间基准重置（P2 复审）：start() 前的阻塞段不计入本窗口长卡顿；
        // GPU 统计切窗口（只汇总本窗口完成的查询）。
        lastMs = performance.now();
        wasSuspended = false;
        marineGpuTimerStartWindow();
        collecting = true;
        void collectBoundStage(stageTimer, renderer as unknown as StageDrawRenderer, scene, camera);
      },
      stop: () => {
        collecting = false;
        // GPU 窗口同步结束（P2 二轮）：停止后延迟 read()/在途查询不改变数值。
        marineGpuTimerStopWindow();
      },
      stageTimer: (): StageTimerDescription & { readonly latest: TimingSample | null } => ({
        ...stageTimer.describe(),
        latest: stageTimer.latest(),
      }),
      read: () => {
        const input = contextInputRef.current?.();
        return buildMarinePerformanceReport({
          context: {
            drawingBufferWidth: gl?.drawingBufferWidth ?? 0,
            drawingBufferHeight: gl?.drawingBufferHeight ?? 0,
            cssWidth: canvas?.clientWidth ?? 0,
            cssHeight: canvas?.clientHeight ?? 0,
            // 渲染器实际 DPR（五轮复审）：drawingBuffer/CSS 推导——质量档 cap 后的
            // 真实像素负载（设备 DPR 3 + low 档 cap 1 → 报 1，不误标 3）。
            devicePixelRatio: canvas && canvas.clientWidth > 0 && gl
              ? Number(((gl.drawingBufferWidth ?? 0) / canvas.clientWidth).toFixed(3))
              : window.devicePixelRatio,
            gpuRenderer,
            browser: navigator.userAgent,
            hardwareConcurrency: navigator.hardwareConcurrency ?? 0,
            vesselId: input?.vesselId ?? document.querySelector('[data-sim-ui]')?.getAttribute('data-vessel') ?? 'unknown',
            cameraView: input?.cameraView ?? 'unknown',
            seaState: input?.seaState ?? 0,
            qualityTier: document.querySelector('[data-scene-quality-tier]')?.getAttribute('data-scene-quality-tier') ?? 'unknown',
          },
          // 口径诚实（复审）：样本来自 rAF 墙钟帧间隔——即便扩展存在，未经实际
          // query 采集/disjoint 丢弃不得标 timer-query。扩展存在性单独记录。
          ...readMarineGpuTimerEvidence(),
          timerQueryExtensionPresent: Boolean(gl?.getExtension('EXT_disjoint_timer_query_webgl2')),
          frameMsSamples: samples.map((sample) => sample.ms),
          longForegroundStallCount: stallTotalCount,
          longForegroundWorstMs: stallWorstMs,
          measuredAt: new Date().toISOString(),
        });
      },
      sampleCount: () => samples.length,
    };
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      delete window.__marinePerformanceEvidence;
    };
  }, [camera, renderer, scene]);
  return null;
}

type StageDrawRenderer = OffscreenRenderer & {
  render(scene: object, camera: object): void;
  readonly info: { readonly render: { calls: number } };
};

function readFleetShip(root: THREE.Object3D): {
  radius: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  propulsionAngle: number | null;
} | null {
  const hull = root.getObjectByName('fleet-ship-root');
  if (!hull) return null;
  let bestRadius = 0;
  hull.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.geometry) return;
    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    bestRadius = Math.max(bestRadius, mesh.geometry.boundingSphere?.radius ?? 0);
  });
  hull.updateWorldMatrix(true, false);
  const scale = new THREE.Vector3();
  hull.getWorldScale(scale);
  const radius = bestRadius * Math.max(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z), 1);
  if (radius <= 1) return null;
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  hull.getWorldPosition(position);
  hull.getWorldQuaternion(quaternion);
  const yaw = Math.atan2(
    2 * (quaternion.w * quaternion.y + quaternion.x * quaternion.z),
    1 - 2 * (quaternion.y * quaternion.y + quaternion.z * quaternion.z),
  );
  return {
    radius,
    x: position.x,
    y: position.y,
    z: position.z,
    yaw,
    pitch: hull.rotation.x,
    roll: hull.rotation.z,
    propulsionAngle: hull.getObjectByName('TJ_CUTTER')?.rotation.x ?? null,
  };
}

function poseChannels(
  first: { x: number; z: number; yaw: number; pitch: number; roll: number; propulsionAngle: number | null },
  later: { x: number; z: number; yaw: number; pitch: number; roll: number; propulsionAngle: number | null },
): { horizontalDelta: number; yawDelta: number; pitchDelta: number; rollDelta: number; propulsionDelta: number } {
  const wrap = (delta: number) => Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta)));
  const propulsionDelta = first.propulsionAngle === null || later.propulsionAngle === null
    ? 0
    : wrap(later.propulsionAngle - first.propulsionAngle);
  return {
    horizontalDelta: Math.hypot(later.x - first.x, later.z - first.z),
    yawDelta: wrap(later.yaw - first.yaw),
    pitchDelta: wrap(later.pitch - first.pitch),
    rollDelta: wrap(later.roll - first.roll),
    propulsionDelta,
  };
}

function readWaterTime(root: THREE.Object3D): number | null {
  let time: number | null = null;
  root.traverse((object) => {
    const material = (object as THREE.Mesh).material;
    if (!material || Array.isArray(material)) return;
    const uniforms = (material as THREE.ShaderMaterial).uniforms;
    const value = uniforms?.uTime?.value;
    if (typeof value === 'number') time = value;
  });
  return time;
}

async function renderOffscreenStage(renderer: StageDrawRenderer, scene: object, camera: object): Promise<void> {
  const targets: THREE.WebGLRenderTarget[] = [];
  try {
    const batch = await measureOffscreenBatch(renderer, {
      maxBatch: 4,
      createTarget(width, height) {
        const target = new THREE.WebGLRenderTarget(width, height);
        targets.push(target);
        return target;
      },
      async draw(index) {
        const advance = window.__marineStageAdvance;
        if (advance) await advance(index * 0.25);
        renderer.render(scene, camera);
        const calls = renderer.info.render.calls;
        if (calls <= 0) return 0;
        return calls * 1000 + index;
      },
    });
    if (!batch.workObserved) throw new Error('offscreen stage sample did not change the draw count');
  } finally {
    for (const target of targets) target.dispose();
  }
}

async function collectBoundStage(
  stageTimer: StageTimerBinding,
  renderer: StageDrawRenderer,
  scene: object,
  camera: object,
): Promise<{ readonly rounds: readonly TimingSample[]; readonly screenRecorded: false }> {
  for (let attempt = 0; attempt < 5 && marineGpuTimerPassActive(); attempt += 1) {
    await new Promise((resolve) => {
      requestAnimationFrame(() => resolve(undefined));
    });
  }
  const work = () => renderOffscreenStage(renderer, scene, camera);
  return collectStageWindow(stageTimer, work);
}

/** 对照页分项采集：不随普通帧运行，只在 collect() 时测离屏批次。 */
export function MarineStagePerformanceProbe() {
  const renderer = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    const stageTimer = bindMarineStageTimer(renderer);
    const drawRenderer = renderer as unknown as StageDrawRenderer;
    window.__marineStagePerformance = {
      describe: () => stageTimer.describe(),
      collect: () => collectBoundStage(stageTimer, drawRenderer, scene, camera),
    };
    return () => {
      delete window.__marineStagePerformance;
    };
  }, [camera, renderer, scene]);
  return null;
}


declare global {
  interface Window {
    __marinePerformanceEvidence?: {
      start(): void;
      stop(): void;
      stageTimer(): StageTimerDescription & { readonly latest: TimingSample | null };
      read(): ReturnType<typeof buildMarinePerformanceReport>;
      sampleCount(): number;
    };
    __marineConsumerObservation?: {
      collect(): Promise<{
        consumerId: string;
        drawingBufferWidth: number;
        drawingBufferHeight: number;
        pixelMean: number;
        waveDelta: number;
        shipRadius: number;
        shipX: number | null;
        shipY: number | null;
        shipZ: number | null;
        shipYaw: number | null;
        horizontalDelta: number;
        yawDelta: number;
        rollDelta: number;
        propulsionDelta: number;
        resolvedRoll: number | null;
        telemetryRoll: number | null;
      }>;
    };
    __marineStagePerformance?: {
      describe(): StageTimerDescription;
      collect(): Promise<{ readonly rounds: readonly TimingSample[]; readonly screenRecorded: false }>;
    };
    __marineStageAdvance?: (timeSeconds: number) => void | Promise<void>;
  }
}

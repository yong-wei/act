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

import { buildMarinePerformanceReport } from './performance-evidence';
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

/** Canvas 内的帧时间上报驱动：推动 governor 的自动降档并同步回 context（挂一次即可）。 */
export function SceneQualityDriver({ onTierChange }: { readonly onTierChange?: (tier: QualityTierId) => void }) {
  const { governor, syncTierFromGovernor, params } = useSceneQuality();
  const setDpr = useThree((state) => state.setDpr);
  const gl = useThree((state) => state.gl);
  const lastRef = useRef(0);

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
} = {}) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // QA 入口（复审对齐）：既有帧契约入口 marine-frame 与本采集入口 marine-performance 均接受。
    const qaParams = new URLSearchParams(window.location.search).getAll('qa');
    if (!qaParams.includes('marine-performance') && !qaParams.includes('marine-frame')) return;
    const samples: number[] = [];
    let lastMs = performance.now();
    const capacity = 3600; // ~60s @60fps
    const tick = () => {
      const nowMs = performance.now();
      const delta = nowMs - lastMs;
      lastMs = nowMs;
      if (delta > 0 && delta < 1000) {
        samples.push(delta);
        if (samples.length > capacity) samples.shift();
      }
      raf = requestAnimationFrame(tick);
    };
    let raf = requestAnimationFrame(tick);
    const canvas = document.querySelector('canvas') ?? null;
    const gl = canvas instanceof HTMLCanvasElement
      ? canvas.getContext('webgl2') ?? canvas.getContext('webgl')
      : null;
    window.__marinePerformanceEvidence = {
      read: () => buildMarinePerformanceReport({
        context: {
          drawingBufferWidth: gl?.drawingBufferWidth ?? 0,
          drawingBufferHeight: gl?.drawingBufferHeight ?? 0,
          cssWidth: canvas?.clientWidth ?? 0,
          cssHeight: canvas?.clientHeight ?? 0,
          devicePixelRatio: window.devicePixelRatio,
          gpuRenderer: null,
          browser: navigator.userAgent,
          hardwareConcurrency: navigator.hardwareConcurrency ?? 0,
          vesselId: contextInput?.().vesselId ?? document.querySelector('[data-sim-ui]')?.getAttribute('data-vessel') ?? 'unknown',
          cameraView: contextInput?.().cameraView ?? 'unknown',
          seaState: contextInput?.().seaState ?? 0,
          qualityTier: document.querySelector('[data-scene-quality-tier]')?.getAttribute('data-scene-quality-tier') ?? 'unknown',
        },
        // 口径诚实（复审）：样本来自 rAF 墙钟帧间隔——即便扩展存在，未经实际
        // query 采集/disjoint 丢弃不得标 timer-query。扩展存在性单独记录。
        gpuTimerAvailable: false,
        timerQueryExtensionPresent: Boolean(gl?.getExtension('EXT_disjoint_timer_query_webgl2')),
        frameMsSamples: [...samples],
        measuredAt: new Date().toISOString(),
      }),
      sampleCount: () => samples.length,
    };
    return () => {
      cancelAnimationFrame(raf);
      delete window.__marinePerformanceEvidence;
    };
  }, []);
  return null;
}


declare global {
  interface Window {
    __marinePerformanceEvidence?: {
      read(): ReturnType<typeof buildMarinePerformanceReport>;
      sampleCount(): number;
    };
  }
}

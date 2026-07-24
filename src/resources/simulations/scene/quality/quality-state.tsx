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

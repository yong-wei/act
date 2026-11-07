'use client';

import { Component, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Canvas, type CanvasProps } from '@react-three/fiber';
import { createMarineRenderer, marineRendererIdentity, type MarineGraphicsApi } from './marine-renderer';
import {
  classifyGraphicsFailure,
  probeModelCapability,
  type GraphicsFailureKind,
} from '../lib/simulation-capability';
import { publishMarineCanvasStatus } from '../lib/marine-status-store';

class RendererBoundary extends Component<{ children: ReactNode; onFailure: (error: Error) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onFailure(error); }
  render() { return this.state.failed ? null : this.props.children; }
}

const FAILURE_COPY: Record<GraphicsFailureKind, { title: string; cause: string; advice: string }> = {
  'context-unavailable': {
    title: '当前浏览器环境不支持本实验的三维画面',
    cause: '浏览器未开启硬件加速，或 WebGL/WebGPU 被浏览器或系统禁用，常见于云端浏览器与虚拟桌面。',
    advice: '请在支持 WebGL2 的桌面浏览器（Chrome/Edge/Firefox 近年版本）中打开本实验，并确认浏览器开启了硬件加速；机房设备可联系教师确认环境。',
  },
  'device-lost': {
    title: '三维画面连接中断',
    cause: '显卡驱动或浏览器释放了图形资源，画面连接被中断。',
    advice: '已提交的步骤成绩仍保留在你的账号记录中。当前步骤尚未提交的填写内容不会自动保存：如需保留，请在恢复画面后完成本步提交；刷新会需要重新填写当前步骤。若频繁中断，请更换一台设备继续。',
  },
  'init-defect': {
    title: '三维画面初始化出现异常',
    cause: '画面组件初始化时发生未预期的错误，可能是应用缺陷或环境兼容性问题。',
    advice: '请先尝试刷新页面或更换浏览器；若仍出现，请把下方诊断信息截图反馈给教师。',
  },
};

function MarineFailurePanel({ kind, detail, backend }: { kind: GraphicsFailureKind; detail?: string; backend?: string | null }) {
  const copy = FAILURE_COPY[kind];
  return (
    <div
      role="alert"
      data-marine-status="failed"
      data-marine-failure-kind={kind}
      className="mx-auto flex max-w-xl flex-col gap-3 rounded-lg border border-destructive/40 bg-card/95 p-5 text-sm leading-relaxed shadow-lg"
    >
      <p className="text-base font-semibold text-destructive">{copy.title}</p>
      <p className="text-muted-foreground">{copy.cause}</p>
      <p>{copy.advice}</p>
      <details className="rounded border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none">诊断信息（教师/排障用）</summary>
        <p className="mt-2 break-all">kind: {kind}{backend ? ` · backend: ${backend}` : ''}</p>
        {detail ? <p className="mt-1 break-all">{detail}</p> : null}
      </details>
    </div>
  );
}

/**
 * All marine consumers share the renderer; only device selection varies.
 * 三态（#2151）：preparing-model → preparing-graphics → runnable；失败面板按分类给出
 * 学生可理解的原因、支持环境与恢复建议，原始异常收进诊断折叠。
 */
export function MarineCanvas({ children, ...props }: Omit<CanvasProps, 'gl'>) {
  const [api, setApi] = useState<MarineGraphicsApi | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [failure, setFailure] = useState<{ kind: GraphicsFailureKind; detail?: string; backend?: string | null } | null>(null);
  const [fallback, setFallback] = useState(false);
  const [explicit] = useState<MarineGraphicsApi | null>(() => {
    if (typeof window === 'undefined') return null;
    const value = new URLSearchParams(window.location.search).get('graphics');
    return value === 'webgl' || value === 'webgpu' ? value : null;
  });

  useEffect(() => {
    let active = true;
    void probeModelCapability().then(() => {
      if (active) setModelReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (failure) return;
    if (explicit) { setApi(explicit); return; }
    // A separate canvas keeps an unsuccessful GPU context from locking the real canvas.
    void createMarineRenderer(document.createElement('canvas'), 'webgpu').then(renderer => {
      renderer.dispose();
      if (active) setApi('webgpu');
    }).catch(() => {
      if (active) { setFallback(true); setApi('webgl'); }
    });
    return () => { active = false; };
  }, [explicit, failure]);

  const failed = useCallback((failureError: Error, options?: { deviceLost?: boolean }) => {
    const kind = classifyGraphicsFailure(failureError, options);
    if (!options?.deviceLost && !explicit && api === 'webgpu' && kind === 'context-unavailable') {
      setFallback(true);
      setApi('webgl');
      return;
    }
    setFailure({ kind, detail: failureError.message, backend: api });
  }, [api, explicit]);

  const status = useMemo(() => {
    if (failure) return 'failed' as const;
    if (!modelReady) return 'preparing-model' as const;
    if (!api) return 'preparing-graphics' as const;
    return 'runnable' as const;
  }, [failure, modelReady, api]);

  useEffect(() => {
    publishMarineCanvasStatus(status);
  }, [status]);

  if (failure) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted/30 p-6">
        <MarineFailurePanel kind={failure.kind} detail={failure.detail} backend={failure.backend} />
      </div>
    );
  }
  if (!modelReady) {
    return <div role="status" data-marine-status="preparing-model" className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">正在准备仿真模型…</div>;
  }
  if (!api) {
    return <div role="status" data-marine-status="preparing-graphics" className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">正在准备海面画面…</div>;
  }
  return (
    <div className="h-full w-full" data-marine-graphics={api} data-marine-fallback={fallback} data-marine-status={status}>
      <RendererBoundary key={api} onFailure={(error) => failed(error)}>
        <Canvas {...props} gl={async options => {
          try {
            const renderer = await createMarineRenderer(options.canvas as HTMLCanvasElement, api);
            renderer.onDeviceLost = () => failed(new Error('图形设备连接已中断。'), { deviceLost: true });
            renderer.domElement.dataset.marineBackend = marineRendererIdentity(renderer).api;
            return renderer;
          } catch (canvasError) {
            failed(canvasError instanceof Error ? canvasError : new Error('图形接口初始化失败。'));
            throw canvasError;
          }
        }}>{children}</Canvas>
      </RendererBoundary>
    </div>
  );
}

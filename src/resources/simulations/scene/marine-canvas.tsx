'use client';

import { Component, useCallback, useEffect, useState, type ReactNode } from 'react';
import { Canvas, type CanvasProps } from '@react-three/fiber';
import { createMarineRenderer, marineRendererIdentity, type MarineGraphicsApi } from './marine-renderer';


class RendererBoundary extends Component<{ children: ReactNode; onFailure: (error: Error) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onFailure(error); }
  render() { return this.state.failed ? null : this.props.children; }
}

/** All marine consumers share the renderer; only device selection varies. */
export function MarineCanvas({ children, ...props }: Omit<CanvasProps, 'gl'>) {
  const [api, setApi] = useState<MarineGraphicsApi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const [explicit] = useState<MarineGraphicsApi | null>(() => {
    if (typeof window === 'undefined') return null;
    const value = new URLSearchParams(window.location.search).get('graphics');
    return value === 'webgl' || value === 'webgpu' ? value : null;
  });
  useEffect(() => {
    let active = true;
    if (explicit) { setApi(explicit); return; }
    // A separate canvas keeps an unsuccessful GPU context from locking the real canvas.
    void createMarineRenderer(document.createElement('canvas'), 'webgpu').then(renderer => {
      renderer.dispose();
      if (active) setApi('webgpu');
    }).catch(() => {
      if (active) { setFallback(true); setApi('webgl'); }
    });
    return () => { active = false; };
  }, [explicit]);
  const failed = useCallback((failure: Error) => {
    if (!explicit && api === 'webgpu') { setFallback(true); setApi('webgl'); }
    else setError(failure.message);
  }, [api, explicit]);
  if (error) return <div role="alert">海面场景初始化失败：{error}</div>;
  if (!api) return <div role="status">正在准备海面场景…</div>;
  return (
    <div className="h-full w-full" data-marine-graphics={api} data-marine-fallback={fallback}>
      <RendererBoundary key={api} onFailure={failed}>
        <Canvas {...props} gl={async options => {
          try {
            const renderer = await createMarineRenderer(options.canvas as HTMLCanvasElement, api);
            renderer.onDeviceLost = () => failed(new Error('图形设备连接已中断。'));
            renderer.domElement.dataset.marineBackend = marineRendererIdentity(renderer).api;
            return renderer;
          } catch (failure) {
            failed(failure instanceof Error ? failure : new Error('图形接口初始化失败。'));
            throw failure;
          }
        }}>{children}</Canvas>
      </RendererBoundary>
    </div>
  );
}

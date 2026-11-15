// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MarineCanvas } from '../scene/marine-canvas';
import { getMarineCanvasStatus, resetMarineCanvasStatusForTest } from '../lib/marine-status-store';

const mocks = vi.hoisted(() => ({create:vi.fn(),created:null as null | ((state:unknown) => void)}));
vi.mock('@react-three/fiber', () => ({Canvas:({onCreated}:{onCreated:(state:unknown) => void}) => {
  mocks.created=onCreated;
  return <div data-canvas-fixture />;
}}));
vi.mock('../scene/marine-renderer', () => ({createMarineRenderer:mocks.create,marineRendererIdentity:() => ({api:'fixture'})}));
vi.mock('../lib/simulation-capability', () => ({probeModelCapability:async () => ({ok:true}),classifyGraphicsFailure:() => 'context-unavailable'}));

let root:Root;
let container:HTMLDivElement;
beforeEach(() => {
  resetMarineCanvasStatusForTest();
  window.history.replaceState({},'', '/?graphics=webgl');
  mocks.create.mockReset(); mocks.created=null;
  container=document.createElement('div');
  document.body.append(container);
  root=createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe('画布实际就绪状态', () => {
  it('真实画布创建完成前保持准备状态，卸载时清除可运行状态', async () => {
    const onCreated=vi.fn();
    await act(async () => {root.render(<MarineCanvas onCreated={onCreated} />);});
    expect(getMarineCanvasStatus()).toBe('preparing-graphics');
    expect(container.querySelector('[data-marine-status="preparing-graphics"]')).not.toBeNull();
    await act(async () => {mocks.created?.({});});
    expect(onCreated).toHaveBeenCalledOnce();
    expect(getMarineCanvasStatus()).toBe('runnable');
    await act(async () => root.unmount());
    expect(getMarineCanvasStatus()).toBeNull();
  });

  it('自动探测超时后切换回退画布，并等待实际创建回执', async () => {
    window.history.replaceState({},'', '/');
    mocks.create.mockRejectedValue(new Error('Graphics context unavailable: initialization timed out.'));
    await act(async () => {root.render(<MarineCanvas />);});
    const canvas=container.querySelector('[data-marine-graphics="webgl"]');
    expect(canvas?.getAttribute('data-marine-fallback')).toBe('true');
    expect(getMarineCanvasStatus()).toBe('preparing-graphics');
    await act(async () => {mocks.created?.({});});
    expect(getMarineCanvasStatus()).toBe('runnable');
  });
});

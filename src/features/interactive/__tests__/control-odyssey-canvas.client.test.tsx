// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { GameCanvas } from '@/resources/interactive-learning/control-odyssey/components/GameCanvas';
import { TelemetryScope } from '@/resources/interactive-learning/control-odyssey/components/TelemetryScope';
import { useGameStore } from '@/resources/interactive-learning/control-odyssey/store/game-store';
import { getTelemetryHistory, appendTelemetry } from '@/resources/interactive-learning/control-odyssey/engine/telemetry-history';

vi.mock('@/lib/control-engine/client', async () => {
  const server = await import('@/lib/control-engine/server');
  return {
    isBrowserControlEngineReady: () => true,
    preloadBrowserControlEngine: async () => undefined,
    computeSimulationStepBrowserSync: server.computeControlOdysseyServerStep,
  };
});
vi.mock('@/resources/interactive-learning/control-odyssey/components/ShipAvatar', () => ({ ShipAvatar: () => <div /> }));

describe('Odyssey canvas sampling and terminal publication', () => {
  let root: Root;
  let container: HTMLDivElement;
  let frames: Map<number, FrameRequestCallback>;
  let nextId: number;
  let draw: ReturnType<typeof vi.fn>;
  let resize: () => void;
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    frames = new Map();
    nextId = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++nextId, callback); return nextId; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { resize = callback; }
      observe() {} disconnect() {}
    });
    draw = vi.fn();
    const context = new Proxy({}, { get: (_target, property) => property === 'clearRect' ? draw : vi.fn(), set: () => true });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as any);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useGameStore.getState().resetGame();
    useGameStore.setState({
      currentLevelId: 'level-1', currentTier: 'bronze', controlMode: 'AUTO', controllerId: 'P',
      controllerLevels: { P: 5, PI: 0, PD: 0, PID: 0, VFB: 0, FF: 0, SMITH: 0 },
      pidParams: { kp: 1.6, ki: 0, kd: 0 }, difficultyScale: 1,
      enableSpeedFeedback: false, enableFeedforward: false, enableSmithPredictor: false,
    });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  const frame = async (time: number) => {
    const callbacks = [...frames.values()];
    frames.clear();
    await act(async () => callbacks.forEach(callback => callback(time)));
  };

  it('samples every actual substep, updates panels at ten Hz and flushes once at victory', async () => {
    const update = vi.fn();
    const unsubscribe = useGameStore.subscribe(update);
    await act(async () => root.render(<GameCanvas />));
    await act(async () => useGameStore.getState().setGameState('RUNNING'));
    update.mockClear();
    for (let time = 100; time <= 21000 && useGameStore.getState().gameState === 'RUNNING'; time += 100) await frame(time);
    expect(useGameStore.getState().gameState).toBe('VICTORY');
    expect(useGameStore.getState().metrics.settlingTime).toBeCloseTo(2.8, 10);
    expect(getTelemetryHistory()).toHaveLength(1160);
    expect(useGameStore.getState().inputTrace?.totalSteps).toBe(1160);
    // Metrics and offset use two store updates per six samples; the terminal is flushed separately.
    expect(update.mock.calls.length).toBeLessThan(400);
    const final = useGameStore.getState();
    await frame(22000);
    expect(useGameStore.getState().metrics).toEqual(final.metrics);
    expect(getTelemetryHistory()).toHaveLength(1160);
    unsubscribe();
  }, 15_000);

  it('does not sample while paused and clears the actual trace and telemetry on reset', async () => {
    await act(async () => root.render(<GameCanvas />));
    await act(async () => useGameStore.getState().setGameState('RUNNING'));
    await frame(100);
    await frame(200);
    expect(getTelemetryHistory()).toHaveLength(6);
    await act(async () => useGameStore.getState().setGameState('PAUSED'));
    await frame(300);
    await frame(400);
    expect(getTelemetryHistory()).toHaveLength(6);
    await act(async () => useGameStore.getState().setGameState('RUNNING'));
    await frame(500);
    expect(getTelemetryHistory()).toHaveLength(12);
    await act(async () => useGameStore.getState().resetGame());
    expect(getTelemetryHistory()).toHaveLength(0);
    expect(useGameStore.getState().inputTrace).toBeNull();
    await frame(600);
    expect(useGameStore.getState().distance).toBe(0);
  });

  it('redraws the scope only for telemetry changes and size changes', async () => {
    await act(async () => root.render(<TelemetryScope />));
    expect(draw).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(0);
    await frame(100);
    expect(draw).toHaveBeenCalledTimes(1);
    appendTelemetry({ r: 200, y: 200, u: 0, distance: 0 });
    appendTelemetry({ r: 200, y: 210, u: 0.1, distance: 2.5 });
    expect(frames.size).toBe(1);
    await frame(200);
    expect(draw).toHaveBeenCalledTimes(2);
    expect(frames.size).toBe(0);
    resize();
    await frame(300);
    expect(draw).toHaveBeenCalledTimes(3);
    expect(frames.size).toBe(0);
  });
});

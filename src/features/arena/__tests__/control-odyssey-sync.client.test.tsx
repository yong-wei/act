// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  submitGameScore: vi.fn(),
  getControlProfile: vi.fn(),
  getTopControlConfigs: vi.fn(),
  completeArenaPath: vi.fn().mockResolvedValue(true),
}));

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('@/app/actions/control-odyssey', () => ({
  submitGameScore: mocks.submitGameScore,
  getControlProfile: mocks.getControlProfile,
  getTopControlConfigs: mocks.getTopControlConfigs,
  getLevelLeaderboard: vi.fn().mockResolvedValue([]),
  purchaseController: vi.fn(),
  upgradeController: vi.fn(),
  redeemControlAICredits: vi.fn(),
  getControlAiHistory: vi.fn().mockResolvedValue(null),
  saveControlAiHistory: vi.fn(),
}));
vi.mock('@/features/arena/arena-path-journey-control', () => ({
  useArenaPathSubmissionCompletion: () => mocks.completeArenaPath,
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
    <button onClick={onClick} {...props}>{children}</button>,
}));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));
vi.mock('@/resources/interactive-learning/control-odyssey/components/GameCanvas', () => ({ GameCanvas: () => <div /> }));
vi.mock('@/resources/interactive-learning/control-odyssey/components/TelemetryScope', () => ({ TelemetryScope: () => <div /> }));
vi.mock('@/resources/interactive-learning/control-odyssey/components/ShipAvatar', () => ({ ShipAvatar: () => <div /> }));
vi.mock('@/resources/interactive-learning/control-odyssey/components/TuningPanel', () => ({ TuningPanel: () => <div /> }));
vi.mock('@/resources/interactive-learning/control-odyssey/components/LevelSelector', () => ({
  LevelSelector: ({ onConfirmLevel }: { onConfirmLevel: () => void }) =>
    <button onClick={onConfirmLevel}>确认关卡</button>,
}));
vi.mock('@/resources/interactive-learning/control-odyssey/store/game-store', () => {
  const store = {
    gameState: 'VICTORY', setGameState: vi.fn(), resetGame: vi.fn(), distance: 100, maxDistance: 100,
    metrics: { maxOvershoot: 1, settlingTime: 2, steadyError: 1, avgRelativeError: 1, controlEnergy: 1, controlSmoothness: 1 },
    controlMode: 'AUTO', setControlMode: vi.fn(), setCurrentLevelId: vi.fn(), currentTier: 'bronze', setCurrentTier: vi.fn(),
    controllerId: 'P', setControllerId: vi.fn(), unlockedControllers: ['P'], setUnlockedControllers: vi.fn(),
    controllerLevels: { P: 1, PI: 0, PD: 0, PID: 0, VFB: 0, FF: 0, SMITH: 0 }, setControllerLevels: vi.fn(),
    pidParams: { kp: 1, ki: 0, kd: 0 }, extraParams: { speedFeedbackTau: 0.05, feedforwardGain: 0.05, smithDelay: 0.1 },
    enableSpeedFeedback: false, enableFeedforward: false, enableSmithPredictor: false,
    difficultyScale: 1, setDifficultyScale: vi.fn(), autoOffset: 0, controlCredits: 0, setControlCredits: vi.fn(), runId: 'run-ui',
  };
  return { useGameStore: () => store };
});

import { ControlOdysseyGame } from '@/resources/interactive-learning/control-odyssey';

const profile = {
  credits: 8,
  unlocks: ['P'],
  tierProgress: { 'level-1': 'silver' },
  controllerLevels: { P: 1, PI: 0, PD: 0, PID: 0, VFB: 0, FF: 0, SMITH: 0 },
  bestScores: { 'level-1': { overall: 820, tiers: { bronze: 820 } } },
};

describe('Control Odyssey sync lifecycle', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mocks.submitGameScore.mockResolvedValue({ id: 'log-ui' });
    mocks.getControlProfile.mockResolvedValue(profile);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  async function openVictory() {
    await act(async () => root.render(<ControlOdysseyGame />));
    await act(async () => Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('进入星域选择'))?.click());
    await act(async () => Array.from(container.querySelectorAll('button')).find((button) => button.textContent === '确认关卡')?.click());
    await act(async () => Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('启动引擎'))?.click());
  }

  it('reaches synchronized after profile best-score rerender and later config completion', async () => {
    let resolveConfigs!: (value: unknown[]) => void;
    mocks.getTopControlConfigs
      .mockResolvedValueOnce([])
      .mockImplementationOnce(() => new Promise((resolve) => { resolveConfigs = resolve; }));

    await openVictory();
    expect(container.textContent).toContain('正在同步成绩与学习路径…');
    await act(async () => resolveConfigs([]));

    expect(container.textContent).toContain('成绩与学习路径已同步。');
    expect(container.textContent).not.toContain('正在同步成绩与学习路径…');
  });

  it('cancels the pending completion update after unmount', async () => {
    let resolveConfigs!: (value: unknown[]) => void;
    mocks.getTopControlConfigs
      .mockResolvedValueOnce([])
      .mockImplementationOnce(() => new Promise((resolve) => { resolveConfigs = resolve; }));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await openVictory();
    await act(async () => root.unmount());
    await act(async () => resolveConfigs([]));

    expect(consoleError).not.toHaveBeenCalledWith(expect.stringMatching(/unmounted|state update/i));
  });
});

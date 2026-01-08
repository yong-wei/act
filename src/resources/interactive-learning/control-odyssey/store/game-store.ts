import { create } from 'zustand';
import type { ControllerId, LevelTier } from '../level-data';
import { clearTelemetry } from '../engine/telemetry-history';

export type GameState = 'IDLE' | 'RUNNING' | 'PAUSED' | 'GAME_OVER' | 'VICTORY';
export type ControlMode = 'MANUAL' | 'AUTO';

interface ControlOdysseyMetrics {
  maxOvershoot: number;
  settlingTime: number;
  iae: number; // Integral Absolute Error
}

interface ControlOdysseyPidParams {
  kp: number;
  ki: number;
  kd: number;
}

interface ControlOdysseyState {
  gameState: GameState;
  currentLevelId: string; // 当前关卡 ID
  score: number;
  distance: number;
  maxDistance: number;
  metrics: ControlOdysseyMetrics;
  shipY: number;
  shipU: number;
  shipR: number;
  resetToken: number;
  controlMode: ControlMode;
  pidParams: ControlOdysseyPidParams;
  currentTier: LevelTier;
  controllerId: ControllerId;
  unlockedControllers: ControllerId[];
  controlCredits: number;
  runId: string;

  // 游戏控制
  setGameState: (state: GameState) => void;
  setCurrentLevelId: (id: string) => void;
  setControlMode: (mode: ControlMode) => void;
  setCurrentTier: (tier: LevelTier) => void;
  setControllerId: (controllerId: ControllerId) => void;
  setUnlockedControllers: (controllers: ControllerId[]) => void;
  setControlCredits: (credits: number) => void;
  setPidParams: (params: Partial<ControlOdysseyPidParams>) => void;
  updateMetrics: (
    shipY: number,
    shipU: number,
    shipR: number,
    distance: number,
    metrics: Partial<ControlOdysseyMetrics>
  ) => void;
  resetGame: (newMaxDistance?: number) => void;
}

const createRunId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const useGameStore = create<ControlOdysseyState>((set) => ({
  gameState: 'IDLE',
  currentLevelId: 'level-1',
  score: 0,
  distance: 0,
  maxDistance: 3000,
  metrics: { maxOvershoot: 0, settlingTime: 0, iae: 0 },
  shipY: 200,
  shipU: 0,
  shipR: 200,
  resetToken: 0,
  controlMode: 'MANUAL',
  pidParams: { kp: 1, ki: 0, kd: 0 },
  currentTier: 'bronze',
  controllerId: 'P',
  unlockedControllers: ['P'],
  controlCredits: 0,
  runId: createRunId(),

  setGameState: (state) => {
    if (state === 'IDLE') {
      clearTelemetry();
    }
    set({ gameState: state });
  },
  setCurrentLevelId: (id) => set({ currentLevelId: id }),
  setControlMode: (mode) => set({ controlMode: mode }),
  setCurrentTier: (tier) => set({ currentTier: tier }),
  setControllerId: (controllerId) => set({ controllerId }),
  setUnlockedControllers: (controllers) => set({ unlockedControllers: controllers }),
  setControlCredits: (credits) => set({ controlCredits: credits }),
  setPidParams: (params) =>
    set((state) => ({
      pidParams: { ...state.pidParams, ...params }
    })),
  updateMetrics: (shipY, shipU, shipR, distance, metrics) =>
    set((state) => ({
      shipY,
      shipU,
      shipR,
      distance,
      metrics: { ...state.metrics, ...metrics }
    })),

  resetGame: (newMaxDistance = 3000) => {
    clearTelemetry();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('control-odyssey-clear-scope'));
    }

    set((state) => ({
      gameState: 'IDLE',
      score: 0,
      distance: 0,
      maxDistance: newMaxDistance,
      metrics: { maxOvershoot: 0, settlingTime: 0, iae: 0 },
      shipY: 200,
      shipU: 0,
      shipR: 200,
      runId: createRunId(),
      resetToken: state.resetToken + 1
    }));
  }
}));

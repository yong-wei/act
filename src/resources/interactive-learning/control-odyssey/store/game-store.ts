import { create } from 'zustand';
import type { BaseControllerId, ControllerId, LevelTier } from '../level-data';
import { clearTelemetry } from '../engine/telemetry-history';

export type GameState = 'IDLE' | 'RUNNING' | 'PAUSED' | 'GAME_OVER' | 'VICTORY';
export type ControlMode = 'MANUAL' | 'AUTO';

interface ControlOdysseyMetrics {
  maxOvershoot: number;
  settlingTime: number;
  avgRelativeError: number; // 平均相对误差 (%)
  steadyError: number; // 稳态误差 (%)
}

interface ControlOdysseyPidParams {
  kp: number;
  ki: number;
  kd: number;
}

interface ControlOdysseyExtraParams {
  speedFeedbackTau: number;
  feedforwardGain: number;
  smithDelay: number;
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
  extraParams: ControlOdysseyExtraParams;
  currentTier: LevelTier;
  controllerId: BaseControllerId;
  unlockedControllers: ControllerId[];
  controllerLevels: Record<ControllerId, number>;
  enableSpeedFeedback: boolean;
  enableFeedforward: boolean;
  enableSmithPredictor: boolean;
  difficultyScale: number;
  autoOffset: number;
  controlCredits: number;
  runId: string;

  // 游戏控制
  setGameState: (state: GameState) => void;
  setCurrentLevelId: (id: string) => void;
  setControlMode: (mode: ControlMode) => void;
  setCurrentTier: (tier: LevelTier) => void;
  setControllerId: (controllerId: BaseControllerId) => void;
  setUnlockedControllers: (controllers: ControllerId[]) => void;
  setControllerLevels: (levels: Record<ControllerId, number>) => void;
  setSpeedFeedbackEnabled: (enabled: boolean) => void;
  setFeedforwardEnabled: (enabled: boolean) => void;
  setSmithPredictorEnabled: (enabled: boolean) => void;
  setDifficultyScale: (scale: number) => void;
  setAutoOffset: (offset: number) => void;
  setControlCredits: (credits: number) => void;
  setPidParams: (params: Partial<ControlOdysseyPidParams>) => void;
  setExtraParams: (params: Partial<ControlOdysseyExtraParams>) => void;
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
  metrics: { maxOvershoot: 0, settlingTime: 0, avgRelativeError: 0, steadyError: 0 },
  shipY: 200,
  shipU: 0,
  shipR: 200,
  resetToken: 0,
  controlMode: 'MANUAL',
  pidParams: { kp: 0.05, ki: 0.02, kd: 0.02 },
  extraParams: { speedFeedbackTau: 0.05, feedforwardGain: 0.05, smithDelay: 0.1 },
  currentTier: 'bronze',
  controllerId: 'P',
  unlockedControllers: ['P'],
  controllerLevels: { P: 1, PI: 0, PD: 0, PID: 0, VFB: 0, FF: 0, SMITH: 0 },
  enableSpeedFeedback: false,
  enableFeedforward: false,
  enableSmithPredictor: false,
  difficultyScale: 1,
  autoOffset: 0,
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
  setControllerLevels: (levels) => set({ controllerLevels: levels }),
  setSpeedFeedbackEnabled: (enabled) => set({ enableSpeedFeedback: enabled }),
  setFeedforwardEnabled: (enabled) => set({ enableFeedforward: enabled }),
  setSmithPredictorEnabled: (enabled) => set({ enableSmithPredictor: enabled }),
  setDifficultyScale: (scale) => set({ difficultyScale: scale }),
  setAutoOffset: (offset) => set({ autoOffset: offset }),
  setControlCredits: (credits) => set({ controlCredits: credits }),
  setPidParams: (params) =>
    set((state) => ({
      pidParams: { ...state.pidParams, ...params }
    })),
  setExtraParams: (params) =>
    set((state) => ({
      extraParams: { ...state.extraParams, ...params }
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
      metrics: { maxOvershoot: 0, settlingTime: 0, avgRelativeError: 0, steadyError: 0 },
      shipY: 200,
      shipU: 0,
      shipR: 200,
      autoOffset: 0,
      runId: createRunId(),
      resetToken: state.resetToken + 1
    }));
  }
}));

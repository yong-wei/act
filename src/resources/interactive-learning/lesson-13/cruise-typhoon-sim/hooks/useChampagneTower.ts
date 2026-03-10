/**
 * useChampagneTower - 香槟塔物理模型 Hook
 *
 * 基于简化的倒立摆模型模拟香槟塔的摇晃行为。
 * 当船舶横摇或侧向加速度增大时，香槟塔会产生相应的摆动。
 * 摆角超过阈值时触发"倒塌"状态。
 *
 * 物理模型：
 *   θ'' + 2ζωθ' + ω²θ = a_lateral / L
 *
 * 其中：
 *   θ: 香槟塔相对垂直方向的摆角
 *   ω: 自然频率 = sqrt(g/L)
 *   ζ: 阻尼比
 *   a_lateral: 侧向加速度
 *   L: 等效摆长（塔高）
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  ChampagneTowerState,
  ChampagneTowerParams,
} from '../../types';
import { DEFAULT_CHAMPAGNE_TOWER_PARAMS } from '../../types';
import { SimulationClock } from '@/lib/simulation';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const G = 9.81; // 重力加速度

export interface UseChampagneTowerOptions {
  params?: Partial<ChampagneTowerParams>;
  /** 更新频率 (Hz) */
  updateRate?: number;
  /** 是否自动重置倒塌状态 */
  autoReset?: boolean;
  /** 自动重置延迟 (ms) */
  resetDelay?: number;
}

export interface UseChampagneTowerReturn {
  state: ChampagneTowerState;
  /** 更新侧向加速度输入 */
  updateInput: (lateralAccel: number, shipRoll?: number) => void;
  /** 重置到初始状态 */
  reset: () => void;
  /** 是否已倒塌 */
  hasFallen: boolean;
  /** 倒塌次数 */
  fallCount: number;
}

/**
 * 香槟塔物理模型 Hook
 */
export function useChampagneTower(
  options: UseChampagneTowerOptions = {}
): UseChampagneTowerReturn {
  const {
    params: customParams,
    updateRate = 60,
    autoReset = false,
    resetDelay = 3000,
  } = options;

  // 合并参数
  const params: ChampagneTowerParams = {
    ...DEFAULT_CHAMPAGNE_TOWER_PARAMS,
    ...customParams,
  };

  // 计算物理参数
  const naturalFreq = Math.sqrt(G / params.height); // ω = sqrt(g/L)
  const fallThresholdRad = params.fallThreshold * DEG_TO_RAD;

  // 状态
  const [state, setState] = useState<ChampagneTowerState>({
    angle: 0,
    angularVelocity: 0,
    isFalling: false,
    stability: 1,
    lateralAccel: 0,
  });

  const [fallCount, setFallCount] = useState(0);

  // 内部状态引用（用于动画循环）
  const stateRef = useRef({
    angle: 0,
    angularVelocity: 0,
    lateralAccel: 0,
    shipRoll: 0,
  });

  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const clockRef = useRef(new SimulationClock({ dt: 1 / updateRate, maxSubSteps: 6 }));
  const isFallingRef = useRef(false);

  // 物理模拟步进
  const step = useCallback(
    (dt: number) => {
      const { angle, angularVelocity, lateralAccel, shipRoll } = stateRef.current;

      // 计算外力（侧向加速度和船舶横摇的影响）
      // 将加速度转换为等效角加速度
      const externalForce = (lateralAccel * G) / params.height + shipRoll * DEG_TO_RAD * 0.5;

      // 二阶系统动力学: θ'' = -2ζωθ' - ω²θ + F/L
      const angularAccel =
        -2 * params.dampingRatio * naturalFreq * angularVelocity -
        naturalFreq * naturalFreq * angle +
        externalForce;

      // 欧拉积分
      const newVelocity = angularVelocity + angularAccel * dt;
      const newAngle = angle + newVelocity * dt;

      // 更新状态
      stateRef.current.angle = newAngle;
      stateRef.current.angularVelocity = newVelocity;

      // 检查倒塌
      const hasFallen = Math.abs(newAngle) > fallThresholdRad;

      if (hasFallen && !isFallingRef.current) {
        isFallingRef.current = true;
        setFallCount((prev) => prev + 1);
      }

      // 计算稳定性 (0-1)
      const stability = Math.max(0, 1 - Math.abs(newAngle) / fallThresholdRad);

      // 更新 React 状态
      setState({
        angle: newAngle,
        angularVelocity: newVelocity,
        isFalling: hasFallen,
        stability,
        lateralAccel,
      });
    },
    [params.dampingRatio, params.height, naturalFreq, fallThresholdRad]
  );

  // 动画循环
  useEffect(() => {
    clockRef.current = new SimulationClock({ dt: 1 / updateRate, maxSubSteps: 6 });
  }, [updateRate]);

  useEffect(() => {
    const animate = (time: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = time;
      }

      const frameDelta = Math.min((time - lastTimeRef.current) / 1000, 0.1); // 限制最大步长
      lastTimeRef.current = time;

      clockRef.current.advance(frameDelta, step);

      animationRef.current = requestAnimationFrame(animate);
    };

    clockRef.current.reset();
    lastTimeRef.current = 0;
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [step]);

  // 更新输入
  const updateInput = useCallback((lateralAccel: number, shipRoll: number = 0) => {
    stateRef.current.lateralAccel = lateralAccel;
    stateRef.current.shipRoll = shipRoll;
  }, []);

  // 重置
  const reset = useCallback(() => {
    stateRef.current = {
      angle: 0,
      angularVelocity: 0,
      lateralAccel: 0,
      shipRoll: 0,
    };
    isFallingRef.current = false;
    clockRef.current.reset();
    lastTimeRef.current = 0;
    setState({
      angle: 0,
      angularVelocity: 0,
      isFalling: false,
      stability: 1,
      lateralAccel: 0,
    });
  }, []);

  // 自动重置
  useEffect(() => {
    if (autoReset && isFallingRef.current) {
      const timer = setTimeout(() => {
        reset();
      }, resetDelay);
      return () => clearTimeout(timer);
    }
  }, [autoReset, resetDelay, reset, state.isFalling]);

  return {
    state,
    updateInput,
    reset,
    hasFallen: state.isFalling,
    fallCount,
  };
}

/**
 * 获取香槟塔状态的可视化属性
 */
export function getChampagneTowerVisuals(state: ChampagneTowerState) {
  const angleDeg = state.angle * RAD_TO_DEG;
  const absAngle = Math.abs(angleDeg);

  // 颜色根据稳定性变化
  let statusColor: string;
  let statusText: string;

  if (state.isFalling) {
    statusColor = '#ef4444'; // red
    statusText = '倒塌!';
  } else if (state.stability < 0.3) {
    statusColor = '#f59e0b'; // amber
    statusText = '危险';
  } else if (state.stability < 0.6) {
    statusColor = '#eab308'; // yellow
    statusText = '摇晃';
  } else {
    statusColor = '#22c55e'; // green
    statusText = '稳定';
  }

  return {
    angleDeg,
    absAngle,
    statusColor,
    statusText,
    rotateStyle: `rotate(${angleDeg}deg)`,
    stabilityPercent: Math.round(state.stability * 100),
  };
}

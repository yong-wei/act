/**
 * useEthicalMonitor - 伦理监控 Hook
 *
 * 在仿真过程中实时监控伦理指标，触发违规警告
 */

import { useCallback, useRef, useState } from 'react';
import { type SimulationState, type SimulationMetrics, type EthicalViolation, type ViolationType } from '@/resources/simulations/types';
import { ETHICAL_THRESHOLDS, VIOLATION_DESCRIPTIONS, VIOLATION_SEVERITY, ETHICS_SCORE_DEDUCTION } from '@/lib/constants/ethics';

interface UseEthicalMonitorOptions {
  onViolation?: (violation: EthicalViolation) => void;
  autoResume?: boolean; // 整改后是否自动恢复仿真
}

interface UseEthicalMonitorReturn {
  isViolating: boolean;
  currentViolation: EthicalViolation | null;
  violations: EthicalViolation[];
  checkViolation: (state: SimulationState, metrics: SimulationMetrics, prevState?: SimulationState) => EthicalViolation | null;
  resolveViolation: (justification: string) => Promise<void>;
  clearViolation: () => void;
  getViolationDescription: (type: ViolationType) => { title: string; consequence: string; suggestion: string };
  getTotalDeduction: () => number;
}

export function useEthicalMonitor(options: UseEthicalMonitorOptions = {}): UseEthicalMonitorReturn {
  const { onViolation, autoResume = false } = options;

  const [isViolating, setIsViolating] = useState(false);
  const [currentViolation, setCurrentViolation] = useState<EthicalViolation | null>(null);
  const [violations, setViolations] = useState<EthicalViolation[]>([]);

  const prevRudderRef = useRef<number>(0);
  const prevTimeRef = useRef<number>(0);

  /**
   * 触发违规
   */
  const triggerViolation = useCallback(
    (violation: EthicalViolation) => {
      setIsViolating(true);
      setCurrentViolation(violation);
      setViolations((prev) => [...prev, violation]);
      onViolation?.(violation);
    },
    [onViolation]
  );

  /**
   * 检查仿真状态是否违规
   */
  const checkViolation = useCallback(
    (state: SimulationState, metrics: SimulationMetrics, prevState?: SimulationState): EthicalViolation | null => {
      // 如果当前已经在处理违规，不重复检测
      if (isViolating) return null;

      const dt = state.time - prevTimeRef.current;
      prevTimeRef.current = state.time;

      // 计算舵角变化速度
      const rudderRate = dt > 0 ? Math.abs(state.rudder - prevRudderRef.current) / dt : 0;
      prevRudderRef.current = state.rudder;

      // 1. 检查舵角速度
      if (rudderRate > ETHICAL_THRESHOLDS.MAX_RUDDER_RATE) {
        const violation: EthicalViolation = {
          type: 'EXCESSIVE_RUDDER_RATE',
          thresholdValue: ETHICAL_THRESHOLDS.MAX_RUDDER_RATE,
          actualValue: rudderRate,
          timestamp: state.time,
          description: `舵角变化速度 ${rudderRate.toFixed(2)}°/s 超过安全阈值 ${ETHICAL_THRESHOLDS.MAX_RUDDER_RATE}°/s`,
        };
        triggerViolation(violation);
        return violation;
      }

      // 2. 检查横摇角（需要从波浪计算中获取）
      const rollAngle = Math.abs(state.waveRoll * (180 / Math.PI)); // 转换为度
      if (rollAngle > ETHICAL_THRESHOLDS.MAX_ROLL_ANGLE) {
        const violation: EthicalViolation = {
          type: 'EXCESSIVE_ROLL_ANGLE',
          thresholdValue: ETHICAL_THRESHOLDS.MAX_ROLL_ANGLE,
          actualValue: rollAngle,
          timestamp: state.time,
          description: `横摇角 ${rollAngle.toFixed(2)}° 超过安全阈值 ${ETHICAL_THRESHOLDS.MAX_ROLL_ANGLE}°`,
        };
        triggerViolation(violation);
        return violation;
      }

      // 3. 检查转向角速度
      if (Math.abs(state.yawRate) > ETHICAL_THRESHOLDS.MAX_YAW_RATE) {
        const violation: EthicalViolation = {
          type: 'SAFETY_VIOLATION',
          thresholdValue: ETHICAL_THRESHOLDS.MAX_YAW_RATE,
          actualValue: Math.abs(state.yawRate),
          timestamp: state.time,
          description: `转向角速度 ${Math.abs(state.yawRate).toFixed(2)}°/s 超过安全阈值 ${ETHICAL_THRESHOLDS.MAX_YAW_RATE}°/s`,
        };
        triggerViolation(violation);
        return violation;
      }

      return null;
    },
    [isViolating, triggerViolation]
  );

  /**
   * 提交整改方案解决违规
   */
  const resolveViolation = useCallback(
    async (justification: string): Promise<void> => {
      if (!currentViolation) return;

      // 这里可以调用 API 记录整改
      // await fetch('/api/ethics/violation', { ... })

      // 清除当前违规状态
      setIsViolating(false);
      setCurrentViolation(null);
    },
    [currentViolation]
  );

  /**
   * 清除违规状态（不记录整改）
   */
  const clearViolation = useCallback(() => {
    setIsViolating(false);
    setCurrentViolation(null);
  }, []);

  /**
   * 获取违规类型的详细描述
   */
  const getViolationDescription = useCallback((type: ViolationType) => {
    return VIOLATION_DESCRIPTIONS[type] || {
      title: '未知违规',
      consequence: '发生未知类型的违规行为。',
      suggestion: '请联系系统管理员。',
    };
  }, []);

  /**
   * 计算总扣分
   */
  const getTotalDeduction = useCallback(() => {
    return violations.reduce((total, v) => {
      const severity = VIOLATION_SEVERITY[v.type] || 'LOW';
      return total + ETHICS_SCORE_DEDUCTION[severity];
    }, 0);
  }, [violations]);

  return {
    isViolating,
    currentViolation,
    violations,
    checkViolation,
    resolveViolation,
    clearViolation,
    getViolationDescription,
    getTotalDeduction,
  };
}

export default useEthicalMonitor;

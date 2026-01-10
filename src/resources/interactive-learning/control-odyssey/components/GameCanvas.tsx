'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { useGameStore } from '../store/game-store';
import { PhysicsEngine } from '../engine/physics';
import { LevelGenerator, LevelSegment, SEGMENT_WIDTH, SHIP_X_OFFSET, VIEWPORT_HEIGHT, VIEWPORT_WIDTH, computeReferenceY } from '../engine/level-generator';
import { buildRuntimeTierConfig, getLevelConfigById, getTierConfig } from '../level-data';
import { ShipAvatar } from './ShipAvatar';

interface GameCanvasProps {
  width?: number;
  height?: number;
}

type StepInfo = { at: number; amplitude: number; target: number };

const buildStepTimeline = (reference: { type: string; base?: number; events: { at: number; amplitude: number }[] }) => {
  const base = reference.base ?? VIEWPORT_HEIGHT / 2;
  if (!['step', 'sequence', 'custom'].includes(reference.type)) {
    return { base, steps: [] as StepInfo[] };
  }
  const sorted = [...reference.events].sort((a, b) => a.at - b.at);
  let cumulative = 0;
  const steps = sorted.map((event) => {
    cumulative += event.amplitude;
    return { at: event.at, amplitude: event.amplitude, target: base + cumulative };
  });
  return { base, steps };
};

export const GameCanvas: React.FC<GameCanvasProps> = ({ 
  width = 800, 
  height = 400 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // 游戏引擎实例 (使用 Ref 保持跨渲染周期持久化)
  const physicsRef = useRef(new PhysicsEngine());
  const levelGenRef = useRef(new LevelGenerator());
  const segmentsRef = useRef<LevelSegment[]>([]);
  const tierConfigRef = useRef<ReturnType<typeof getTierConfig> | null>(null);
  const tierKeyRef = useRef<string>('');
  const autoOffsetRef = useRef(0);
  const disturbanceRef = useRef(0);
  const scrollXRef = useRef(0);
  const lastTimeRef = useRef(0);
  const shipLayerRef = useRef<HTMLDivElement>(null);
  
  // 输入状态 Ref
  const inputRef = useRef({ up: false, down: false });
  
  // 内部性能统计变量
  const metricsRef = useRef({
    maxOvershoot: 0,
    avgRelativeErrorSum: 0,
    avgRelativeErrorTime: 0,
    steadySumY: 0,
    steadySumR: 0,
    steadyTime: 0
  });

  const stepRef = useRef<{
    base: number;
    steps: StepInfo[];
    currentIndex: number;
    currentAmplitude: number;
    currentTarget: number;
    direction: number;
    peak: number | null;
  }>({
    base: VIEWPORT_HEIGHT / 2,
    steps: [],
    currentIndex: -1,
    currentAmplitude: 0,
    currentTarget: VIEWPORT_HEIGHT / 2,
    direction: 0,
    peak: null
  });
  
  // 从 Store 获取状态
  const {
    gameState,
    setGameState,
    updateMetrics,
    maxDistance,
    controlMode,
    pidParams,
    extraParams,
    enableSpeedFeedback,
    enableFeedforward,
    currentLevelId,
    currentTier,
    controllerId,
    controllerLevels,
    resetToken,
    difficultyScale,
    setAutoOffset
  } = useGameStore();
  const levelConfig = getLevelConfigById(currentLevelId);

  // 键盘事件监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'ArrowUp') inputRef.current.up = true;
      if (e.key === 'ArrowDown') inputRef.current.down = true;
      if (e.key === ' ' && gameState === 'IDLE') setGameState('RUNNING'); // 空格开始
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') inputRef.current.up = false;
      if (e.key === 'ArrowDown') inputRef.current.down = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, setGameState]);

  const finalizeStepOvershoot = () => {
    const step = stepRef.current;
    const amplitude = Math.abs(step.currentAmplitude);
    if (!amplitude || step.peak === null) return;
    let overshootRatio = 0;
    if (step.direction > 0) {
      overshootRatio = (step.peak - step.currentTarget) / amplitude;
    } else if (step.direction < 0) {
      overshootRatio = (step.currentTarget - step.peak) / amplitude;
    }
    if (overshootRatio > 0) {
      metricsRef.current.maxOvershoot = Math.max(metricsRef.current.maxOvershoot, overshootRatio * 100);
    }
  };

  const getMetricsSnapshot = () => {
    const {
      maxOvershoot,
      avgRelativeErrorSum,
      avgRelativeErrorTime,
      steadySumY,
      steadySumR,
      steadyTime
    } = metricsRef.current;
    const avgRelativeError = avgRelativeErrorTime > 0
      ? (avgRelativeErrorSum / avgRelativeErrorTime) * 100
      : 0;
    const steadyAvgR = steadyTime > 0 ? steadySumR / steadyTime : 0;
    const steadyAvgY = steadyTime > 0 ? steadySumY / steadyTime : 0;
    const steadyError = steadyTime > 0 && Math.abs(steadyAvgR) > 0.001
      ? ((steadyAvgY - steadyAvgR) / steadyAvgR) * 100
      : 0;
    return {
      maxOvershoot,
      avgRelativeError,
      steadyError
    };
  };

  // 重置游戏逻辑
  const handleReset = useCallback(() => {
    physicsRef.current.reset(VIEWPORT_HEIGHT / 2);
    levelGenRef.current.reset();
    scrollXRef.current = 0;
    lastTimeRef.current = 0;
    autoOffsetRef.current = 0;
    disturbanceRef.current = 0;
    const tierKey = `${currentLevelId}-${currentTier}`;
    let runtimeTier = tierConfigRef.current;
    if (!runtimeTier || tierKeyRef.current !== tierKey) {
      runtimeTier = buildRuntimeTierConfig(getTierConfig(currentLevelId, currentTier));
      tierConfigRef.current = runtimeTier;
      tierKeyRef.current = tierKey;
    }
    // 重置统计
    metricsRef.current = {
      maxOvershoot: 0,
      avgRelativeErrorSum: 0,
      avgRelativeErrorTime: 0,
      steadySumY: 0,
      steadySumR: 0,
      steadyTime: 0
    };
    const { base, steps } = buildStepTimeline(runtimeTier.reference);
    stepRef.current = {
      base,
      steps,
      currentIndex: -1,
      currentAmplitude: 0,
      currentTarget: base,
      direction: 0,
      peak: null
    };
    // 初始生成一段
    const scaledEnvelope = {
      ...runtimeTier.envelope,
      margin: Math.max(20, runtimeTier.envelope.margin * difficultyScale)
    };
    segmentsRef.current = levelGenRef.current.generateSegments(
      VIEWPORT_WIDTH + 200,
      runtimeTier.distance,
      runtimeTier.reference,
      scaledEnvelope,
      runtimeTier.disturbance
    );
    inputRef.current = { up: false, down: false };
    // 不重置 Store 的 maxDistance
    // resetGame() 已经在外部或 Store 内部处理了
  }, [currentLevelId, currentTier, difficultyScale]); // 依赖关卡与等级

  useEffect(() => {
    autoOffsetRef.current = 0;
    disturbanceRef.current = 0;
    setAutoOffset(0);
  }, [controlMode, currentLevelId, currentTier, resetToken, setAutoOffset]);

  // 监听重置指令
  useEffect(() => {
    handleReset();
  }, [resetToken, handleReset]);

  // 游戏主循环
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const updateShipLayer = (shipY: number) => {
      const shipEl = shipLayerRef.current;
      if (!shipEl) return;
      const scaleX = canvas.clientWidth > 0 ? canvas.clientWidth / canvas.width : 1;
      const scaleY = canvas.clientHeight > 0 ? canvas.clientHeight / canvas.height : 1;
      const scale = Math.min(scaleX, scaleY);
      const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
      shipEl.style.left = `${SHIP_X_OFFSET * scaleX}px`;
      shipEl.style.top = `${shipY * scaleY}px`;
      shipEl.style.transform = `translate(-50%, -50%) scale(${safeScale})`;
    };

    const render = (time: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = time;
      }
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.1); // 限制最大步长防止跳帧
      lastTimeRef.current = time;

      // 1. 更新逻辑 (仅在 RUNNING 状态)
      if (gameState === 'RUNNING') {
        // 计算输入
        let controlInput = 0;
        if (inputRef.current.up) controlInput -= 1;   // 向上是负 Y (在 MANUAL 是 dU, AUTO 是 dR)
        if (inputRef.current.down) controlInput += 1; // 向下是正 Y

        const tierKey = `${currentLevelId}-${currentTier}`;
        if (!tierConfigRef.current || tierKeyRef.current !== tierKey) {
          tierConfigRef.current = buildRuntimeTierConfig(getTierConfig(currentLevelId, currentTier));
          tierKeyRef.current = tierKey;
        }
        const activeTier = tierConfigRef.current;
        const maxDistanceLocal = activeTier.distance;
        const plantType = levelConfig.simulation.engineType;
        const timeConstant = levelConfig.simulation.timeConstant;
        const inputDelay = levelConfig.simulation.inputDelay;
        const hasI = controllerId === 'PI' || controllerId === 'PID';
        const hasD = controllerId === 'PD' || controllerId === 'PID';
        const filteredPid = {
          kp: pidParams.kp,
          ki: hasI ? pidParams.ki : 0,
          kd: hasD ? pidParams.kd : 0
        };
        const pLevelLimit = Math.max(1, controllerLevels.P ?? 1);
        const iLevelLimit = Math.max(0, controllerLevels.PI ?? 0);
        const dLevelLimit = Math.max(0, controllerLevels.PD ?? 0);
        const vfbLevelLimit = Math.max(0, controllerLevels.VFB ?? 0);
        const ffLevelLimit = Math.max(0, controllerLevels.FF ?? 0);
        const outputLimits = {
          manual: pLevelLimit,
          p: controlMode === 'AUTO' ? pLevelLimit : 0,
          i: controlMode === 'AUTO' && hasI ? iLevelLimit : 0,
          d: controlMode === 'AUTO' && hasD ? dLevelLimit : 0,
          vfb: controlMode === 'AUTO' && enableSpeedFeedback ? vfbLevelLimit : 0,
          ff: controlMode === 'AUTO' && enableFeedforward ? ffLevelLimit : 0
        };

        const currentScrollX = scrollXRef.current;
        const scrollSpeed = 150; // 像素/秒
        const nextScrollX = currentScrollX + scrollSpeed * dt;
        scrollXRef.current = nextScrollX;
        const shipWorldX = nextScrollX + SHIP_X_OFFSET;

        const rawDisturbance = activeTier.disturbance.type === 'output-step'
          ? activeTier.disturbance.events.reduce((sum, event) => {
            const duration = event.duration ?? 160;
            return shipWorldX >= event.at && shipWorldX <= event.at + duration ? sum + event.amplitude : sum;
          }, 0)
          : 0;
        const disturbanceTau = Math.max(levelConfig.simulation.timeConstant ?? 0.6, 0.2);
        const alpha = disturbanceTau > 0 ? Math.min(dt / (disturbanceTau + dt), 1) : 1;
        disturbanceRef.current += (rawDisturbance - disturbanceRef.current) * alpha;
        const disturbance = disturbanceRef.current;

        const setpointRate = 120;
        const clampValue = (value: number, min: number, max: number) =>
          Math.min(max, Math.max(min, value));
        if (controlMode === 'AUTO') {
          autoOffsetRef.current = clampValue(
            autoOffsetRef.current + controlInput * setpointRate * dt,
            -160,
            160
          );
          setAutoOffset(autoOffsetRef.current);
          const referenceY = computeReferenceY(activeTier.reference, shipWorldX);
          physicsRef.current.setAutoSetpoint(clampValue(referenceY + autoOffsetRef.current, 0, VIEWPORT_HEIGHT));
        }

        const appliedInput = controlMode === 'AUTO' ? 0 : controlInput;

        // 物理步进
        const shipState = physicsRef.current.update(dt, appliedInput, {
          type: plantType, 
          gain: levelConfig.simulation.gain,
          timeConstant,
          inputDelay,
          mode: controlMode,
          pid: filteredPid,
          speedFeedback: {
            enabled: enableSpeedFeedback,
            tau: extraParams.speedFeedbackTau
          },
          feedforward: {
            enabled: enableFeedforward,
            gain: extraParams.feedforwardGain,
            base: VIEWPORT_HEIGHT / 2
          },
          outputLimits
        }, disturbance);

        // 限制飞船不跑出屏幕垂直范围 (可选，或者作为碰撞)
        if (shipState.y < 0) shipState.y = 0;
        if (shipState.y > VIEWPORT_HEIGHT) shipState.y = VIEWPORT_HEIGHT;

        const scrollX = scrollXRef.current;
        const referenceY = computeReferenceY(activeTier.reference, shipWorldX);

        const stepMeta = stepRef.current;
        if (stepMeta.steps.length) {
          while (
            stepMeta.currentIndex + 1 < stepMeta.steps.length
            && shipWorldX >= stepMeta.steps[stepMeta.currentIndex + 1].at
          ) {
            finalizeStepOvershoot();
            stepMeta.currentIndex += 1;
            const currentStep = stepMeta.steps[stepMeta.currentIndex];
            stepMeta.currentAmplitude = currentStep.amplitude;
            stepMeta.currentTarget = currentStep.target;
            stepMeta.direction = Math.sign(currentStep.amplitude);
            stepMeta.peak = shipState.y;
          }

          if (stepMeta.currentAmplitude !== 0 && stepMeta.peak !== null) {
            if (stepMeta.direction > 0) {
              stepMeta.peak = Math.max(stepMeta.peak, shipState.y);
            } else if (stepMeta.direction < 0) {
              stepMeta.peak = Math.min(stepMeta.peak, shipState.y);
            }
          }
        }

        const error = Math.abs(shipState.y - referenceY);
        const stepAmplitude = Math.abs(stepMeta.currentAmplitude);
        const referenceDelta = stepAmplitude > 0 ? stepAmplitude : Math.abs(referenceY - stepMeta.base);
        if (referenceDelta > 0.001) {
          metricsRef.current.avgRelativeErrorSum += (error / referenceDelta) * dt;
          metricsRef.current.avgRelativeErrorTime += dt;
        }
        if (shipWorldX >= maxDistanceLocal - 500) {
          metricsRef.current.steadySumY += shipState.y * dt;
          metricsRef.current.steadySumR += referenceY * dt;
          metricsRef.current.steadyTime += dt;
        }

        // 胜利检测
        if (shipWorldX >= maxDistanceLocal) {
          scrollXRef.current = Math.max(maxDistanceLocal - SHIP_X_OFFSET, 0);
          const displayR = controlMode === 'AUTO' ? shipState.r : VIEWPORT_HEIGHT / 2;
          finalizeStepOvershoot();
          const snapshot = getMetricsSnapshot();
          updateMetrics(shipState.y, shipState.u, displayR, maxDistanceLocal, {
            maxOvershoot: snapshot.maxOvershoot,
            avgRelativeError: snapshot.avgRelativeError,
            steadyError: snapshot.steadyError
          });
          setGameState('VICTORY');
          // 立即停止循环，不进行后续更新
          return;
        }

        // 生成新地形 / 清理旧地形
        const rightEdge = scrollX + VIEWPORT_WIDTH;
        const scaledEnvelope = {
          ...activeTier.envelope,
          margin: Math.max(20, activeTier.envelope.margin * difficultyScale)
        };
        const newSegments = levelGenRef.current.generateSegments(
          rightEdge,
          maxDistanceLocal,
          activeTier.reference,
          scaledEnvelope,
          activeTier.disturbance
        );
        segmentsRef.current = [...segmentsRef.current, ...newSegments];
        
        // 移除屏幕左侧不可见的
        segmentsRef.current = segmentsRef.current.filter(seg => seg.x + SEGMENT_WIDTH > scrollX - 100);

        // 碰撞检测与数据提取
        const currentSeg = segmentsRef.current.find(
          s => s.x <= shipWorldX && s.x + SEGMENT_WIDTH > shipWorldX
        );

        let currentR = VIEWPORT_HEIGHT / 2;

        if (currentSeg) {
          currentR = currentSeg.gapCenter;
          
          // 简单的矩形/点碰撞
          const shipTop = shipState.y - 8; // 飞船半径 8
          const shipBottom = shipState.y + 8;
          
          if (shipTop < currentSeg.topY || shipBottom > currentSeg.bottomY) {
            setGameState('GAME_OVER');
          }
        }
        
        // 如果是自动模式，用 shipState.r 作为参考；如果是手动模式，用 gapCenter 作为参考显示
        const displayR = controlMode === 'AUTO' ? shipState.r : currentR;

        // 同步低频状态到 UI Store
        const snapshot = getMetricsSnapshot();
        updateMetrics(shipState.y, shipState.u, displayR, scrollX, {
          maxOvershoot: snapshot.maxOvershoot,
          avgRelativeError: snapshot.avgRelativeError,
          steadyError: snapshot.steadyError
        });
      }

      // 2. 渲染绘制
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 背景
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const scrollX = scrollXRef.current;
      const activeTier = tierConfigRef.current;

      if (activeTier?.disturbance.type === 'output-step') {
        activeTier.disturbance.events.forEach((event) => {
          const duration = event.duration ?? 160;
          const drawX = event.at - scrollX;
          if (drawX > canvas.width + 100 || drawX + duration < -100) return;

          const isUp = event.amplitude < 0;
          ctx.fillStyle = isUp ? 'rgba(56, 189, 248, 0.15)' : 'rgba(248, 113, 113, 0.15)';
          ctx.fillRect(drawX, 0, duration, canvas.height);

          ctx.strokeStyle = isUp ? 'rgba(56, 189, 248, 0.5)' : 'rgba(248, 113, 113, 0.5)';
          ctx.lineWidth = 1;
          for (let y = 60; y < canvas.height; y += 90) {
            ctx.beginPath();
            ctx.moveTo(drawX + duration / 2, y);
            ctx.lineTo(drawX + duration / 2, y + (isUp ? -20 : 20));
            ctx.lineTo(drawX + duration / 2 - 6, y + (isUp ? -14 : 14));
            ctx.moveTo(drawX + duration / 2, y + (isUp ? -20 : 20));
            ctx.lineTo(drawX + duration / 2 + 6, y + (isUp ? -14 : 14));
            ctx.stroke();
          }
        });
      }

      // 绘制地形 (上下墙体)
      ctx.fillStyle = '#334155'; // slate-700
      
      // 优化：一次性构建路径
      ctx.beginPath();
      // 上墙
      segmentsRef.current.forEach((seg, i) => {
        const drawX = seg.x - scrollX;
        if (i === 0) ctx.moveTo(drawX, 0);
        ctx.lineTo(drawX, seg.topY);
        ctx.lineTo(drawX + SEGMENT_WIDTH, seg.topY);
        ctx.lineTo(drawX + SEGMENT_WIDTH, 0);
      });
      // 下墙
      segmentsRef.current.forEach((seg, i) => {
        const drawX = seg.x - scrollX;
        if (i === 0) ctx.moveTo(drawX, VIEWPORT_HEIGHT);
        ctx.lineTo(drawX, seg.bottomY);
        ctx.lineTo(drawX + SEGMENT_WIDTH, seg.bottomY);
        ctx.lineTo(drawX + SEGMENT_WIDTH, VIEWPORT_HEIGHT);
      });
      ctx.fill();
      
      // 终点线绘制 (如果在视野内)
      const finishDistance = tierConfigRef.current?.distance ?? maxDistance;
      const finishX = finishDistance - scrollX;
      if (finishX > -100 && finishX < canvas.width + 100) {
         ctx.fillStyle = 'rgba(255, 215, 0, 0.3)'; // Gold
         ctx.fillRect(finishX, 0, 20, canvas.height);
         ctx.fillStyle = '#fcd34d';
         ctx.font = 'bold 20px monospace';
         ctx.fillText('FINISH', finishX + 30, 50);
      }

      // 绘制中心期望线 (虚线)
      if (activeTier) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(248, 250, 252, 0.55)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        segmentsRef.current.forEach((seg, i) => {
          const drawX = seg.x - scrollX;
          const refY = Math.min(VIEWPORT_HEIGHT, Math.max(0, computeReferenceY(activeTier.reference, seg.x)));
          if (i === 0) ctx.moveTo(drawX, refY);
          ctx.lineTo(drawX + SEGMENT_WIDTH, refY);
        });
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
      }

      // 自动模式下的用户调整给定值 (虚线)
      if (activeTier && controlMode === 'AUTO') {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([7, 5]);
        segmentsRef.current.forEach((seg, i) => {
          const drawX = seg.x - scrollX;
          const baseRef = computeReferenceY(activeTier.reference, seg.x);
          const adjustedRef = Math.min(
            VIEWPORT_HEIGHT,
            Math.max(0, baseRef + autoOffsetRef.current)
          );
          if (i === 0) ctx.moveTo(drawX, adjustedRef);
          ctx.lineTo(drawX + SEGMENT_WIDTH, adjustedRef);
        });
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
      }

      // 绘制飞船
      const { y } = physicsRef.current.getState();
      updateShipLayer(y);

      // HUD 信息
      if (gameState === 'GAME_OVER') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 32px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SYSTEM FAILURE', canvas.width / 2, canvas.height / 2);
        
        ctx.fillStyle = '#94a3b8';
        ctx.font = '16px sans-serif';
        ctx.fillText('Press RESET to restart mission', canvas.width / 2, canvas.height / 2 + 40);
      } else if (gameState === 'VICTORY') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#10b981'; // Emerald
        ctx.font = 'bold 32px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('MISSION ACCOMPLISHED', canvas.width / 2, canvas.height / 2);
        
        ctx.fillStyle = '#94a3b8';
        ctx.font = '16px sans-serif';
        ctx.fillText('Great job! System stabilized.', canvas.width / 2, canvas.height / 2 + 40);
      } else if (gameState === 'IDLE') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PRESS SPACE TO START', canvas.width / 2, canvas.height / 2);
        
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px sans-serif';
        ctx.fillText('Use UP/DOWN arrows to control', canvas.width / 2, canvas.height / 2 + 30);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => cancelAnimationFrame(animationFrameId);
  }, [
    gameState,
    setGameState,
    updateMetrics,
    maxDistance,
    currentLevelId,
    currentTier,
    controlMode,
    pidParams,
    controllerId,
    levelConfig,
    extraParams,
    enableSpeedFeedback,
    enableFeedforward,
    difficultyScale,
    setAutoOffset
  ]); // 更新依赖

  return (
    <div className="w-full h-full min-h-[400px] relative rounded-xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="block w-full h-full"
      />
      <div
        ref={shipLayerRef}
        className="absolute left-0 top-0 z-10 pointer-events-none"
      >
        <ShipAvatar
          controlMode={controlMode}
          controllerId={controllerId}
          enableFeedforward={enableFeedforward}
          enableSpeedFeedback={enableSpeedFeedback}
          controllerLevels={controllerLevels}
        />
      </div>
    </div>
  );
};

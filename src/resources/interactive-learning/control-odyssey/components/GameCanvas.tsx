'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { useGameStore } from '../store/game-store';
import { PhysicsEngine } from '../engine/physics';
import { LevelGenerator, LevelSegment, SEGMENT_WIDTH, SHIP_X_OFFSET, VIEWPORT_HEIGHT, VIEWPORT_WIDTH, computeReferenceY } from '../engine/level-generator';
import { buildRuntimeTierConfig, getLevelConfigById, getTierConfig } from '../level-data';

interface GameCanvasProps {
  width?: number;
  height?: number;
}

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
  
  // 输入状态 Ref
  const inputRef = useRef({ up: false, down: false });
  
  // 内部性能统计变量
  const metricsRef = useRef({
    maxError: 0,
    iae: 0,
    startTime: 0,
    lastTimeWithinThreshold: 0
  });
  
  // 从 Store 获取状态
  const {
    gameState,
    setGameState,
    updateMetrics,
    maxDistance,
    controlMode,
    pidParams,
    currentLevelId,
    currentTier,
    controllerId,
    resetToken
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
    metricsRef.current = { maxError: 0, iae: 0, startTime: 0, lastTimeWithinThreshold: 0 };
    // 初始生成一段
    segmentsRef.current = levelGenRef.current.generateSegments(
      VIEWPORT_WIDTH + 200,
      runtimeTier.distance,
      runtimeTier.reference,
      runtimeTier.envelope,
      runtimeTier.disturbance
    );
    inputRef.current = { up: false, down: false };
    // 不重置 Store 的 maxDistance
    // resetGame() 已经在外部或 Store 内部处理了
  }, [currentLevelId, currentTier]); // 依赖关卡与等级

  useEffect(() => {
    autoOffsetRef.current = 0;
    disturbanceRef.current = 0;
  }, [controlMode, currentLevelId, currentTier, resetToken]);

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
        const filteredPid = {
          kp: pidParams.kp,
          ki: controllerId === 'PI' || controllerId === 'PID' ? pidParams.ki : 0,
          kd: controllerId === 'PD' || controllerId === 'PID' ? pidParams.kd : 0
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
          pid: filteredPid
        }, disturbance);

        // 限制飞船不跑出屏幕垂直范围 (可选，或者作为碰撞)
        if (shipState.y < 0) shipState.y = 0;
        if (shipState.y > VIEWPORT_HEIGHT) shipState.y = VIEWPORT_HEIGHT;

        const scrollX = scrollXRef.current;

        // 胜利检测
        if (shipWorldX >= maxDistanceLocal) {
          scrollXRef.current = Math.max(maxDistanceLocal - SHIP_X_OFFSET, 0);
          const displayR = controlMode === 'AUTO' ? shipState.r : VIEWPORT_HEIGHT / 2;
          updateMetrics(shipState.y, shipState.u, displayR, maxDistanceLocal, {
            iae: metricsRef.current.iae,
            maxOvershoot: (metricsRef.current.maxError / 60) * 100
          });
          setGameState('VICTORY');
          // 立即停止循环，不进行后续更新
          return;
        }

        // 生成新地形 / 清理旧地形
        const rightEdge = scrollX + VIEWPORT_WIDTH;
        const newSegments = levelGenRef.current.generateSegments(
          rightEdge,
          maxDistanceLocal,
          activeTier.reference,
          activeTier.envelope,
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
          
          // 计算指标
          const error = Math.abs(shipState.y - currentR);
          metricsRef.current.iae += error * dt;
          if (error > metricsRef.current.maxError) {
             metricsRef.current.maxError = error;
          }
          
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
        updateMetrics(shipState.y, shipState.u, displayR, scrollX, {
            iae: metricsRef.current.iae,
            maxOvershoot: (metricsRef.current.maxError / 60) * 100 // 假设 60px 是基准误差
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
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.55)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      segmentsRef.current.forEach((seg, i) => {
        const drawX = seg.x - scrollX;
        if (i === 0) ctx.moveTo(drawX, seg.gapCenter);
        ctx.lineTo(drawX + SEGMENT_WIDTH, seg.gapCenter);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 1;

      // 绘制飞船
      const { y } = physicsRef.current.getState();
      
      // 飞船本体
      ctx.fillStyle = gameState === 'GAME_OVER' ? '#ef4444' : gameState === 'VICTORY' ? '#10b981' : '#3b82f6';
      ctx.beginPath();
      // 简单的三角形飞船
      ctx.moveTo(SHIP_X_OFFSET + 10, y);
      ctx.lineTo(SHIP_X_OFFSET - 8, y - 6);
      ctx.lineTo(SHIP_X_OFFSET - 8, y + 6);
      ctx.fill();
      
      // 尾迹效果
      if (gameState === 'RUNNING') {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.5)';
        ctx.beginPath();
        ctx.arc(SHIP_X_OFFSET - 12, y, 4 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
      }

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
  }, [gameState, setGameState, updateMetrics, maxDistance, currentLevelId, currentTier, controlMode, pidParams, controllerId, levelConfig]); // 更新依赖

  return (
    <div className="w-full h-full min-h-[400px] relative rounded-xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="block w-full h-full"
      />
    </div>
  );
};

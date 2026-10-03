'use client';

import React, { useRef, useEffect } from 'react';
import { useGameStore } from '../store/game-store';
import { OdysseyExecution } from '../engine/run-execution';
import { type OdysseyRunConfig } from '../engine/input-trace';
import { appendTelemetry } from '../engine/telemetry-history';
import { useShallow } from 'zustand/react/shallow';
import { isBrowserControlEngineReady as isControlOdysseyRuntimeReady, preloadBrowserControlEngine as preloadControlOdysseyRuntime, computeSimulationStepBrowserSync } from '@/lib/control-engine/client';
import { type LevelSegment, SEGMENT_WIDTH, SHIP_X_OFFSET, VIEWPORT_HEIGHT, computeReferenceY } from '../engine/level-generator';
import { getTierConfig } from '../level-data';
import { ShipAvatar } from './ShipAvatar';
import { SimulationClock } from '@/lib/simulation';

interface GameCanvasProps {
  width?: number;
  height?: number;
  lockSetpointInput?: boolean;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ 
  width = 800, 
  height = 400,
  lockSetpointInput = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // 游戏引擎实例 (使用 Ref 保持跨渲染周期持久化)
  const executionRef = useRef<OdysseyExecution | null>(null);
  const segmentsRef = useRef<LevelSegment[]>([]);
  const tierConfigRef = useRef<ReturnType<typeof getTierConfig> | null>(null);
  const clockRef = useRef(new SimulationClock({ dt: 1 / 60, maxSubSteps: 6 }));
  const autoOffsetRef = useRef(0);
  const scrollXRef = useRef(0);
  const lastTimeRef = useRef(0);
  const shipLayerRef = useRef<HTMLDivElement>(null);
  
  // 输入状态 Ref
  const inputRef = useRef({ up: false, down: false });
  
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
    enableSmithPredictor,
    currentLevelId,
    currentTier,
    controllerId,
    controllerLevels,
    resetToken,
    difficultyScale,
    setAutoOffset
  } = useGameStore(useShallow(state => ({
    gameState: state.gameState, setGameState: state.setGameState, updateMetrics: state.updateMetrics,
    maxDistance: state.maxDistance, controlMode: state.controlMode, pidParams: state.pidParams, extraParams: state.extraParams,
    enableSpeedFeedback: state.enableSpeedFeedback, enableFeedforward: state.enableFeedforward, enableSmithPredictor: state.enableSmithPredictor,
    currentLevelId: state.currentLevelId, currentTier: state.currentTier, controllerId: state.controllerId, controllerLevels: state.controllerLevels,
    resetToken: state.resetToken, difficultyScale: state.difficultyScale, setAutoOffset: state.setAutoOffset,
  })));

  // 键盘事件监听
  useEffect(() => {
    void preloadControlOdysseyRuntime();
  }, []);

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

  useEffect(() => {
    const state = useGameStore.getState();
    const runtime = new OdysseyExecution(currentLevelId, currentTier, state.controllerLevels);
    runtime.prepareTerrain(state.difficultyScale);
    executionRef.current = runtime;
    tierConfigRef.current = runtime.tierConfig;
    segmentsRef.current = runtime.segments;
    scrollXRef.current = 0;
    autoOffsetRef.current = 0;
    lastTimeRef.current = 0;
    clockRef.current.reset();
    inputRef.current = { up: false, down: false };
    useGameStore.setState({ inputTrace: null, autoOffset: 0 });
  }, [resetToken, currentLevelId, currentTier]);

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
      const frameDt = Math.min((time - lastTimeRef.current) / 1000, 0.1); // 限制最大步长防止跳帧
      lastTimeRef.current = time;

      const simulateStep = () => {
        const runtime = executionRef.current;
        const store = useGameStore.getState();
        if (!runtime || store.gameState !== 'RUNNING' || runtime.terminal) return false;
        if (!isControlOdysseyRuntimeReady()) return false;
        const allowInput = !(lockSetpointInput && store.controlMode === 'AUTO');
        const command = allowInput ? Number(inputRef.current.down) - Number(inputRef.current.up) : 0;
        const config: OdysseyRunConfig = {
          controlMode: store.controlMode, controllerId: store.controllerId, pidParams: store.pidParams, extraParams: store.extraParams,
          enableSpeedFeedback: store.enableSpeedFeedback, enableFeedforward: store.enableFeedforward,
          enableSmithPredictor: store.enableSmithPredictor, difficultyScale: store.difficultyScale, outputLevels: store.controllerLevels,
        };
        const continuing = runtime.advance(config, command, computeSimulationStepBrowserSync);
        scrollXRef.current = runtime.scrollX;
        segmentsRef.current = runtime.segments;
        autoOffsetRef.current = runtime.autoOffset;
        appendTelemetry({ r: runtime.displayR, y: runtime.state.y, u: -runtime.state.u, distance: runtime.scrollX });
        // Ten UI updates per simulation second, plus an unconditional terminal flush.
        if (runtime.trace.totalSteps % 6 === 0 || !continuing) {
          store.updateMetrics(runtime.state.y, runtime.state.u, runtime.displayR,
            runtime.terminal === 'VICTORY' ? runtime.tierConfig.distance : runtime.scrollX, runtime.getMetrics());
          store.setAutoOffset(runtime.autoOffset);
        }
        if (!continuing) {
          useGameStore.setState({ inputTrace: runtime.getInputTrace(), gameState: runtime.terminal! });
        }
        return continuing;
      };

      if (useGameStore.getState().gameState === 'RUNNING') {
        clockRef.current.advance(frameDt, simulateStep);
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
      const y = executionRef.current?.state.y ?? VIEWPORT_HEIGHT / 2;
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
    extraParams,
    enableSpeedFeedback,
    enableFeedforward,
    enableSmithPredictor,
    difficultyScale,
    lockSetpointInput,
    controllerLevels.P,
    controllerLevels.PI,
    controllerLevels.PD,
    controllerLevels.VFB,
    controllerLevels.FF,
    setAutoOffset,
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

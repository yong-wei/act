'use client';

import React, { useEffect } from 'react';
import { Lock, Settings2 } from 'lucide-react';
import { useGameStore } from '../store/game-store';
import {
  CONTROL_BASE_CONTROLLERS,
  CONTROL_MODULES,
  CONTROL_SHOP_CONFIG,
  getTierConfig,
  type BaseControllerId,
  type ControllerId
} from '../level-data';
import { cn } from '@/lib/utils';

interface TuningPanelProps {
  aiSection?: React.ReactNode;
}

export const TuningPanel: React.FC<TuningPanelProps> = ({ aiSection }) => {
  const {
    controlMode,
    pidParams,
    setPidParams,
    extraParams,
    setExtraParams,
    controllerId,
    setControllerId,
    unlockedControllers,
    controllerLevels,
    currentLevelId,
    currentTier,
    enableSpeedFeedback,
    enableFeedforward,
    enableSmithPredictor,
    setSpeedFeedbackEnabled,
    setFeedforwardEnabled,
    setSmithPredictorEnabled
  } = useGameStore();
  
  const isAuto = controlMode === 'AUTO';
  const baseController = CONTROL_BASE_CONTROLLERS.includes(controllerId)
    ? controllerId
    : 'P';
  const controllerAllows: Record<BaseControllerId, { kp: boolean; ki: boolean; kd: boolean }> = {
    P: { kp: true, ki: false, kd: false },
    PI: { kp: true, ki: true, kd: false },
    PD: { kp: true, ki: false, kd: true },
    PID: { kp: true, ki: true, kd: true }
  };
  const controllerCaps = controllerAllows[baseController] ?? controllerAllows.P;
  const canTuneKp = isAuto && controllerCaps.kp;
  const canTuneKi = isAuto && controllerCaps.ki;
  const canTuneKd = isAuto && controllerCaps.kd;
  const isSpeedFeedbackUnlocked = unlockedControllers.includes('VFB');
  const isFeedforwardUnlocked = unlockedControllers.includes('FF');
  const isSmithUnlocked = unlockedControllers.includes('SMITH');
  const speedFeedbackEnabled = enableSpeedFeedback && isSpeedFeedbackUnlocked;
  const feedforwardEnabled = enableFeedforward && isFeedforwardUnlocked;
  const smithPredictorEnabled = enableSmithPredictor && isSmithUnlocked;
  const getLevel = (id: ControllerId) => controllerLevels[id] ?? 0;
  const baseMax = 0.1;
  const kpMax = Math.max(baseMax, baseMax * Math.pow(2, Math.max(0, getLevel('P') - 1)));
  const kiMax = Math.max(baseMax, baseMax * Math.pow(2, Math.max(0, getLevel('PI') - 1)));
  const kdMax = Math.max(baseMax, baseMax * Math.pow(2, Math.max(0, getLevel('PD') - 1)));
  const tauMax = Math.max(baseMax, baseMax * Math.pow(2, Math.max(0, getLevel('VFB') - 1)));
  const ffMax = Math.max(baseMax, baseMax * Math.pow(2, Math.max(0, getLevel('FF') - 1)));
  const smithMax = Math.max(baseMax, baseMax * Math.pow(2, Math.max(0, getLevel('SMITH') - 1)));
  const controllerLabelMap = CONTROL_SHOP_CONFIG.items.reduce<Record<ControllerId, string>>((acc, item) => {
    acc[item.unlocks.controller] = item.label;
    return acc;
  }, {} as Record<ControllerId, string>);
  const tierConfig = getTierConfig(currentLevelId, currentTier);
  const hasDisturbance = tierConfig.disturbance.type !== 'none';
  const manualActive = !isAuto;
  const pidEnabled = isAuto && (controllerCaps.kp || controllerCaps.ki || controllerCaps.kd);
  const lineActiveClass = 'stroke-cyan-300';
  const lineMutedClass = 'stroke-slate-700';
  const baseTextClass = 'fill-slate-200';
  const moduleActiveClass = 'fill-amber-500/10 stroke-amber-300';
  const moduleMutedClass = 'fill-slate-900/40 stroke-slate-700';
  const moduleTextActiveClass = 'text-amber-200';
  const moduleTextMutedClass = 'text-slate-500';
  const markerActive = 'url(#arrow-active)';
  const markerMuted = 'url(#arrow-muted)';
  const pidLineClass = pidEnabled ? lineActiveClass : lineMutedClass;
  const feedforwardLineClass = isAuto && feedforwardEnabled ? lineActiveClass : lineMutedClass;
  const speedFeedbackLineClass = isAuto && speedFeedbackEnabled ? lineActiveClass : lineMutedClass;
  const disturbanceLineClass = hasDisturbance ? lineActiveClass : lineMutedClass;
  const manualLineClass = manualActive ? lineActiveClass : lineMutedClass;
  const unityFeedbackLineClass = isAuto ? lineActiveClass : lineMutedClass;

  useEffect(() => {
    const fallback = CONTROL_BASE_CONTROLLERS.find((id) => unlockedControllers.includes(id)) ?? 'P';
    if (!CONTROL_BASE_CONTROLLERS.includes(controllerId) || !unlockedControllers.includes(controllerId)) {
      setControllerId(fallback);
    }
  }, [unlockedControllers, controllerId, setControllerId]);

  useEffect(() => {
    if (!isSpeedFeedbackUnlocked && enableSpeedFeedback) {
      setSpeedFeedbackEnabled(false);
    }
    if (!isFeedforwardUnlocked && enableFeedforward) {
      setFeedforwardEnabled(false);
    }
    if (!isSmithUnlocked && enableSmithPredictor) {
      setSmithPredictorEnabled(false);
    }
  }, [
    enableSpeedFeedback,
    enableFeedforward,
    enableSmithPredictor,
    isSpeedFeedbackUnlocked,
    isFeedforwardUnlocked,
    isSmithUnlocked,
    setSpeedFeedbackEnabled,
    setFeedforwardEnabled,
    setSmithPredictorEnabled
  ]);
  
  return (
    <div className="w-full h-full bg-slate-900/50 rounded-xl border border-slate-800 p-4 flex flex-col gap-4">
      <div className="flex items-center gap-2 text-base text-slate-200 pb-2 border-b border-slate-800">
        <Settings2 className="h-4 w-4" />
        <span className="font-semibold">控制器整定</span>
        <div className={`ml-auto text-sm px-2 py-0.5 rounded font-mono ${isAuto ? 'bg-blue-500/20 text-blue-300' : 'bg-orange-500/20 text-orange-300'}`}>
          {isAuto ? '自动模式' : '手动模式'}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm text-slate-300 uppercase tracking-wider">控制器选择</div>
        <div className="grid grid-cols-4 gap-2">
          {CONTROL_BASE_CONTROLLERS.map((id) => {
            const unlocked = unlockedControllers.includes(id);
            const label = controllerLabelMap[id] ?? id;
            const level = getLevel(id);
            const selectable = isAuto && unlocked;
            const active = isAuto && baseController === id;
            return (
              <button
                key={id}
                type="button"
                disabled={!selectable}
                onClick={() => setControllerId(id)}
                className={`rounded-lg border px-2 py-2 text-sm font-semibold transition-all ${
                  active
                    ? 'border-emerald-400 bg-emerald-500/10 text-emerald-200'
                    : 'border-slate-800 bg-slate-950/60 text-slate-300'
                } ${!selectable ? 'opacity-40 cursor-not-allowed' : 'hover:border-slate-600'}`}
              >
                <div className="flex flex-col items-center gap-1">
                  <span>{label}</span>
                  <span className="text-sm font-mono text-slate-300">Lv {level || 0}</span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="text-sm text-slate-300">
          未解锁控制器需在控制商店兑换。
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm text-slate-300 uppercase tracking-wider">复合控制模块</div>
        <div className="grid grid-cols-3 gap-2">
          {CONTROL_MODULES.map((moduleId) => {
            const unlocked = unlockedControllers.includes(moduleId);
            const label = controllerLabelMap[moduleId] ?? moduleId;
            const level = getLevel(moduleId);
            const enabled = moduleId === 'VFB'
              ? speedFeedbackEnabled
              : moduleId === 'FF'
                ? feedforwardEnabled
                : smithPredictorEnabled;
            const toggle = moduleId === 'VFB'
              ? setSpeedFeedbackEnabled
              : moduleId === 'FF'
                ? setFeedforwardEnabled
                : setSmithPredictorEnabled;
            const active = isAuto && enabled;
            const selectable = isAuto && unlocked;
            return (
              <button
                key={moduleId}
                type="button"
                disabled={!selectable}
                onClick={() => toggle(!enabled)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm font-semibold transition-all flex items-center justify-between',
                  active
                    ? 'border-blue-400 bg-blue-500/10 text-blue-200'
                    : 'border-slate-800 bg-slate-950/60 text-slate-300',
                  !selectable && 'opacity-40 cursor-not-allowed'
                )}
              >
                <div className="flex flex-col items-start">
                  <span>{label}</span>
                  <span className="text-sm font-mono text-slate-300">Lv {level || 0}</span>
                </div>
                {!selectable && <Lock className="w-3 h-3 text-slate-500" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm text-slate-300 uppercase tracking-wider">控制结构方框图</div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-1">
          <svg viewBox="0 -20 760 240" className="w-full h-[240px]">
            <defs>
              <marker
                id="arrow-active"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" className="fill-cyan-300" />
              </marker>
              <marker
                id="arrow-muted"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" className="fill-slate-600" />
              </marker>
            </defs>
            <rect x="10" y="-18" width="740" height="236" rx="12" className="fill-slate-950/60 stroke-slate-800" />

            {/* Signals */}
            <text x="20" y="106" className={cn(baseTextClass, 'text-[15px]')}>R(t)</text>
            <text x="700" y="106" className={cn(baseTextClass, 'text-[15px]')}>Y(t)</text>
            <text
              x="610"
              y="14"
              textAnchor="middle"
              className={cn('text-[14px] fill-current', hasDisturbance ? moduleTextActiveClass : moduleTextMutedClass)}
            >
              D(t)
            </text>

            {/* Summing junctions */}
            <circle cx="90" cy="100" r="16" className={moduleActiveClass} />
            <text x="90" y="105" textAnchor="middle" className="fill-slate-300 text-[15px]">Σ</text>
            <circle cx="350" cy="100" r="14" className={moduleActiveClass} />
            <text x="350" y="105" textAnchor="middle" className="fill-slate-300 text-[15px]">Σ</text>
            <circle cx="610" cy="100" r="14" className={moduleActiveClass} />
            <text x="610" y="105" textAnchor="middle" className="fill-slate-300 text-[15px]">Σ</text>

            {/* PID block */}
            <rect
              x="130"
              y="32"
              width="180"
              height="108"
              rx="12"
              className={cn('stroke-2', pidEnabled ? moduleActiveClass : moduleMutedClass)}
            />
            <text x="220" y="26" textAnchor="middle" className="fill-slate-300 text-[14px]">PID 并联</text>
            <rect
              x="155"
              y="44"
              width="130"
              height="26"
              rx="8"
              className={cn('stroke-2', isAuto && controllerCaps.kp ? moduleActiveClass : moduleMutedClass)}
            />
            <text
              x="220"
              y="62"
              textAnchor="middle"
              className={cn('text-[14px] fill-current', isAuto && controllerCaps.kp ? moduleTextActiveClass : moduleTextMutedClass)}
            >
              P
            </text>
            <rect
              x="155"
              y="72"
              width="130"
              height="26"
              rx="8"
              className={cn('stroke-2', isAuto && controllerCaps.ki ? moduleActiveClass : moduleMutedClass)}
            />
            <text
              x="220"
              y="90"
              textAnchor="middle"
              className={cn('text-[14px] fill-current', isAuto && controllerCaps.ki ? moduleTextActiveClass : moduleTextMutedClass)}
            >
              I
            </text>
            <rect
              x="155"
              y="100"
              width="130"
              height="26"
              rx="8"
              className={cn('stroke-2', isAuto && controllerCaps.kd ? moduleActiveClass : moduleMutedClass)}
            />
            <text
              x="220"
              y="118"
              textAnchor="middle"
              className={cn('text-[14px] fill-current', isAuto && controllerCaps.kd ? moduleTextActiveClass : moduleTextMutedClass)}
            >
              D
            </text>

            {/* Manual control */}
            <rect
              x="155"
              y="146"
              width="130"
              height="26"
              rx="8"
              className={cn('stroke-2', manualActive ? moduleActiveClass : moduleMutedClass)}
            />
            <text
              x="220"
              y="164"
              textAnchor="middle"
              className={cn('text-[13px] fill-current', manualActive ? moduleTextActiveClass : moduleTextMutedClass)}
            >
              手动控制
            </text>

            {/* Feedforward */}
            <rect
              x="150"
              y="-17"
              width="140"
              height="26"
              rx="8"
              className={cn('stroke-2', isAuto && feedforwardEnabled ? moduleActiveClass : moduleMutedClass)}
            />
            <text
              x="220"
              y="1"
              textAnchor="middle"
              className={cn('text-[13px] fill-current', isAuto && feedforwardEnabled ? moduleTextActiveClass : moduleTextMutedClass)}
            >
              前馈 F(s)
            </text>

            {/* Plant */}
            <rect x="390" y="70" width="150" height="60" rx="10" className={cn('stroke-2', moduleActiveClass)} />
            <text x="465" y="106" textAnchor="middle" className={cn(baseTextClass, 'text-[15px]')}>对象 G(s)</text>

            {/* Speed feedback */}
            <rect
              x="390"
              y="176"
              width="150"
              height="26"
              rx="8"
              className={cn('stroke-2', isAuto && speedFeedbackEnabled ? moduleActiveClass : moduleMutedClass)}
            />
            <text
              x="465"
              y="194"
              textAnchor="middle"
              className={cn('text-[13px] fill-current', isAuto && speedFeedbackEnabled ? moduleTextActiveClass : moduleTextMutedClass)}
            >
              测速反馈
            </text>

            {/* Disturbance filter */}
            <rect
              x="540"
              y="28"
              width="140"
              height="26"
              rx="8"
              className={cn('stroke-2', hasDisturbance ? moduleActiveClass : moduleMutedClass)}
            />
            <text
              x="610"
              y="46"
              textAnchor="middle"
              className={cn('text-[13px] fill-current', hasDisturbance ? moduleTextActiveClass : moduleTextMutedClass)}
            >
              滤波器 1/(Ts+1)
            </text>

            {/* Signal lines with arrows */}
            <line x1="50" y1="100" x2="74" y2="100" className={lineActiveClass} markerEnd={markerActive} />
            <line x1="106" y1="100" x2="130" y2="100" className={pidLineClass} markerEnd={pidEnabled ? markerActive : markerMuted} />
            <line x1="310" y1="100" x2="336" y2="100" className={pidLineClass} markerEnd={pidEnabled ? markerActive : markerMuted} />
            <line x1="364" y1="100" x2="390" y2="100" className={lineActiveClass} markerEnd={markerActive} />
            <line x1="540" y1="100" x2="596" y2="100" className={lineActiveClass} markerEnd={markerActive} />
            <line x1="624" y1="100" x2="690" y2="100" className={lineActiveClass} markerEnd={markerActive} />

            {/* Feedforward path */}
            <path d="M 56 100 L 56 -4 L 150 -4" className={feedforwardLineClass} fill="none" markerEnd={isAuto && feedforwardEnabled ? markerActive : markerMuted} />
            <path d="M 290 -4 L 350 -4 L 350 86" className={feedforwardLineClass} fill="none" markerEnd={isAuto && feedforwardEnabled ? markerActive : markerMuted} />

            {/* Manual path */}
            <path d="M 112 100 L 112 159 L 155 159" className={manualLineClass} fill="none" markerEnd={manualActive ? markerActive : markerMuted} />
            <path d="M 285 159 L 350 159 L 350 114" className={manualLineClass} fill="none" markerEnd={manualActive ? markerActive : markerMuted} />

            {/* Disturbance path */}
            <path d="M 610 18 L 610 28" className={disturbanceLineClass} fill="none" markerEnd={hasDisturbance ? markerActive : markerMuted} />
            <path d="M 610 54 L 610 86" className={disturbanceLineClass} fill="none" markerEnd={hasDisturbance ? markerActive : markerMuted} />

            {/* Feedback path (after disturbance) */}
            <path d="M 640 100 L 640 189 L 540 189" className={speedFeedbackLineClass} fill="none" markerEnd={isAuto && speedFeedbackEnabled ? markerActive : markerMuted} />
            <path d="M 390 189 L 90 189 L 90 116" className={speedFeedbackLineClass} fill="none" markerEnd={isAuto && speedFeedbackEnabled ? markerActive : markerMuted} />

            {/* Unity feedback */}
            <path d="M 660 100 L 660 217 L 90 217 L 90 116" className={unityFeedbackLineClass} fill="none" markerEnd={isAuto ? markerActive : markerMuted} />
            <text x="74" y="124" textAnchor="middle" className="fill-slate-300 text-[14px]">-</text>
          </svg>
        </div>
        <div className="text-sm text-slate-300">高亮模块表示当前控制结构启用。</div>
      </div>

      {aiSection && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          {aiSection}
        </div>
      )}
      
      {/* 参数滑块 */}
      {isAuto ? (
        <div className="space-y-4 flex-1 overflow-y-auto pr-1 custom-scrollbar">
          {canTuneKp && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-slate-200">
                <span>比例增益 Kp（Lv {getLevel('P')}）</span>
                <span className="font-mono text-white">{pidParams.kp.toFixed(2)} / {kpMax.toFixed(2)}</span>
              </div>
              <input 
                type="range" 
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                min="0" max={kpMax} step="0.005"
                value={pidParams.kp}
                onChange={(e) => setPidParams({ kp: parseFloat(e.target.value) })}
              />
            </div>
          )}

          {canTuneKi && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-slate-200">
                <span>积分增益 Ki（Lv {getLevel('PI')}）</span>
                <span className="font-mono text-white">{pidParams.ki.toFixed(2)} / {kiMax.toFixed(2)}</span>
              </div>
              <input 
                type="range" 
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                min="0" max={kiMax} step="0.002"
                value={pidParams.ki}
                onChange={(e) => setPidParams({ ki: parseFloat(e.target.value) })}
              />
            </div>
          )}

          {canTuneKd && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-slate-200">
                <span>微分增益 Kd（Lv {getLevel('PD')}）</span>
                <span className="font-mono text-white">{pidParams.kd.toFixed(2)} / {kdMax.toFixed(2)}</span>
              </div>
              <input 
                type="range" 
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                min="0" max={kdMax} step="0.005"
                value={pidParams.kd}
                onChange={(e) => setPidParams({ kd: parseFloat(e.target.value) })}
              />
            </div>
          )}

          {speedFeedbackEnabled && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-slate-200">
                <span>测速反馈时间常数 τ（Lv {getLevel('VFB')}）</span>
                <span className="font-mono text-white">{extraParams.speedFeedbackTau.toFixed(2)} / {tauMax.toFixed(2)}</span>
              </div>
              <input 
                type="range" 
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-400"
                min="0" max={tauMax} step="0.005"
                value={extraParams.speedFeedbackTau}
                onChange={(e) => setExtraParams({ speedFeedbackTau: parseFloat(e.target.value) })}
              />
            </div>
          )}

          {feedforwardEnabled && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-slate-200">
                <span>前馈增益 Kff（Lv {getLevel('FF')}）</span>
                <span className="font-mono text-white">{extraParams.feedforwardGain.toFixed(2)} / {ffMax.toFixed(2)}</span>
              </div>
              <input 
                type="range" 
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                min="0" max={ffMax} step="0.005"
                value={extraParams.feedforwardGain}
                onChange={(e) => setExtraParams({ feedforwardGain: parseFloat(e.target.value) })}
              />
            </div>
          )}

          {smithPredictorEnabled && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-slate-200">
                <span>史密斯预估延时 L_est（Lv {getLevel('SMITH')}）</span>
                <span className="font-mono text-white">{extraParams.smithDelay.toFixed(2)} / {smithMax.toFixed(2)}</span>
              </div>
              <input
                type="range"
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                min="0" max={smithMax} step="0.01"
                value={extraParams.smithDelay}
                onChange={(e) => setExtraParams({ smithDelay: parseFloat(e.target.value) })}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-300 bg-slate-950/40 rounded-lg border border-slate-800">
          手动模式无需整定参数。
        </div>
      )}
      
    </div>
  );
};

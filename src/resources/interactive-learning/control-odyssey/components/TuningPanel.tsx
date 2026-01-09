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

export const TuningPanel: React.FC = () => {
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
    setSpeedFeedbackEnabled,
    setFeedforwardEnabled
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
  const speedFeedbackEnabled = enableSpeedFeedback && isSpeedFeedbackUnlocked;
  const feedforwardEnabled = enableFeedforward && isFeedforwardUnlocked;
  const getLevel = (id: ControllerId) => controllerLevels[id] ?? 0;
  const baseMax = 0.1;
  const kpMax = Math.max(baseMax, baseMax * Math.pow(2, Math.max(0, getLevel('P') - 1)));
  const kiMax = Math.max(baseMax, baseMax * Math.pow(2, Math.max(0, getLevel('PI') - 1)));
  const kdMax = Math.max(baseMax, baseMax * Math.pow(2, Math.max(0, getLevel('PD') - 1)));
  const tauMax = Math.max(baseMax, baseMax * Math.pow(2, Math.max(0, getLevel('VFB') - 1)));
  const ffMax = Math.max(baseMax, baseMax * Math.pow(2, Math.max(0, getLevel('FF') - 1)));
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
  const feedforwardLineClass = feedforwardEnabled ? lineActiveClass : lineMutedClass;
  const speedFeedbackLineClass = speedFeedbackEnabled ? lineActiveClass : lineMutedClass;
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
  }, [enableSpeedFeedback, enableFeedforward, isSpeedFeedbackUnlocked, isFeedforwardUnlocked, setSpeedFeedbackEnabled, setFeedforwardEnabled]);
  
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
            return (
              <button
                key={id}
                type="button"
                disabled={!unlocked}
                onClick={() => setControllerId(id)}
                className={`rounded-lg border px-2 py-2 text-sm font-semibold transition-all ${
                  baseController === id
                    ? 'border-emerald-400 bg-emerald-500/10 text-emerald-200'
                    : 'border-slate-800 bg-slate-950/60 text-slate-300'
                } ${!unlocked ? 'opacity-40 cursor-not-allowed' : 'hover:border-slate-600'}`}
              >
                <div className="flex flex-col items-center gap-1">
                  <span>{label}</span>
                  <span className="text-xs font-mono text-slate-300">Lv {level || 0}</span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="text-xs text-slate-300">
          未解锁控制器需在控制商店兑换。
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm text-slate-300 uppercase tracking-wider">复合控制模块</div>
        <div className="grid grid-cols-2 gap-2">
          {CONTROL_MODULES.map((moduleId) => {
            const unlocked = unlockedControllers.includes(moduleId);
            const label = controllerLabelMap[moduleId] ?? moduleId;
            const level = getLevel(moduleId);
            const enabled = moduleId === 'VFB' ? speedFeedbackEnabled : feedforwardEnabled;
            const toggle = moduleId === 'VFB' ? setSpeedFeedbackEnabled : setFeedforwardEnabled;
            return (
              <button
                key={moduleId}
                type="button"
                disabled={!unlocked}
                onClick={() => toggle(!enabled)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm font-semibold transition-all flex items-center justify-between',
                  enabled
                    ? 'border-blue-400 bg-blue-500/10 text-blue-200'
                    : 'border-slate-800 bg-slate-950/60 text-slate-300',
                  !unlocked && 'opacity-40 cursor-not-allowed'
                )}
              >
                <div className="flex flex-col items-start">
                  <span>{label}</span>
                  <span className="text-xs font-mono text-slate-300">Lv {level || 0}</span>
                </div>
                {!unlocked && <Lock className="w-3 h-3 text-slate-500" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm text-slate-300 uppercase tracking-wider">控制结构方框图</div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
          <svg viewBox="0 0 760 210" className="w-full h-[210px]">
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
            <rect x="10" y="6" width="740" height="198" rx="12" className="fill-slate-950/60 stroke-slate-800" />

            {/* Signals */}
            <text x="20" y="104" className={cn(baseTextClass, 'text-[13px]')}>R(t)</text>
            <text x="690" y="104" className={cn(baseTextClass, 'text-[13px]')}>Y(t)</text>
            <text
              x="590"
              y="12"
              textAnchor="middle"
              className={cn('text-[12px] fill-current', hasDisturbance ? moduleTextActiveClass : moduleTextMutedClass)}
            >
              D(t)
            </text>

            {/* Summing junctions */}
            <circle cx="90" cy="100" r="16" className="fill-slate-950 stroke-slate-500" />
            <text x="90" y="104" textAnchor="middle" className="fill-slate-300 text-[13px]">Σ</text>
            <circle cx="350" cy="100" r="14" className="fill-slate-950 stroke-slate-500" />
            <text x="350" y="104" textAnchor="middle" className="fill-slate-300 text-[13px]">Σ</text>
            <circle cx="590" cy="100" r="14" className="fill-slate-950 stroke-slate-500" />
            <text x="590" y="104" textAnchor="middle" className="fill-slate-300 text-[13px]">Σ</text>

            {/* PID block */}
            <rect
              x="130"
              y="34"
              width="180"
              height="120"
              rx="12"
              className={cn('stroke-2', pidEnabled ? moduleActiveClass : moduleMutedClass)}
            />
            <text x="220" y="28" textAnchor="middle" className="fill-slate-400 text-[12px]">PID 并联</text>
            <rect
              x="155"
              y="48"
              width="130"
              height="28"
              rx="8"
              className={cn('stroke-2', isAuto && controllerCaps.kp ? moduleActiveClass : moduleMutedClass)}
            />
            <text
              x="220"
              y="67"
              textAnchor="middle"
              className={cn('text-[13px] fill-current', isAuto && controllerCaps.kp ? moduleTextActiveClass : moduleTextMutedClass)}
            >
              P
            </text>
            <rect
              x="155"
              y="82"
              width="130"
              height="28"
              rx="8"
              className={cn('stroke-2', isAuto && controllerCaps.ki ? moduleActiveClass : moduleMutedClass)}
            />
            <text
              x="220"
              y="101"
              textAnchor="middle"
              className={cn('text-[13px] fill-current', isAuto && controllerCaps.ki ? moduleTextActiveClass : moduleTextMutedClass)}
            >
              I
            </text>
            <rect
              x="155"
              y="116"
              width="130"
              height="28"
              rx="8"
              className={cn('stroke-2', isAuto && controllerCaps.kd ? moduleActiveClass : moduleMutedClass)}
            />
            <text
              x="220"
              y="135"
              textAnchor="middle"
              className={cn('text-[13px] fill-current', isAuto && controllerCaps.kd ? moduleTextActiveClass : moduleTextMutedClass)}
            >
              D
            </text>

            {/* Manual control */}
            <rect
              x="155"
              y="160"
              width="130"
              height="28"
              rx="8"
              className={cn('stroke-2', manualActive ? moduleActiveClass : moduleMutedClass)}
            />
            <text
              x="220"
              y="179"
              textAnchor="middle"
              className={cn('text-[12px] fill-current', manualActive ? moduleTextActiveClass : moduleTextMutedClass)}
            >
              手动控制
            </text>

            {/* Feedforward */}
            <rect
              x="150"
              y="12"
              width="140"
              height="28"
              rx="8"
              className={cn('stroke-2', feedforwardEnabled ? moduleActiveClass : moduleMutedClass)}
            />
            <text
              x="220"
              y="31"
              textAnchor="middle"
              className={cn('text-[12px] fill-current', feedforwardEnabled ? moduleTextActiveClass : moduleTextMutedClass)}
            >
              前馈 F(s)
            </text>

            {/* Plant */}
            <rect x="390" y="70" width="150" height="60" rx="10" className={cn('stroke-2', moduleActiveClass)} />
            <text x="465" y="104" textAnchor="middle" className={cn(baseTextClass, 'text-[13px]')}>对象 G(s)</text>

            {/* Speed feedback */}
            <rect
              x="390"
              y="150"
              width="150"
              height="36"
              rx="8"
              className={cn('stroke-2', speedFeedbackEnabled ? moduleActiveClass : moduleMutedClass)}
            />
            <text
              x="465"
              y="173"
              textAnchor="middle"
              className={cn('text-[12px] fill-current', speedFeedbackEnabled ? moduleTextActiveClass : moduleTextMutedClass)}
            >
              测速反馈
            </text>

            {/* Disturbance filter */}
            <rect
              x="520"
              y="12"
              width="140"
              height="28"
              rx="8"
              className={cn('stroke-2', hasDisturbance ? moduleActiveClass : moduleMutedClass)}
            />
            <text
              x="590"
              y="31"
              textAnchor="middle"
              className={cn('text-[12px] fill-current', hasDisturbance ? moduleTextActiveClass : moduleTextMutedClass)}
            >
              滤波器 1/(Ts+1)
            </text>

            {/* Signal lines with arrows */}
            <line x1="50" y1="100" x2="74" y2="100" className={lineActiveClass} markerEnd={markerActive} />
            <line x1="106" y1="100" x2="130" y2="100" className={pidLineClass} markerEnd={pidEnabled ? markerActive : markerMuted} />
            <line x1="310" y1="100" x2="336" y2="100" className={pidLineClass} markerEnd={pidEnabled ? markerActive : markerMuted} />
            <line x1="364" y1="100" x2="390" y2="100" className={lineActiveClass} markerEnd={markerActive} />
            <line x1="540" y1="100" x2="576" y2="100" className={lineActiveClass} markerEnd={markerActive} />
            <line x1="604" y1="100" x2="680" y2="100" className={lineActiveClass} markerEnd={markerActive} />

            {/* Feedforward path */}
            <path d="M 60 100 L 60 26 L 150 26" className={feedforwardLineClass} fill="none" markerEnd={feedforwardEnabled ? markerActive : markerMuted} />
            <path d="M 290 26 L 350 26 L 350 86" className={feedforwardLineClass} fill="none" markerEnd={feedforwardEnabled ? markerActive : markerMuted} />

            {/* Manual path */}
            <path d="M 90 100 L 90 174 L 155 174" className={manualLineClass} fill="none" markerEnd={manualActive ? markerActive : markerMuted} />
            <path d="M 285 174 L 350 174 L 350 86" className={manualLineClass} fill="none" markerEnd={manualActive ? markerActive : markerMuted} />

            {/* Disturbance path */}
            <path d="M 590 6 L 590 12" className={disturbanceLineClass} fill="none" markerEnd={hasDisturbance ? markerActive : markerMuted} />
            <path d="M 590 40 L 590 86" className={disturbanceLineClass} fill="none" markerEnd={hasDisturbance ? markerActive : markerMuted} />

            {/* Feedback path (after disturbance) */}
            <path d="M 620 100 L 620 168 L 540 168" className={speedFeedbackLineClass} fill="none" markerEnd={speedFeedbackEnabled ? markerActive : markerMuted} />
            <path d="M 390 168 L 90 168 L 90 116" className={speedFeedbackLineClass} fill="none" markerEnd={speedFeedbackEnabled ? markerActive : markerMuted} />

            {/* Unity feedback */}
            <path d="M 650 100 L 650 200 L 90 200 L 90 116" className={unityFeedbackLineClass} fill="none" markerEnd={isAuto ? markerActive : markerMuted} />
            <text x="360" y="194" textAnchor="middle" className="fill-slate-400 text-[12px]">1</text>
          </svg>
        </div>
        <div className="text-xs text-slate-400">高亮模块表示当前控制结构启用。</div>
      </div>
      
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
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-300 bg-slate-950/40 rounded-lg border border-slate-800">
          手动模式无需整定参数。
        </div>
      )}
      
    </div>
  );
};

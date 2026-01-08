'use client';

import React, { useEffect } from 'react';
import { Lock, Settings2 } from 'lucide-react';
import { useGameStore } from '../store/game-store';
import {
  CONTROL_BASE_CONTROLLERS,
  CONTROL_MODULES,
  CONTROL_SHOP_CONFIG,
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
    shipY,
    shipU,
    shipR,
    controllerId,
    setControllerId,
    unlockedControllers,
    controllerLevels,
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
  const kpMax = Math.max(1, Math.pow(2, Math.max(0, getLevel('P') - 1)));
  const kiMax = Math.max(1, Math.pow(2, Math.max(0, getLevel('PI') - 1)));
  const kdMax = Math.max(1, Math.pow(2, Math.max(0, getLevel('PD') - 1)));
  const tauMax = Math.max(1, Math.pow(2, Math.max(0, getLevel('VFB') - 1)));
  const ffMax = Math.max(1, Math.pow(2, Math.max(0, getLevel('FF') - 1)));
  const controllerLabelMap = CONTROL_SHOP_CONFIG.items.reduce<Record<ControllerId, string>>((acc, item) => {
    acc[item.unlocks.controller] = item.label;
    return acc;
  }, {} as Record<ControllerId, string>);

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
  
  // 格式化数值
  const formattedU = (shipU * 100).toFixed(0); 
  const formattedY = shipY.toFixed(0);
  const formattedR = shipR.toFixed(0);

  return (
    <div className="w-full h-full bg-slate-900/50 rounded-xl border border-slate-800 p-4 flex flex-col gap-4">
      <div className="flex items-center gap-2 text-slate-300 pb-2 border-b border-slate-800">
        <Settings2 className="h-4 w-4" />
        <span className="font-semibold">控制器整定</span>
        <div className={`ml-auto text-xs px-2 py-0.5 rounded font-mono ${isAuto ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>
          {isAuto ? '自动模式' : '手动模式'}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-slate-500 uppercase tracking-wider">控制器选择</div>
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
                className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-all ${
                  baseController === id
                    ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400'
                } ${!unlocked ? 'opacity-40 cursor-not-allowed' : 'hover:border-slate-600'}`}
              >
                <div className="flex flex-col items-center gap-1">
                  <span>{label}</span>
                  <span className="text-[10px] font-mono text-slate-500">Lv {level || 0}</span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="text-[10px] text-slate-500">
          未解锁控制器需在控制商店兑换。
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-slate-500 uppercase tracking-wider">复合控制模块</div>
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
                  'rounded-lg border px-3 py-2 text-xs font-semibold transition-all flex items-center justify-between',
                  enabled
                    ? 'border-blue-400 bg-blue-500/10 text-blue-300'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400',
                  !unlocked && 'opacity-40 cursor-not-allowed'
                )}
              >
                <div className="flex flex-col items-start">
                  <span>{label}</span>
                  <span className="text-[10px] font-mono text-slate-500">Lv {level || 0}</span>
                </div>
                {!unlocked && <Lock className="w-3 h-3 text-slate-500" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-slate-500 uppercase tracking-wider">控制结构方框图</div>
        <div className="grid grid-cols-5 gap-2">
          {[
            { id: 'FF', label: '前馈', active: feedforwardEnabled, level: getLevel('FF') },
            { id: 'P', label: 'P', active: controllerCaps.kp, level: getLevel('P') },
            { id: 'I', label: 'I', active: controllerCaps.ki, level: getLevel('PI') },
            { id: 'D', label: 'D', active: controllerCaps.kd, level: getLevel('PD') },
            { id: 'VFB', label: '测速', active: speedFeedbackEnabled, level: getLevel('VFB') }
          ].map((block) => (
            <div
              key={block.id}
              className={cn(
                'rounded-lg border px-2 py-2 text-center text-xs transition-all',
                block.active
                  ? 'border-emerald-400 bg-emerald-500/10 text-emerald-200'
                  : 'border-slate-800 bg-slate-950/40 text-slate-500'
              )}
            >
              <div className="font-semibold">{block.label}</div>
              <div className="text-[10px] font-mono text-slate-500">Lv {block.level || 0}</div>
            </div>
          ))}
        </div>
        <div className="text-[10px] text-slate-600">高亮表示当前控制结构启用。</div>
      </div>
      
      {/* 参数滑块 */}
      {isAuto ? (
        <div className="space-y-4 flex-1 overflow-y-auto pr-1 custom-scrollbar">
          {canTuneKp && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>比例增益 Kp（Lv {getLevel('P')}）</span>
                <span className="font-mono text-white">{pidParams.kp.toFixed(2)} / {kpMax.toFixed(2)}</span>
              </div>
              <input 
                type="range" 
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                min="0.1" max={kpMax} step="0.05"
                value={pidParams.kp}
                onChange={(e) => setPidParams({ kp: parseFloat(e.target.value) })}
              />
            </div>
          )}

          {canTuneKi && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>积分增益 Ki（Lv {getLevel('PI')}）</span>
                <span className="font-mono text-white">{pidParams.ki.toFixed(2)} / {kiMax.toFixed(2)}</span>
              </div>
              <input 
                type="range" 
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                min="0.1" max={kiMax} step="0.01"
                value={pidParams.ki}
                onChange={(e) => setPidParams({ ki: parseFloat(e.target.value) })}
              />
            </div>
          )}

          {canTuneKd && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>微分增益 Kd（Lv {getLevel('PD')}）</span>
                <span className="font-mono text-white">{pidParams.kd.toFixed(2)} / {kdMax.toFixed(2)}</span>
              </div>
              <input 
                type="range" 
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                min="0.1" max={kdMax} step="0.05"
                value={pidParams.kd}
                onChange={(e) => setPidParams({ kd: parseFloat(e.target.value) })}
              />
            </div>
          )}

          {speedFeedbackEnabled && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>测速反馈时间常数 τ（Lv {getLevel('VFB')}）</span>
                <span className="font-mono text-white">{extraParams.speedFeedbackTau.toFixed(2)} / {tauMax.toFixed(2)}</span>
              </div>
              <input 
                type="range" 
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-400"
                min="0.1" max={tauMax} step="0.05"
                value={extraParams.speedFeedbackTau}
                onChange={(e) => setExtraParams({ speedFeedbackTau: parseFloat(e.target.value) })}
              />
            </div>
          )}

          {feedforwardEnabled && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>前馈增益 Kff（Lv {getLevel('FF')}）</span>
                <span className="font-mono text-white">{extraParams.feedforwardGain.toFixed(2)} / {ffMax.toFixed(2)}</span>
              </div>
              <input 
                type="range" 
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                min="0.1" max={ffMax} step="0.05"
                value={extraParams.feedforwardGain}
                onChange={(e) => setExtraParams({ feedforwardGain: parseFloat(e.target.value) })}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-xs text-slate-500 bg-slate-950/40 rounded-lg border border-slate-800">
          手动模式无需整定参数。
        </div>
      )}
      
      {/* 实时遥测数据 */}
      <div className="mt-auto p-3 bg-slate-950/50 rounded-lg border border-slate-800/50">
        <div className="text-xs text-slate-500 mb-2 font-semibold">实时遥测</div>
        <div className="space-y-1.5 text-xs font-mono">
          <div className="flex justify-between">
             <span className="text-slate-400">给定航线 R:</span>
             <span className="text-white">{isAuto ? formattedR : '--'}</span>
          </div>
          <div className="flex justify-between">
             <span className="text-slate-400">系统响应 Y:</span>
             <span className="text-blue-400">{formattedY}</span>
          </div>
          <div className="flex justify-between">
             <span className="text-slate-400">误差 E:</span>
             <span className={`${Math.abs(shipR - shipY) > 50 ? 'text-red-400' : 'text-emerald-400'}`}>
               {isAuto ? (shipR - shipY).toFixed(0) : '--'}
             </span>
          </div>
          <div className="flex justify-between border-t border-slate-800 pt-1 mt-1">
             <span className="text-slate-400">控制信号 U:</span>
             <span className={`${shipU > 0 ? 'text-green-400' : shipU < 0 ? 'text-red-400' : 'text-slate-500'}`}>
               {formattedU}%
             </span>
          </div>
        </div>
      </div>
    </div>
  );
};

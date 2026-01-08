'use client';

import React, { useEffect } from 'react';
import { Settings2 } from 'lucide-react';
import { useGameStore } from '../store/game-store';
import { CONTROL_SHOP_CONFIG, type ControllerId } from '../level-data';

export const TuningPanel: React.FC = () => {
  const {
    controlMode,
    pidParams,
    setPidParams,
    shipY,
    shipU,
    shipR,
    controllerId,
    setControllerId,
    unlockedControllers
  } = useGameStore();
  
  const isAuto = controlMode === 'AUTO';
  const controllerAllows: Record<ControllerId, { kp: boolean; ki: boolean; kd: boolean }> = {
    P: { kp: true, ki: false, kd: false },
    PI: { kp: true, ki: true, kd: false },
    PD: { kp: true, ki: false, kd: true },
    PID: { kp: true, ki: true, kd: true }
  };
  const controllerCaps = controllerAllows[controllerId] ?? controllerAllows.P;
  const canTuneKp = isAuto && controllerCaps.kp;
  const canTuneKi = isAuto && controllerCaps.ki;
  const canTuneKd = isAuto && controllerCaps.kd;

  useEffect(() => {
    if (!unlockedControllers.includes(controllerId)) {
      setControllerId(unlockedControllers[0] ?? 'P');
    }
  }, [unlockedControllers, controllerId, setControllerId]);
  
  // 格式化数值
  const formattedU = (shipU * 100).toFixed(0); 
  const formattedY = shipY.toFixed(0);
  const formattedR = shipR.toFixed(0);

  return (
    <div className="w-full h-full bg-slate-900/50 rounded-xl border border-slate-800 p-4 flex flex-col gap-4">
      <div className="flex items-center gap-2 text-slate-300 pb-2 border-b border-slate-800">
        <Settings2 className="h-4 w-4" />
        <span className="font-semibold">Controller Tuning</span>
        <div className={`ml-auto text-xs px-2 py-0.5 rounded font-mono ${isAuto ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>
          {isAuto ? 'PID AUTO' : 'MANUAL'}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-slate-500 uppercase tracking-wider">控制器选择</div>
        <div className="grid grid-cols-4 gap-2">
          {CONTROL_SHOP_CONFIG.items.map((item) => {
            const id = item.unlocks.controller;
            const unlocked = unlockedControllers.includes(id);
            return (
              <button
                key={item.id}
                type="button"
                disabled={!unlocked}
                onClick={() => setControllerId(id)}
                className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-all ${
                  controllerId === id
                    ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400'
                } ${!unlocked ? 'opacity-40 cursor-not-allowed' : 'hover:border-slate-600'}`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="text-[10px] text-slate-500">
          未解锁控制器需在控制商店兑换。
        </div>
      </div>
      
      {/* 参数滑块 */}
      <div className="space-y-4 flex-1 overflow-y-auto pr-1 custom-scrollbar">
        {/* Kp */}
        <div className={`space-y-2 ${!canTuneKp && 'opacity-50 grayscale'}`}>
          <div className="flex justify-between text-xs text-slate-400">
            <span>Proportional (Kp)</span>
            <span className="font-mono text-white">{pidParams.kp.toFixed(2)}</span>
          </div>
          <input 
            type="range" 
            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:cursor-not-allowed"
            min="0" max="5" step="0.05"
            value={pidParams.kp}
            onChange={(e) => setPidParams({ kp: parseFloat(e.target.value) })}
            disabled={!canTuneKp}
          />
        </div>

        {/* Ki */}
        <div className={`space-y-2 ${!canTuneKi && 'opacity-50 grayscale'}`}>
          <div className="flex justify-between text-xs text-slate-400">
            <span>Integral (Ki)</span>
            <span className="font-mono text-white">{pidParams.ki.toFixed(2)}</span>
          </div>
          <input 
            type="range" 
            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:cursor-not-allowed"
            min="0" max="2" step="0.01"
            value={pidParams.ki}
            onChange={(e) => setPidParams({ ki: parseFloat(e.target.value) })}
            disabled={!canTuneKi}
          />
        </div>

        {/* Kd */}
        <div className={`space-y-2 ${!canTuneKd && 'opacity-50 grayscale'}`}>
          <div className="flex justify-between text-xs text-slate-400">
            <span>Derivative (Kd)</span>
            <span className="font-mono text-white">{pidParams.kd.toFixed(2)}</span>
          </div>
          <input 
            type="range" 
            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:cursor-not-allowed"
            min="0" max="5" step="0.05"
            value={pidParams.kd}
            onChange={(e) => setPidParams({ kd: parseFloat(e.target.value) })}
            disabled={!canTuneKd}
          />
        </div>
      </div>
      
      {/* 实时遥测数据 */}
      <div className="mt-auto p-3 bg-slate-950/50 rounded-lg border border-slate-800/50">
        <div className="text-xs text-slate-500 mb-2 font-semibold">REAL-TIME TELEMETRY</div>
        <div className="space-y-1.5 text-xs font-mono">
          <div className="flex justify-between">
             <span className="text-slate-400">Setpoint (R):</span>
             <span className="text-white">{isAuto ? formattedR : '--'}</span>
          </div>
          <div className="flex justify-between">
             <span className="text-slate-400">Position (Y):</span>
             <span className="text-blue-400">{formattedY}</span>
          </div>
          <div className="flex justify-between">
             <span className="text-slate-400">Error (E):</span>
             <span className={`${Math.abs(shipR - shipY) > 50 ? 'text-red-400' : 'text-emerald-400'}`}>
               {isAuto ? (shipR - shipY).toFixed(0) : '--'}
             </span>
          </div>
          <div className="flex justify-between border-t border-slate-800 pt-1 mt-1">
             <span className="text-slate-400">Output (U):</span>
             <span className={`${shipU > 0 ? 'text-green-400' : shipU < 0 ? 'text-red-400' : 'text-slate-500'}`}>
               {formattedU}%
             </span>
          </div>
        </div>
      </div>
    </div>
  );
};

'use client';

import type { ContourParams, ContourType } from './types';

interface ContourSettingsPanelProps {
  contourParams: ContourParams;
  onParamsChange: (params: Partial<ContourParams>) => void;
  onDraw: () => void;
  onClear: () => void;
}

export function ContourSettingsPanel({
  contourParams,
  onParamsChange,
  onDraw,
  onClear,
}: ContourSettingsPanelProps) {
  const contourTypes: { value: ContourType; label: string; description: string }[] = [
    { value: 'circle', label: '圆形', description: '完整圆形包围线' },
    { value: 'semicircle', label: '半圆延直线', description: 'Nyquist轮廓' },
    { value: 'rectangle', label: '矩形', description: '矩形包围线' },
    { value: 'manual', label: '手动绘制', description: '在源平面左键绘制' },
  ];

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/80 p-4 backdrop-blur-sm">
      <h3 className="mb-4 text-sm font-semibold text-white">包围线设置</h3>

      {/* 轮廓类型 */}
      <div className="mb-4">
        <label htmlFor="contour-settings-panel-control-1" className="mb-2 block text-xs text-slate-400">包围曲线类型</label>
        <select id="contour-settings-panel-control-1"
          value={contourParams.type}
          onChange={(e) => onParamsChange({ type: e.target.value as ContourType })}
          className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
        >
          {contourTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label} - {type.description}
            </option>
          ))}
        </select>
      </div>

      {/* 圆形/半圆参数 */}
      {(contourParams.type === 'circle' || contourParams.type === 'semicircle') && (
        <div className="mb-4">
          <label className="mb-2 flex items-center justify-between text-xs text-slate-400">
            <span>半径</span>
            <span className="text-white">{contourParams.radius.toFixed(1)}</span>
          </label>
          <input aria-label="轮廓半径"
            type="range"
            min="0.5"
            max="5"
            step="0.1"
            value={contourParams.radius}
            onChange={(e) => onParamsChange({ radius: parseFloat(e.target.value) })}
            className="w-full accent-blue-500"
          />
        </div>
      )}

      {/* 矩形参数 */}
      {contourParams.type === 'rectangle' && (
        <>
          <div className="mb-4">
            <label className="mb-2 flex items-center justify-between text-xs text-slate-400">
              <span>宽度</span>
              <span className="text-white">{contourParams.width.toFixed(1)}</span>
            </label>
            <input aria-label="轮廓中心实部"
              type="range"
              min="0.5"
              max="5"
              step="0.1"
              value={contourParams.width}
              onChange={(e) => onParamsChange({ width: parseFloat(e.target.value) })}
              className="w-full accent-blue-500"
            />
          </div>
          <div className="mb-4">
            <label className="mb-2 flex items-center justify-between text-xs text-slate-400">
              <span>高度</span>
              <span className="text-white">{contourParams.height.toFixed(1)}</span>
            </label>
            <input aria-label="轮廓中心虚部"
              type="range"
              min="0.5"
              max="5"
              step="0.1"
              value={contourParams.height}
              onChange={(e) => onParamsChange({ height: parseFloat(e.target.value) })}
              className="w-full accent-blue-500"
            />
          </div>
        </>
      )}

      {/* 手动绘制提示 */}
      {contourParams.type === 'manual' && (
        <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800/50 p-3">
          <p className="text-xs text-slate-400">
            在源平面中使用<span className="text-blue-400">左键</span>绘制包围线
          </p>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <button type="button"
          onClick={onDraw}
          className="flex-1 rounded-lg bg-blue-500/20 px-4 py-2 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/30"
        >
          绘制
        </button>
        <button type="button"
          onClick={onClear}
          className="flex-1 rounded-lg bg-slate-700/50 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700"
        >
          清除
        </button>
      </div>
    </div>
  );
}

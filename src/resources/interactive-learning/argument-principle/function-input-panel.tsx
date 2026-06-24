'use client';

import { useState } from 'react';
import type { InputFormat } from './types';

interface FunctionInputPanelProps {
  inputFormat: InputFormat;
  onFormatChange: (format: InputFormat) => void;
  onParse: (format: InputFormat, data: unknown) => void;
  parseError: string;
}

export function FunctionInputPanel({
  inputFormat,
  onFormatChange,
  onParse,
  parseError,
}: FunctionInputPanelProps) {
  const [numerator, setNumerator] = useState('1, 0, -1');
  const [denominator, setDenominator] = useState('1, 1');
  const [zeros, setZeros] = useState('1, -1');
  const [poles, setPoles] = useState('-1');
  const [gain, setGain] = useState('1');
  const [expression, setExpression] = useState('(s^2-1)/(s+1)');

  const handleParse = () => {
    switch (inputFormat) {
      case 'tf':
        onParse('tf', {
          numerator: numerator.split(',').map((s) => parseFloat(s.trim())),
          denominator: denominator.split(',').map((s) => parseFloat(s.trim())),
        });
        break;
      case 'zpk':
        onParse('zpk', {
          zeros: zeros.split(',').map((s) => {
            const trimmed = s.trim();
            const match = trimmed.match(/([+-]?\d*\.?\d*)\s*([+-]?\d*\.?\d*)i?/);
            if (match) {
              const re = parseFloat(match[1]) || 0;
              const im = parseFloat(match[2]) || 0;
              return { re, im };
            }
            return { re: parseFloat(trimmed) || 0, im: 0 };
          }),
          poles: poles.split(',').map((s) => {
            const trimmed = s.trim();
            const match = trimmed.match(/([+-]?\d*\.?\d*)\s*([+-]?\d*\.?\d*)i?/);
            if (match) {
              const re = parseFloat(match[1]) || 0;
              const im = parseFloat(match[2]) || 0;
              return { re, im };
            }
            return { re: parseFloat(trimmed) || 0, im: 0 };
          }),
          gain: parseFloat(gain) || 1,
        });
        break;
      case 'expr':
        onParse('expr', { expression });
        break;
    }
  };

  const formatTabs: { value: InputFormat; label: string }[] = [
    { value: 'tf', label: '传递函数' },
    { value: 'zpk', label: '零极点' },
    { value: 'expr', label: '表达式' },
  ];

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/80 p-4 backdrop-blur-sm">
      <h3 className="mb-4 text-sm font-semibold text-white">函数输入</h3>

      {/* 格式选项卡 */}
      <div className="mb-4 flex gap-1 rounded-lg bg-slate-800/50 p-1">
        {formatTabs.map((tab) => (
          <button type="button"
            key={tab.value}
            onClick={() => onFormatChange(tab.value)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              inputFormat === tab.value
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 传递函数输入 */}
      {inputFormat === 'tf' && (
        <div className="space-y-3">
          <div>
            <label htmlFor="function-input-panel-control-1" className="mb-1 block text-xs text-slate-400">分子系数 (降幂)</label>
            <input id="function-input-panel-control-1" aria-label="例如: 1, 0, -1"
              type="text"
              value={numerator}
              onChange={(e) => setNumerator(e.target.value)}
              placeholder="例如: 1, 0, -1"
              className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="function-input-panel-control-2" className="mb-1 block text-xs text-slate-400">分母系数 (降幂)</label>
            <input id="function-input-panel-control-2" aria-label="例如: 1, 1"
              type="text"
              value={denominator}
              onChange={(e) => setDenominator(e.target.value)}
              placeholder="例如: 1, 1"
              className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* 零极点输入 */}
      {inputFormat === 'zpk' && (
        <div className="space-y-3">
          <div>
            <label htmlFor="function-input-panel-control-3" className="mb-1 block text-xs text-slate-400">零点位置</label>
            <input id="function-input-panel-control-3" aria-label="例如: 1, -1, 1+2i"
              type="text"
              value={zeros}
              onChange={(e) => setZeros(e.target.value)}
              placeholder="例如: 1, -1, 1+2i"
              className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="function-input-panel-control-4" className="mb-1 block text-xs text-slate-400">极点位置</label>
            <input id="function-input-panel-control-4" aria-label="例如: -1, -2+3i"
              type="text"
              value={poles}
              onChange={(e) => setPoles(e.target.value)}
              placeholder="例如: -1, -2+3i"
              className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="function-input-panel-k-5" className="mb-1 block text-xs text-slate-400">增益 K</label>
            <input id="function-input-panel-k-5" aria-label="例如: 1"
              type="text"
              value={gain}
              onChange={(e) => setGain(e.target.value)}
              placeholder="例如: 1"
              className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* 表达式输入 */}
      {inputFormat === 'expr' && (
        <div>
          <label htmlFor="function-input-panel-s-6" className="mb-1 block text-xs text-slate-400">函数表达式 (变量为s)</label>
          <input id="function-input-panel-s-6" aria-label="例如: (s^2-1)/(s+1)"
            type="text"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="例如: (s^2-1)/(s+1)"
            className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
      )}

      {/* 错误提示 */}
      {parseError && (
        <p className="mt-2 text-xs text-red-400">{parseError}</p>
      )}

      {/* 解析按钮 */}
      <button type="button"
        onClick={handleParse}
        className="mt-4 w-full rounded-lg bg-blue-500/20 px-4 py-2 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/30"
      >
        解析函数
      </button>
    </div>
  );
}

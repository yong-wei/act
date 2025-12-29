'use client';

/**
 * EthicsTheater - 伦理剧场（中央场景区）
 */

import { Play, RotateCcw, AlertTriangle, CheckCircle } from 'lucide-react';
import type { EthicsScenarioData, DecisionOption } from '../ethics-sandbox';

interface EthicsTheaterProps {
  scenario: EthicsScenarioData;
  timeRemaining: number;
  isTimerRunning: boolean;
  decisionMade: boolean;
  decisionOptions: DecisionOption[];
  selectedOption: DecisionOption | null;
  infoFog: number;
  onStartDecision: () => void;
  onSubmitDecision: (option: DecisionOption) => void;
  onReset: () => void;
}

export function EthicsTheater({
  scenario,
  timeRemaining,
  isTimerRunning,
  decisionMade,
  decisionOptions,
  selectedOption,
  infoFog,
  onStartDecision,
  onSubmitDecision,
  onReset,
}: EthicsTheaterProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (timeRemaining <= 10) return 'text-red-500 animate-pulse';
    if (timeRemaining <= 30) return 'text-amber-500';
    return 'text-emerald-400';
  };

  return (
    <div className="flex-1 p-6">
      {/* 场景标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-emerald-400">{scenario.title}</h1>
        <p className="mt-2 text-slate-400">{scenario.description}</p>
      </div>

      {/* 主场景区域 */}
      <div
        className="relative mb-6 overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-800 to-slate-900"
        style={{ minHeight: '300px' }}
      >
        {/* 场景背景 - 可以后续替换为 R3F 3D 场景 */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{
            backgroundImage: `url('/images/arctic-scene.jpg')`,
            filter: `blur(${infoFog / 10}px)`,
          }}
        />

        {/* 信息迷雾遮罩 */}
        {infoFog > 0 && (
          <div
            className="absolute inset-0 bg-gradient-to-b from-slate-900/0 to-slate-900/80"
            style={{ opacity: infoFog / 100 }}
          />
        )}

        {/* 中央内容 */}
        <div className="relative z-10 flex h-full min-h-[300px] flex-col items-center justify-center p-8 text-center">
          {!isTimerRunning && !decisionMade && (
            <>
              <div className="mb-6 text-6xl">🚢</div>
              <h2 className="mb-4 text-xl font-medium text-slate-200">准备进入决策场景</h2>
              <p className="mb-6 max-w-md text-sm text-slate-400">
                点击下方按钮开始倒计时，在规定时间内做出您的伦理决策。
              </p>
              <button
                onClick={onStartDecision}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white transition-colors hover:bg-emerald-500"
              >
                <Play className="h-5 w-5" />
                开始决策
              </button>
            </>
          )}

          {isTimerRunning && !decisionMade && (
            <>
              {/* 倒计时 */}
              <div className="mb-8">
                <div className={`text-6xl font-bold tabular-nums ${getTimerColor()}`}>
                  {formatTime(timeRemaining)}
                </div>
                <div className="mt-2 text-sm text-slate-400">剩余决策时间</div>
              </div>

              {/* 警告提示 */}
              {timeRemaining <= 30 && (
                <div className="mb-6 flex items-center gap-2 rounded-lg bg-red-500/20 px-4 py-2 text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                  <span>时间紧迫！请尽快做出决策</span>
                </div>
              )}
            </>
          )}

          {decisionMade && selectedOption && (
            <>
              <CheckCircle className="mb-4 h-16 w-16 text-emerald-400" />
              <h2 className="mb-2 text-xl font-medium text-emerald-400">决策已提交</h2>
              <p className="mb-4 text-slate-300">您选择了：{selectedOption.label}</p>
              <button
                onClick={onReset}
                className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-slate-300 transition-colors hover:bg-slate-700"
              >
                <RotateCcw className="h-4 w-4" />
                重新开始
              </button>
            </>
          )}
        </div>
      </div>

      {/* 决策选项 */}
      {isTimerRunning && !decisionMade && (
        <div className="grid gap-4 md:grid-cols-3">
          {decisionOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => onSubmitDecision(option)}
              className="group rounded-xl border border-slate-600 bg-slate-800/50 p-4 text-left transition-all hover:border-emerald-500/50 hover:bg-emerald-500/10"
            >
              <div className="mb-2 text-lg font-medium text-slate-200 group-hover:text-emerald-400">
                {option.label}
              </div>
              <p className="text-sm text-slate-400">{option.description}</p>

              {/* 预估代价预览 */}
              <div className="mt-3 flex gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    option.consequences.humanCost > 50 ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                  }`}
                >
                  人本 {option.consequences.humanCost}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    option.consequences.ecologicalCost > 50 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                  }`}
                >
                  生态 {option.consequences.ecologicalCost}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

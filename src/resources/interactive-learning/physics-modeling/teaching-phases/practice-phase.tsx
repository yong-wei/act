'use client';

/**
 * 阶段五：实战演练
 * Phase 5: Practice & AI Feedback
 *
 * 时长: 75-90 分钟
 * 目标: 独立完成机理建模，理解非线性与线性化
 */

import { useState, useCallback } from 'react';
import { Target, Send, Loader2, CheckCircle2, XCircle, Lightbulb } from 'lucide-react';
import { SCENARIOS } from '../types';

interface PracticePhaseProps {
  practiceAnswer: string;
  onAnswerChange: (answer: string) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  aiFeedback?: string;
  isCorrect?: boolean;
  onComplete: () => void;
}

export function PracticePhase({
  practiceAnswer,
  onAnswerChange,
  onSubmit,
  isSubmitting,
  aiFeedback,
  isCorrect,
  onComplete,
}: PracticePhaseProps) {
  const [showHint, setShowHint] = useState(false);
  const scenario = SCENARIOS.missileLauncher;

  const handleSubmit = useCallback(() => {
    if (practiceAnswer.trim()) {
      onSubmit();
    }
  }, [practiceAnswer, onSubmit]);

  return (
    <div className="flex h-full flex-col">
      {/* 标题区 */}
      <div className="border-b border-slate-800 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/20 text-red-500">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">阶段五：我是总设计师</h2>
              <p className="text-sm text-slate-400">
                独立建立微分方程，挑战非线性系统
              </p>
            </div>
          </div>

          {isCorrect && (
            <button
              onClick={onComplete}
              className="flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-400"
            >
              完成课程 🎉
            </button>
          )}
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* 挑战任务 */}
          <div className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800 p-6">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-red-500/20 text-red-400">
                🚀
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{scenario.name}</h3>
                <p className="mt-1 text-sm text-slate-400">{scenario.description}</p>
              </div>
            </div>

            {/* 系统描述 */}
            <div className="rounded-xl bg-slate-800/50 p-4">
              <h4 className="mb-2 text-sm font-medium text-slate-300">系统描述</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  发射架绕水平轴旋转，角度为 θ
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  转动惯量为 J，摩擦力矩系数为 f
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  重力会产生力矩（质心到轴距离为 l，质量为 m）
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  驱动力矩为 T
                </li>
              </ul>
            </div>

            {/* 挑战提示 */}
            <div className="mt-4 rounded-xl bg-amber-500/10 p-3">
              <div className="flex items-start gap-2">
                <span className="text-amber-500">⚠️</span>
                <p className="text-sm text-amber-500/80">
                  <strong>挑战：</strong>
                  考虑重力影响，方程是非线性的（含 sinθ 项）。
                  尝试进行小偏差线性化 (sinθ ≈ θ)。
                </p>
              </div>
            </div>
          </div>

          {/* 方程输入区 */}
          <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-6">
            <h4 className="mb-4 text-sm font-medium text-slate-300">
              请写出系统的微分方程（支持 LaTeX 格式）
            </h4>

            <div className="space-y-4">
              {/* 输入框 */}
              <div className="relative">
                <textarea
                  value={practiceAnswer}
                  onChange={(e) => onAnswerChange(e.target.value)}
                  placeholder="例如: J\ddot{\theta} + f\dot{\theta} + mgl\sin\theta = T"
                  className="h-32 w-full resize-none rounded-xl border border-slate-700 bg-slate-800 p-4 font-mono text-sm text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* 提交按钮 */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowHint(!showHint)}
                  className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
                >
                  <Lightbulb className="h-4 w-4" />
                  {showHint ? '隐藏提示' : '需要提示？'}
                </button>

                <button
                  onClick={handleSubmit}
                  disabled={!practiceAnswer.trim() || isSubmitting}
                  className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-colors ${
                    practiceAnswer.trim() && !isSubmitting
                      ? 'bg-amber-500 text-slate-900 hover:bg-amber-400'
                      : 'cursor-not-allowed bg-slate-700 text-slate-500'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      AI 批改中...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      提交答案
                    </>
                  )}
                </button>
              </div>

              {/* 提示展开 */}
              {showHint && (
                <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                  <h5 className="mb-2 text-xs font-medium text-slate-400">建模提示</h5>
                  <ul className="space-y-1.5">
                    {scenario.hints.map((hint, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-xs text-slate-500"
                      >
                        <span className="text-amber-500">{index + 1}.</span>
                        {hint}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* AI 反馈 */}
          {aiFeedback && (
            <div
              className={`rounded-2xl border p-6 ${
                isCorrect
                  ? 'border-green-500/30 bg-green-500/10'
                  : 'border-blue-500/30 bg-blue-500/10'
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                    isCorrect ? 'bg-green-500/20' : 'bg-blue-500/20'
                  }`}
                >
                  {isCorrect ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <span className="text-xl">🤖</span>
                  )}
                </div>
                <div>
                  <p
                    className={`text-sm font-medium ${
                      isCorrect ? 'text-green-400' : 'text-blue-400'
                    }`}
                  >
                    {isCorrect ? '完全正确！' : 'AI 助教反馈'}
                  </p>
                  <p className="mt-2 text-sm text-slate-300 whitespace-pre-wrap">
                    {aiFeedback}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

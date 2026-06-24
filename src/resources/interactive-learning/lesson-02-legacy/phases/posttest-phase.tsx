'use client';

/**
 * Post-assessment Phase: 后测
 * 实战挑战 - 导弹发射架建模
 */

import { useState } from 'react';
import { Target, Send, Loader2, CheckCircle2, Lightbulb, ChevronRight, BookOpen } from 'lucide-react';
import { KnowledgeSidebar } from '../../shared/knowledge-card';
import { useKnowledgeCard } from '../../shared/knowledge-cards-data';

interface PosttestPhaseProps {
  answer: string;
  feedback: string;
  isCorrect: boolean | null;
  isLoading: boolean;
  onAnswerChange: (answer: string) => void;
  onSubmit: () => void;
  onComplete: () => void;
}

export function PosttestPhase({
  answer,
  feedback,
  isCorrect,
  isLoading,
  onAnswerChange,
  onSubmit,
  onComplete,
}: PosttestPhaseProps) {
  const [showHint, setShowHint] = useState(false);
  const [showKnowledgeCard, setShowKnowledgeCard] = useState(false);

  // 获取知识卡片数据
  const {
    card: knowledgeCard,
    isLoading: isKnowledgeCardLoading,
    error: knowledgeCardError,
  } = useKnowledgeCard('小偏差线性化_2_277afa67');

  const hints = [
    '转动惯量 J 对应惯性项 J·θ̈',
    '摩擦力矩产生阻尼项 f·θ̇',
    '重力矩是非线性的：mgl·sinθ',
    '小偏差线性化：sinθ ≈ θ',
  ];

  return (
    <div className="flex h-full flex-col">
      {/* 标题区 */}
      <div className="border-b border-slate-800 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/20 text-violet-500">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">实战挑战</h2>
              <p className="text-sm text-slate-400">
                导弹发射架俯仰系统建模
              </p>
            </div>
          </div>

          {isCorrect && (
            <button type="button"
              onClick={onComplete}
              className="flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-400"
            >
              进入总结
              <ChevronRight className="h-4 w-4" />
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
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-violet-500/20 text-violet-400">
                🚀
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">导弹发射架俯仰系统</h3>
                <p className="mt-1 text-sm text-slate-400">
                  为舰载导弹发射架的俯仰运动建立微分方程
                </p>
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
            <div className="mt-4 rounded-xl bg-violet-500/10 p-3">
              <div className="flex items-start gap-2">
                <span className="text-violet-500">⚠️</span>
                <p className="text-sm text-violet-400">
                  <strong>挑战：</strong>
                  除了惯性、阻尼，还有一个力在阻碍它起竖，是什么？
                  考虑重力影响，方程是非线性的（含 sinθ 项）。
                </p>
              </div>
            </div>

            {/* 知识卡片入口 */}
            <div className="mt-3 flex justify-end">
              <button type="button"
                onClick={() => setShowKnowledgeCard(!showKnowledgeCard)}
                disabled={!knowledgeCard}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-colors ${
                  knowledgeCard
                    ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                    : 'cursor-not-allowed bg-slate-800 text-slate-500'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" />
                {knowledgeCard
                  ? '非线性线性化'
                  : isKnowledgeCardLoading
                    ? '知识卡片加载中...'
                    : knowledgeCardError || '知识卡片暂不可用'}
              </button>
            </div>

            {/* 发射架图示占位 */}
            <div className="mt-4 flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/50">
              <div className="text-center">
                <div className="text-4xl">🚀</div>
                <p className="mt-2 text-xs text-slate-500">导弹发射架示意图</p>
                <p className="text-xs text-slate-600">(倒立摆模型)</p>
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
                <textarea aria-label="例如: J\ddot{\theta} + f\dot{\theta} + mgl\sin\theta = T"
                  value={answer}
                  onChange={(e) => onAnswerChange(e.target.value)}
                  placeholder="例如: J\ddot{\theta} + f\dot{\theta} + mgl\sin\theta = T"
                  className="h-32 w-full resize-none rounded-xl border border-slate-700 bg-slate-800 p-4 font-mono text-sm text-slate-200 placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              {/* 快捷输入 */}
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-slate-500">快捷输入：</span>
                {['\\ddot{\\theta}', '\\dot{\\theta}', '\\sin\\theta', 'mgl'].map(
                  (symbol) => (
                    <button type="button"
                      key={symbol}
                      onClick={() => onAnswerChange(answer + symbol)}
                      className="rounded bg-slate-700 px-2 py-1 font-mono text-xs text-slate-300 hover:bg-slate-600"
                    >
                      {symbol}
                    </button>
                  )
                )}
              </div>

              {/* 提交按钮 */}
              <div className="flex items-center justify-between">
                <button type="button"
                  onClick={() => setShowHint(!showHint)}
                  className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
                >
                  <Lightbulb className="h-4 w-4" />
                  {showHint ? '隐藏提示' : '需要提示？'}
                </button>

                <button type="button"
                  onClick={onSubmit}
                  disabled={!answer.trim() || isLoading}
                  className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-colors ${
                    answer.trim() && !isLoading
                      ? 'bg-violet-500 text-white hover:bg-violet-400'
                      : 'cursor-not-allowed bg-slate-700 text-slate-500'
                  }`}
                >
                  {isLoading ? (
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
                    {hints.map((hint, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-xs text-slate-500"
                      >
                        <span className="text-violet-500">{index + 1}.</span>
                        {hint}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* AI 反馈 */}
          {feedback && (
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
                    <span className="text-xl">👷</span>
                  )}
                </div>
                <div>
                  <p
                    className={`text-sm font-medium ${
                      isCorrect ? 'text-green-400' : 'text-blue-400'
                    }`}
                  >
                    {isCorrect ? '完全正确！' : '总工反馈'}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
                    {feedback}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 知识卡片侧边栏 */}
      {knowledgeCard && (
        <KnowledgeSidebar
          node={knowledgeCard}
          isOpen={showKnowledgeCard}
          onClose={() => setShowKnowledgeCard(false)}
          position="right"
        />
      )}
    </div>
  );
}

'use client';

/**
 * Objective Phase: 学习目标
 * 本次任务清单
 */

import { ChevronRight, Lock, CheckCircle2 } from 'lucide-react';
import { LEARNING_OBJECTIVES } from '../types';

interface ObjectivePhaseProps {
  unlockedObjectives: string[];
  onComplete: () => void;
}

export function ObjectivePhase({
  unlockedObjectives,
  onComplete,
}: ObjectivePhaseProps) {
  return (
    <div className="flex h-full flex-col">
      {/* 蓝图风格背景 */}
      <div className="relative flex-1 overflow-y-auto bg-gradient-to-br from-slate-900 via-blue-950/20 to-slate-900">
        {/* 网格背景 */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(rgba(59, 130, 246, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(59, 130, 246, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative mx-auto max-w-2xl px-6 py-12">
          {/* 标题 */}
          <div className="mb-8 text-center">
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-blue-400">
              Mission Briefing
            </div>
            <h2 className="text-3xl font-bold text-white">本次任务清单</h2>
            <p className="mt-2 text-slate-400">完成以下挑战，解锁对应勋章</p>
          </div>

          {/* 目标卡片 */}
          <div className="space-y-4">
            {LEARNING_OBJECTIVES.map((objective, index) => {
              const isUnlocked = unlockedObjectives.includes(objective.id);

              return (
                <div
                  key={objective.id}
                  className={`relative overflow-hidden rounded-xl border transition-all ${
                    isUnlocked
                      ? 'border-green-500/50 bg-green-500/10'
                      : 'border-slate-700 bg-slate-800/50'
                  }`}
                >
                  {/* 序号 */}
                  <div className="absolute left-0 top-0 flex h-full w-12 items-center justify-center border-r border-slate-700/50 bg-slate-800/50">
                    <span
                      className={`text-2xl font-bold ${
                        isUnlocked ? 'text-green-400' : 'text-slate-600'
                      }`}
                    >
                      {index + 1}
                    </span>
                  </div>

                  <div className="ml-12 flex items-center gap-4 p-4">
                    {/* 勋章图标 */}
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-xl text-2xl ${
                        isUnlocked
                          ? 'bg-green-500/20'
                          : 'bg-slate-700/50'
                      }`}
                    >
                      {isUnlocked ? objective.badge : <Lock className="h-6 w-6 text-slate-500" />}
                    </div>

                    {/* 内容 */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3
                          className={`font-semibold ${
                            isUnlocked ? 'text-green-400' : 'text-white'
                          }`}
                        >
                          {objective.title}
                        </h3>
                        {isUnlocked && (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-400">
                        {objective.description}
                      </p>
                    </div>

                    {/* 状态 */}
                    <div
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        isUnlocked
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-slate-700 text-slate-500'
                      }`}
                    >
                      {isUnlocked ? '已解锁' : '待解锁'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 提示 */}
          <div className="mt-8 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
            <p className="text-center text-sm text-blue-300">
              完成各阶段学习任务，自动解锁对应勋章。全部解锁即为课程通关！
            </p>
          </div>
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="border-t border-slate-800 bg-slate-900/50 p-4">
        <div className="mx-auto flex max-w-2xl justify-end">
          <button
            onClick={onComplete}
            className="flex items-center gap-2 rounded-lg bg-blue-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-400"
          >
            开始点检
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

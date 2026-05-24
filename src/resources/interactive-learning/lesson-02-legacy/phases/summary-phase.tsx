'use client';

/**
 * Summary Phase: 总结
 * 万物皆数 - 知识星空
 */

import { useMemo } from 'react';
import { Star, Trophy, Download, Home, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { LEARNING_OBJECTIVES, KNOWLEDGE_GRAPH_NODES } from '../types';

interface SummaryPhaseProps {
  unlockedObjectives: string[];
  pretestScore: number;
}

export function SummaryPhase({
  unlockedObjectives,
  pretestScore,
}: SummaryPhaseProps) {
  // 计算成就
  const achievements = useMemo(() => {
    const total = LEARNING_OBJECTIVES.length;
    const unlocked = unlockedObjectives.length;
    return {
      total,
      unlocked,
      percentage: Math.round((unlocked / total) * 100),
    };
  }, [unlockedObjectives]);

  // 核心公式卡片
  const coreFormulas = [
    {
      id: 'mechanical',
      title: '机械系统',
      equation: 'm·ẍ + f·ẋ + k·x = F',
      description: '弹簧-质量-阻尼模型',
    },
    {
      id: 'electrical',
      title: '电路系统',
      equation: 'L·q̈ + R·q̇ + (1/C)·q = u',
      description: 'RLC 串联电路',
    },
    {
      id: 'unified',
      title: '通用二阶系统',
      equation: 'a₂·q̈ + a₁·q̇ + a₀·q = f(t)',
      description: '广义坐标表示',
    },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* 标题区 */}
      <div className="border-b border-slate-800 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-500/20 text-slate-400">
              <Star className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">万物皆数</h2>
              <p className="text-sm text-slate-400">
                课程总结 - 知识星空
              </p>
            </div>
          </div>

          <Link
            href="/interactive-learning"
            className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-600"
          >
            <Home className="h-4 w-4" />
            返回首页
          </Link>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl space-y-8">
          {/* 成就总结 */}
          <div className="rounded-2xl border border-slate-700 bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/20">
                <Trophy className="h-8 w-8 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white">课程完成！</h3>
                <p className="text-sm text-slate-400">
                  你已解锁 {achievements.unlocked}/{achievements.total} 个勋章
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-amber-400">
                  {achievements.percentage}%
                </div>
                <div className="text-xs text-slate-500">完成度</div>
              </div>
            </div>

            {/* 勋章展示 */}
            <div className="mt-4 flex gap-3">
              {LEARNING_OBJECTIVES.map((obj) => {
                const isUnlocked = unlockedObjectives.includes(obj.id);
                return (
                  <div
                    key={obj.id}
                    className={`flex flex-1 flex-col items-center rounded-xl p-3 ${
                      isUnlocked
                        ? 'bg-green-500/10 border border-green-500/30'
                        : 'bg-slate-800/50 border border-slate-700'
                    }`}
                  >
                    <span className="text-2xl">{isUnlocked ? obj.badge : '🔒'}</span>
                    <span
                      className={`mt-1 text-xs ${
                        isUnlocked ? 'text-green-400' : 'text-slate-500'
                      }`}
                    >
                      {obj.title}
                    </span>
                    {isUnlocked && (
                      <CheckCircle2 className="mt-1 h-3 w-3 text-green-500" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 知识图谱 */}
          <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">知识星空</h3>
            <p className="mb-4 text-sm text-slate-400">
              「微分方程」节点已点亮，向外连接到后续课程
            </p>

            {/* 简化的知识图谱展示 */}
            <div className="relative flex items-center justify-center py-8">
              {/* 中心节点 */}
              <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full border-2 border-amber-500 bg-amber-500/20 shadow-lg shadow-amber-500/20">
                <div className="text-center">
                  <div className="text-xs text-amber-400">今日主题</div>
                  <div className="text-sm font-bold text-white">微分方程</div>
                </div>
              </div>

              {/* 连接线和子节点 */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                {/* 传递函数 */}
                <div
                  className="absolute flex h-16 w-16 items-center justify-center rounded-full border border-slate-600 bg-slate-800"
                  style={{ left: '100px', top: '-60px' }}
                >
                  <div className="text-center">
                    <div className="text-[10px] text-slate-400">下一课</div>
                    <div className="text-xs text-slate-300">传递函数</div>
                  </div>
                </div>

                {/* 状态空间 */}
                <div
                  className="absolute flex h-16 w-16 items-center justify-center rounded-full border border-slate-600 bg-slate-800"
                  style={{ left: '100px', top: '20px' }}
                >
                  <div className="text-center">
                    <div className="text-[10px] text-slate-400">进阶</div>
                    <div className="text-xs text-slate-300">状态空间</div>
                  </div>
                </div>

                {/* 连接线 */}
                <svg
                  className="absolute"
                  style={{ left: '48px', top: '-20px', width: '60px', height: '80px' }}
                >
                  <line
                    x1="0"
                    y1="40"
                    x2="52"
                    y2="10"
                    stroke="#f59e0b"
                    strokeWidth="2"
                    strokeDasharray="4"
                  />
                  <line
                    x1="0"
                    y1="40"
                    x2="52"
                    y2="60"
                    stroke="#f59e0b"
                    strokeWidth="2"
                    strokeDasharray="4"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* 核心公式卡片 */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">今日核心公式</h3>
              <button className="flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-800">
                <Download className="h-3 w-3" />
                保存卡片
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {coreFormulas.map((formula) => (
                <div
                  key={formula.id}
                  className="rounded-xl border border-slate-700 bg-slate-800/50 p-4"
                >
                  <div className="mb-2 text-xs text-slate-400">{formula.title}</div>
                  <div className="mb-2 font-mono text-lg text-white">
                    {formula.equation}
                  </div>
                  <div className="text-xs text-slate-500">{formula.description}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 学习数据 */}
          <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-4">
            <div className="flex items-center justify-between text-sm">
              <div className="text-slate-400">前测成绩</div>
              <div className="font-mono text-white">{pretestScore}%</div>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <div className="text-slate-400">课程时长</div>
              <div className="font-mono text-white">约 90 分钟</div>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <div className="text-slate-400">建议复习</div>
              <div className="text-slate-300">牛顿运动定律、KVL</div>
            </div>
          </div>

          {/* 下一步建议 */}
          <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-6">
            <h3 className="mb-2 font-semibold text-blue-400">下一步学习建议</h3>
            <p className="text-sm text-slate-300">
              掌握了微分方程建模后，下一课我们将学习如何用<strong className="text-white">拉普拉斯变换</strong>
              将微分方程转换为<strong className="text-white">传递函数</strong>，
              这是频域分析的基础。
            </p>
            <Link
              href="/interactive-learning/courses/unit-2-1-modeling-language"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-400"
            >
              预览下一课
              <Star className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

/**
 * EducationalPanel - 教育提示面板
 *
 * 显示当前关卡的控制理论相关教育提示
 */

import { memo } from 'react';
import { X, Lightbulb, BookOpen } from 'lucide-react';

interface EducationalPanelProps {
  /** 教育提示文本 */
  hint: string;
  /** 关卡名称 */
  levelName: string;
  /** 关闭回调 */
  onClose: () => void;
}

/**
 * 控制理论概念映射
 */
const THEORY_CONCEPTS = [
  {
    game: '格子容量',
    theory: '边界条件',
    description: '角落、边缘、中心格子的容量不同，类似于控制系统中边界条件对系统行为的影响。',
  },
  {
    game: '连锁反应',
    theory: '级联效应 / 正反馈',
    description: '一个格子的爆炸可能触发相邻格子的爆炸，形成连锁反应。这是正反馈和级联失效的典型表现。',
  },
  {
    game: '步数限制',
    theory: '控制输入约束',
    description: '有限的操作次数代表了实际控制系统中的输入约束，需要在约束内优化控制策略。',
  },
  {
    game: '临界状态',
    theory: '分岔点 / 稳定性边界',
    description: '接近满载的格子处于临界状态，微小的扰动可能引发大规模变化，这是非线性系统分岔理论的核心概念。',
  },
  {
    game: '预测最优路径',
    theory: '模型预测控制 (MPC)',
    description: '通关需要预测多步后的状态，这与现代控制理论中的模型预测控制思想一致。',
  },
];

export const EducationalPanel = memo(function EducationalPanel({
  hint,
  levelName,
  onClose,
}: EducationalPanelProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative max-w-lg w-full mx-4 bg-slate-800 rounded-2xl border border-blue-500/30 overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 bg-blue-500/10 border-b border-blue-500/20">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white">学习提示</h2>
          </div>
          <button type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="关闭"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {/* 当前关卡提示 */}
        <div className="p-4 border-b border-slate-700">
          <div className="text-sm text-slate-400 mb-1">{levelName}</div>
          <p className="text-white leading-relaxed">{hint}</p>
        </div>

        {/* 概念映射 */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-medium text-slate-300">
              游戏机制 → 控制理论
            </h3>
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto">
            {THEORY_CONCEPTS.map((concept, index) => (
              <div
                key={index}
                className="p-3 bg-slate-700/50 rounded-lg border border-slate-600/50"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-300 rounded">
                    {concept.game}
                  </span>
                  <span className="text-slate-500">→</span>
                  <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-300 rounded">
                    {concept.theory}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {concept.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 底部 */}
        <div className="p-4 bg-slate-900/50 border-t border-slate-700">
          <button type="button"
            onClick={onClose}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
});

export default EducationalPanel;

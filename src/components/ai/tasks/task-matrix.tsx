'use client';

/**
 * TaskMatrix - 任务矩阵（中央任务卡片网格）
 */

import { BookOpen, Beaker, Scale, Lock, CheckCircle, Play, Award } from 'lucide-react';
import type { TaskData, AchievementData } from '../personal-learning-center';

interface TaskMatrixProps {
  tasks: TaskData[];
  achievements: AchievementData[];
  selectedTask: TaskData | null;
  onTaskSelect: (task: TaskData | null) => void;
}

const categoryIcons = {
  theory: BookOpen,
  simulation: Beaker,
  ethics: Scale,
};

const categoryColors = {
  theory: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  simulation: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
  ethics: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
};

const difficultyLabels = {
  easy: { label: '入门', color: 'text-green-400' },
  medium: { label: '进阶', color: 'text-amber-400' },
  hard: { label: '挑战', color: 'text-orange-400' },
  expert: { label: '专家', color: 'text-red-400' },
};

export function TaskMatrix({ tasks, achievements, selectedTask, onTaskSelect }: TaskMatrixProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* 成就墙 */}
      <div className="mb-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-medium text-amber-400">
          <Award className="h-5 w-5" />
          成就徽章
        </h3>
        <div className="flex flex-wrap gap-3">
          {achievements.map((achievement) => (
            <div
              key={achievement.id}
              className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2"
              title={achievement.description}
            >
              <span className="text-xl">{achievement.icon}</span>
              <span className="text-sm font-medium text-amber-400">{achievement.title}</span>
            </div>
          ))}
          {/* 待解锁占位 */}
          {[1, 2, 3].map((i) => (
            <div
              key={`locked-${i}`}
              className="flex items-center gap-2 rounded-full border border-slate-600 bg-slate-800/50 px-4 py-2 opacity-50"
            >
              <Lock className="h-4 w-4 text-slate-500" />
              <span className="text-sm text-slate-500">待解锁</span>
            </div>
          ))}
        </div>
      </div>

      {/* 任务网格 */}
      <div>
        <h3 className="mb-4 text-lg font-medium text-cyan-400">学习任务</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tasks.map((task) => {
            const Icon = categoryIcons[task.category];
            const colors = categoryColors[task.category];
            const difficulty = difficultyLabels[task.difficulty];
            const isLocked = task.status === 'locked';
            const isCompleted = task.status === 'completed';
            const isSelected = selectedTask?.id === task.id;

            return (
              <button
                key={task.id}
                onClick={() => !isLocked && onTaskSelect(isSelected ? null : task)}
                disabled={isLocked}
                className={`group relative rounded-xl border p-4 text-left transition-all ${
                  isLocked
                    ? 'cursor-not-allowed border-slate-700 bg-slate-800/30 opacity-50'
                    : isSelected
                      ? `${colors.border} ${colors.bg}`
                      : `border-slate-700 bg-slate-800/50 hover:${colors.border} hover:${colors.bg}`
                }`}
              >
                {/* 状态角标 */}
                {isCompleted && (
                  <div className="absolute right-3 top-3">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  </div>
                )}
                {isLocked && (
                  <div className="absolute right-3 top-3">
                    <Lock className="h-5 w-5 text-slate-500" />
                  </div>
                )}

                {/* 类别图标 */}
                <div
                  className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${colors.bg}`}
                >
                  <Icon className={`h-5 w-5 ${colors.text}`} />
                </div>

                {/* 任务信息 */}
                <div className="mb-2 font-medium text-slate-200">{task.title}</div>
                <div className="mb-3 flex items-center gap-2 text-xs">
                  <span className={difficulty.color}>{difficulty.label}</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-400">{task.estimatedTime}分钟</span>
                </div>

                {/* 进度条 */}
                {!isLocked && (
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isCompleted
                          ? 'bg-green-500'
                          : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                      }`}
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                )}

                {/* 悬停操作提示 */}
                {!isLocked && !isCompleted && task.status === 'available' && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-900/80 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="flex items-center gap-2 text-cyan-400">
                      <Play className="h-5 w-5" />
                      <span>开始学习</span>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

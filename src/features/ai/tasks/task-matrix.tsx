'use client';

import { Award, Beaker, BookOpen, CheckCircle, Lock, Play, Scale } from 'lucide-react';
import type { AiWorkshopEvidenceProjection } from '../ai-workshop-evidence';
import type { AchievementData, TaskData } from '../personal-learning-center';

interface TaskMatrixProps {
  tasks: TaskData[];
  achievements: AchievementData[];
  evidence: AiWorkshopEvidenceProjection;
  selectedTask: TaskData | null;
  onTaskSelect: (task: TaskData | null) => void;
}

const categoryIcons = { theory: BookOpen, simulation: Beaker, ethics: Scale };
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

export function TaskMatrix({ tasks, achievements, evidence, selectedTask, onTaskSelect }: TaskMatrixProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-medium text-amber-400">
          <Award className="h-5 w-5" />
          成就徽章
        </h3>
        {achievements.length === 0 ? (
          <div className="text-sm text-slate-400" data-ai-workshop-empty="achievements">
            {evidence.status === 'unavailable' ? '成就记录暂时不可用。' : '暂无已验证的成就记录。'}
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {achievements.map((achievement) => (
              <div key={achievement.id} className="flex items-center gap-2 rounded border border-amber-500/30 bg-amber-500/10 px-4 py-2" title={achievement.description}>
                <span className="text-xl">{achievement.icon}</span>
                <span className="text-sm font-medium text-amber-400">{achievement.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-4 text-lg font-medium text-cyan-400">学习任务</h3>
        {tasks.length === 0 ? (
          <div className="rounded border border-slate-700 bg-slate-800/30 p-5 text-sm text-slate-400" data-ai-workshop-empty="tasks">
            {evidence.status === 'unavailable' ? '学习任务暂时不可用，请稍后重试。' : '暂无已验证的学习任务记录。完成学习活动后，这里会显示真实任务状态。'}
          </div>
        ) : (
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
                  type="button"
                  key={task.id}
                  onClick={() => !isLocked && onTaskSelect(isSelected ? null : task)}
                  disabled={isLocked}
                  className={`group relative rounded border p-4 text-left transition-all ${isLocked ? 'cursor-not-allowed border-slate-700 bg-slate-800/30 opacity-50' : isSelected ? `${colors.border} ${colors.bg}` : 'border-slate-700 bg-slate-800/50 hover:border-cyan-500/40 hover:bg-cyan-500/5'}`}
                >
                  {isCompleted ? <CheckCircle className="absolute right-3 top-3 h-5 w-5 text-green-400" /> : null}
                  {isLocked ? <Lock className="absolute right-3 top-3 h-5 w-5 text-slate-500" /> : null}
                  <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded ${colors.bg}`}><Icon className={`h-5 w-5 ${colors.text}`} /></div>
                  <div className="mb-2 font-medium text-slate-200">{task.title}</div>
                  <div className="mb-3 flex items-center gap-2 text-xs"><span className={difficulty.color}>{difficulty.label}</span><span className="text-slate-500">·</span><span className="text-slate-400">{task.estimatedTime}分钟</span></div>
                  {!isLocked ? <div className="h-1.5 overflow-hidden rounded-full bg-slate-700"><div className={`h-full rounded-full transition-all duration-500 ${isCompleted ? 'bg-green-500' : 'bg-cyan-500'}`} style={{ width: `${task.progress}%` }} /></div> : null}
                  {!isLocked && !isCompleted && task.status === 'available' ? <div className="absolute inset-0 flex items-center justify-center rounded bg-slate-900/80 opacity-0 transition-opacity group-hover:opacity-100"><div className="flex items-center gap-2 text-cyan-400"><Play className="h-5 w-5" /><span>开始学习</span></div></div> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

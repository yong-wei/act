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
  theory: { bg: 'bg-muted', text: 'text-foreground', border: 'border-border' },
  simulation: { bg: 'bg-muted', text: 'text-foreground', border: 'border-border' },
  ethics: { bg: 'bg-muted', text: 'text-foreground', border: 'border-border' },
};
const difficultyLabels = {
  easy: { label: '入门', color: 'text-muted-foreground' },
  medium: { label: '进阶', color: 'text-muted-foreground' },
  hard: { label: '挑战', color: 'text-muted-foreground' },
  expert: { label: '专家', color: 'text-muted-foreground' },
};

export function TaskMatrix({ tasks, achievements, evidence, selectedTask, onTaskSelect }: TaskMatrixProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-medium text-foreground">
          <Award className="h-5 w-5" />
          成就徽章
        </h3>
        {achievements.length === 0 ? (
          <div className="text-sm text-muted-foreground" data-ai-workshop-empty="achievements">
            {evidence.status === 'unavailable' ? '成就记录暂时不可用。' : '暂无已验证的成就记录。'}
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {achievements.map((achievement) => (
              <div key={achievement.id} className="flex items-center gap-2 rounded border border-border bg-muted px-4 py-2" title={achievement.description}>
                <span className="text-xl">{achievement.icon}</span>
                <span className="text-sm font-medium text-foreground">{achievement.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-4 text-lg font-medium text-foreground">学习任务</h3>
        {tasks.length === 0 ? (
          <div className="rounded border border-border bg-muted p-5 text-sm text-muted-foreground" data-ai-workshop-empty="tasks">
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
                  className={`group relative rounded border p-4 text-left transition-all ${isLocked ? 'cursor-not-allowed border-border bg-muted opacity-50' : isSelected ? `${colors.border} ${colors.bg}` : 'border-border bg-background hover:border-primary hover:bg-accent'}`}
                >
                  {isCompleted ? <CheckCircle className="absolute right-3 top-3 h-5 w-5 text-foreground" /> : null}
                  {isLocked ? <Lock className="absolute right-3 top-3 h-5 w-5 text-muted-foreground" /> : null}
                  <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded ${colors.bg}`}><Icon className={`h-5 w-5 ${colors.text}`} /></div>
                  <div className="mb-2 font-medium text-foreground">{task.title}</div>
                  <div className="mb-3 flex items-center gap-2 text-xs"><span className={difficulty.color}>{difficulty.label}</span><span className="text-muted-foreground">·</span><span className="text-muted-foreground">{task.estimatedTime}分钟</span></div>
                  {!isLocked ? <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${task.progress}%` }} /></div> : null}
                  {!isLocked && !isCompleted && task.status === 'available' ? <div className="absolute inset-0 flex items-center justify-center rounded bg-card opacity-0 transition-opacity group-hover:opacity-100"><div className="flex items-center gap-2 text-foreground"><Play className="h-5 w-5" /><span>开始学习</span></div></div> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

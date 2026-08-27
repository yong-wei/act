'use client';

import { useState } from 'react';
import { ActionStatusPanel } from '@/components/platform/action-status';
import {
  buildAiAuditTaskState,
  buildReportFeedbackTaskCandidates,
  getAiAuditTaskContract,
  type AiTaskCandidate,
} from '@/lib/ai-task-boundary-contracts';
import type { AiWorkshopEvidenceProjection } from './ai-workshop-evidence';
import { LearningDashboard } from './dashboard/learning-dashboard';
import { LearningCompass } from './compass/learning-compass';
import { TaskMatrix } from './tasks/task-matrix';
import { ExperimentArchive } from './archive/experiment-archive';
import { JournalCarousel } from './journal/journal-carousel';

export interface MilestoneData {
  id: string;
  title: string;
  description?: string;
  order: number;
  status: 'PENDING' | 'CURRENT' | 'COMPLETED';
  completedAt?: Date;
}

export interface AchievementData {
  id: string;
  badgeType: string;
  title: string;
  description: string;
  icon: string;
  earnedAt: Date;
}

export interface TaskData {
  id: string;
  title: string;
  category: 'theory' | 'simulation' | 'ethics';
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  progress: number;
  estimatedTime: number;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
}

export interface ExperimentRecord {
  id: string;
  title: string;
  type: 'PID_TUNING' | 'ETHICS_SANDBOX' | 'ANOMALY_EVENT';
  score: number;
  createdAt: Date;
  parameters: Record<string, unknown>;
}

export interface JournalEntryData {
  id: string;
  title: string;
  content: string;
  entryType: 'ETHICS_DECISION' | 'CERTIFICATE' | 'COMPETITION' | 'TRAINING';
  grade?: string;
  createdAt: Date;
}

interface PersonalLearningCenterProps {
  evidence: AiWorkshopEvidenceProjection;
  milestones?: MilestoneData[];
  achievements?: AchievementData[];
  tasks?: TaskData[];
  experiments?: ExperimentRecord[];
  journals?: JournalEntryData[];
  userName?: string;
  taskIntent?: string;
  taskSource?: string;
  taskAssignment?: string;
  taskContextIntent?: string;
}

export function PersonalLearningCenter({
  evidence,
  milestones = [],
  achievements = [],
  tasks = [],
  experiments = [],
  journals = [],
  userName = '学习者',
  taskIntent,
  taskSource,
  taskAssignment,
  taskContextIntent,
}: PersonalLearningCenterProps) {
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  const [reportTaskSelection, setReportTaskSelection] = useState<{
    status: 'candidate' | 'adopted' | 'discarded' | 'pending-writeback';
    candidateId?: string;
  }>({ status: 'candidate' });
  const reportFeedbackCandidates = taskIntent === 'report-feedback'
    ? buildReportFeedbackTaskCandidates({
      source: taskSource,
      assignment: taskAssignment,
      intent: taskContextIntent ?? taskIntent,
    })
    : [];
  const reportTaskState = taskIntent === 'report-feedback'
    ? buildAiAuditTaskState({
      taskType: 'report-feedback',
      status: reportTaskSelection.status === 'discarded'
        ? 'blocked'
        : reportTaskSelection.status === 'candidate'
          ? 'pending'
          : 'succeeded',
      message: reportTaskSelection.status === 'candidate'
        ? '已根据报告反馈生成练习任务候选。'
        : reportTaskSelection.status === 'adopted'
          ? '练习任务候选已采用为本页预览。'
          : reportTaskSelection.status === 'pending-writeback'
            ? '练习任务候选已标记为待写回，本页尚未保存到学习任务。'
            : '练习任务候选已丢弃。',
      nextAction: reportTaskSelection.status === 'candidate' ? '选择采用、丢弃或标记待写回' : '返回报告反馈页复核状态',
      targetId: reportTaskSelection.candidateId ?? taskAssignment ?? taskSource,
    })
    : null;
  const reportTaskContract = taskIntent === 'report-feedback' ? getAiAuditTaskContract('report-feedback') : null;

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground" data-ai-task-focus-mode={taskIntent ? 'local-first' : undefined}>
      <LearningDashboard evidence={evidence} userName={userName} />
      {reportTaskState && reportTaskContract ? (
        <ReportFeedbackTaskPanel
          candidates={reportFeedbackCandidates}
          contract={reportTaskContract}
          state={reportTaskState}
          onAdopt={(candidateId) => setReportTaskSelection({ status: 'adopted', candidateId })}
          onDiscard={(candidateId) => setReportTaskSelection({ status: 'discarded', candidateId })}
          onMarkPendingWriteback={(candidateId) => setReportTaskSelection({ status: 'pending-writeback', candidateId })}
        />
      ) : null}
      <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto md:flex-row md:overflow-hidden">
        <LearningCompass milestones={milestones} evidence={evidence} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TaskMatrix tasks={tasks} achievements={achievements} evidence={evidence} selectedTask={selectedTask} onTaskSelect={setSelectedTask} />
          <JournalCarousel journals={journals} evidence={evidence} />
        </div>
        <ExperimentArchive experiments={experiments} evidence={evidence} />
      </div>
    </div>
  );
}

export default PersonalLearningCenter;

function ReportFeedbackTaskPanel({
  candidates,
  contract,
  state,
  onAdopt,
  onDiscard,
  onMarkPendingWriteback,
}: {
  candidates: AiTaskCandidate[];
  contract: ReturnType<typeof getAiAuditTaskContract>;
  state: ReturnType<typeof buildAiAuditTaskState>;
  onAdopt: (candidateId: string) => void;
  onDiscard: (candidateId: string) => void;
  onMarkPendingWriteback: (candidateId: string) => void;
}) {
  return (
    <section className="border-b border-border bg-card px-5 py-4" data-ai-task-boundary="report-feedback" data-task-workspace-zone="local-primary-input">
      <div className="grid w-full gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-3">
          <ActionStatusPanel state={state} />
          <div className="rounded border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
            任务：{contract.taskType} · 输出：{contract.outputTarget} · 写回：{contract.writebackBehavior}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {candidates.map((candidate) => (
            <article key={candidate.id} className="rounded border border-border bg-background p-3 text-sm">
              <div className="font-medium text-foreground">{candidate.title}</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{candidate.detail}</p>
              <div className="mt-2 rounded border border-border px-2 py-1 text-[11px] text-muted-foreground">
                来源：{candidate.source} · 任务：{candidate.assignment ?? 'report-feedback'} · 意图：{candidate.intent} · 输出：{candidate.outputTarget}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => onAdopt(candidate.id)} className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground" data-primary-task-input="ai-workshop-report-feedback">采用</button>
                <button type="button" onClick={() => onMarkPendingWriteback(candidate.id)} className="rounded border border-border px-2 py-1 text-xs text-foreground">标记待写回</button>
                <button type="button" onClick={() => onDiscard(candidate.id)} className="rounded border border-border px-2 py-1 text-xs text-muted-foreground">丢弃</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

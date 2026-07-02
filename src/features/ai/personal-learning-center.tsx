'use client';

/**
 * PersonalLearningCenter - AI 个人学习中心主组件
 *
 * 重构自 personal0318.html，基于学情画像的闭环成长体系
 */

import { useState } from 'react';
import { LearningDashboard } from './dashboard/learning-dashboard';
import { LearningCompass } from './compass/learning-compass';
import { TaskMatrix } from './tasks/task-matrix';
import { ExperimentArchive } from './archive/experiment-archive';
import { JournalCarousel } from './journal/journal-carousel';
import { ActionStatusPanel } from '@/components/platform/action-status';
import {
  buildAiAuditTaskState,
  buildReportFeedbackTaskCandidates,
  getAiAuditTaskContract,
  type AiTaskCandidate,
} from '@/lib/ai-task-boundary-contracts';

// 学习画像数据类型
export interface LearningProfileData {
  learningStyle: 'VISUAL' | 'TEXTUAL' | 'INTERACTIVE' | 'AUDITORY' | 'LOGICAL';
  cognitiveLevel: number; // 1-5
  fleetGroup: string;
  dailyStudyMinutes: number;
  experimentMinutes: number;
  ethicsMinutes: number;
  aiRecommendIndex: number; // 0-1
  unlockedShips: number;
  totalShips: number;
}

// 里程碑数据类型
export interface MilestoneData {
  id: string;
  title: string;
  description?: string;
  order: number;
  status: 'PENDING' | 'CURRENT' | 'COMPLETED';
  completedAt?: Date;
}

// 成就数据类型
export interface AchievementData {
  id: string;
  badgeType: string;
  title: string;
  description: string;
  icon: string;
  earnedAt: Date;
}

// 任务数据类型
export interface TaskData {
  id: string;
  title: string;
  category: 'theory' | 'simulation' | 'ethics';
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  progress: number;
  estimatedTime: number;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
}

// 实验记录类型
export interface ExperimentRecord {
  id: string;
  title: string;
  type: 'PID_TUNING' | 'ETHICS_SANDBOX' | 'ANOMALY_EVENT';
  score: number;
  createdAt: Date;
  parameters: Record<string, unknown>;
}

// 日志条目类型
export interface JournalEntryData {
  id: string;
  title: string;
  content: string;
  entryType: 'ETHICS_DECISION' | 'CERTIFICATE' | 'COMPETITION' | 'TRAINING';
  grade?: string;
  createdAt: Date;
}

// 示例数据
const sampleProfile: LearningProfileData = {
  learningStyle: 'VISUAL',
  cognitiveLevel: 3,
  fleetGroup: '智航舰队',
  dailyStudyMinutes: 120,
  experimentMinutes: 45,
  ethicsMinutes: 30,
  aiRecommendIndex: 0.85,
  unlockedShips: 12,
  totalShips: 36,
};

const sampleMilestones: MilestoneData[] = [
  { id: '1', title: '入门航标', description: '完成基础控制理论学习', order: 1, status: 'COMPLETED' },
  { id: '2', title: '理论航线', description: '掌握 PID 控制器原理', order: 2, status: 'COMPLETED' },
  { id: '3', title: '实践海域', description: '完成 5 次仿真实验', order: 3, status: 'CURRENT' },
  { id: '4', title: '伦理灯塔', description: '通过伦理决策考核', order: 4, status: 'PENDING' },
  { id: '5', title: '远航舰长', description: '获得全部能力认证', order: 5, status: 'PENDING' },
];

const sampleAchievements: AchievementData[] = [
  { id: '1', badgeType: 'fast_response', title: '快速响应', description: '仿真中首次达到稳定时间 < 10s', icon: '⚡', earnedAt: new Date() },
  { id: '2', badgeType: 'wave_conqueror', title: '波浪征服者', description: '在高海况下完成航向控制', icon: '🌊', earnedAt: new Date() },
  { id: '3', badgeType: 'precision', title: '精准舵手', description: '稳态误差 < 0.5°', icon: '🎯', earnedAt: new Date() },
];

const sampleTasks: TaskData[] = [
  { id: '1', title: 'PID 参数整定基础', category: 'theory', difficulty: 'easy', progress: 100, estimatedTime: 30, status: 'completed' },
  { id: '2', title: '船舶航向控制仿真', category: 'simulation', difficulty: 'medium', progress: 75, estimatedTime: 45, status: 'in_progress' },
  { id: '3', title: '北极航道伦理决策', category: 'ethics', difficulty: 'hard', progress: 0, estimatedTime: 60, status: 'available' },
  { id: '4', title: '动力定位系统设计', category: 'simulation', difficulty: 'expert', progress: 0, estimatedTime: 90, status: 'locked' },
];

const sampleExperiments: ExperimentRecord[] = [
  { id: '1', title: '驱逐舰航向控制 #1', type: 'PID_TUNING', score: 85, createdAt: new Date(), parameters: { kp: 1.2, ki: 0.1, kd: 0.5 } },
  { id: '2', title: '北极冰区避障决策', type: 'ETHICS_SANDBOX', score: 78, createdAt: new Date(), parameters: {} },
  { id: '3', title: '高海况稳定性测试', type: 'PID_TUNING', score: 92, createdAt: new Date(), parameters: { kp: 1.5, ki: 0.08, kd: 0.6 } },
];

const sampleJournals: JournalEntryData[] = [
  { id: '1', title: '北极航道伦理决策反思', content: '在紧急情况下，如何平衡安全与效率...', entryType: 'ETHICS_DECISION', grade: 'A', createdAt: new Date() },
  { id: '2', title: '船舶控制系统设计赛', content: '全国船舶控制系统设计大赛三等奖', entryType: 'COMPETITION', createdAt: new Date() },
  { id: '3', title: 'PID 控制器培训认证', content: '完成高级 PID 控制器调参培训', entryType: 'TRAINING', createdAt: new Date() },
];

interface PersonalLearningCenterProps {
  profile?: LearningProfileData;
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
  profile = sampleProfile,
  milestones = sampleMilestones,
  achievements = sampleAchievements,
  tasks = sampleTasks,
  experiments = sampleExperiments,
  journals = sampleJournals,
  userName = '智航学员',
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
    <div
      className="flex h-screen w-full flex-col overflow-hidden bg-[#0a2a43] text-slate-200"
      data-ai-task-focus-mode={taskIntent ? 'local-first' : undefined}
    >
      {/* 顶部仪表盘 */}
      <LearningDashboard profile={profile} userName={userName} />
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

      {/* 主内容区域 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧学海罗盘 */}
        <LearningCompass milestones={milestones} profile={profile} />

        {/* 中央任务矩阵 */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <TaskMatrix
            tasks={tasks}
            achievements={achievements}
            selectedTask={selectedTask}
            onTaskSelect={setSelectedTask}
          />

          {/* 底部日志轮播 */}
          <JournalCarousel journals={journals} />
        </div>

        {/* 右侧实验档案 */}
        <ExperimentArchive experiments={experiments} />
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
    <section
      className="border-b border-cyan-400/20 bg-slate-950/70 px-5 py-4"
      data-ai-task-boundary="report-feedback"
      data-task-workspace-zone="local-primary-input"
    >
      <div className="grid w-full gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-3">
          <ActionStatusPanel state={state} />
          <div className="rounded border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-300">
            任务：{contract.taskType} · 输出：{contract.outputTarget} · 写回：{contract.writebackBehavior}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {candidates.map((candidate) => (
            <article key={candidate.id} className="rounded border border-cyan-400/30 bg-cyan-500/10 p-3 text-sm">
              <div className="font-medium text-cyan-100">{candidate.title}</div>
              <p className="mt-1 text-xs leading-5 text-cyan-100/75">{candidate.detail}</p>
              <div className="mt-2 rounded border border-cyan-300/30 px-2 py-1 text-[11px] text-cyan-100/70">
                来源：{candidate.source} · 任务：{candidate.assignment ?? 'report-feedback'} · 意图：{candidate.intent} · 输出：{candidate.outputTarget}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onAdopt(candidate.id)}
                  className="rounded bg-cyan-500 px-2 py-1 text-xs text-slate-950"
                  data-primary-task-input="ai-workshop-report-feedback"
                >
                  采用
                </button>
                <button type="button" onClick={() => onMarkPendingWriteback(candidate.id)} className="rounded border border-cyan-300/60 px-2 py-1 text-xs text-cyan-100">
                  标记待写回
                </button>
                <button type="button" onClick={() => onDiscard(candidate.id)} className="rounded border border-slate-500 px-2 py-1 text-xs text-slate-300">
                  丢弃
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

'use client';

import Link from 'next/link';
import { AlertCircle, ArrowRight, CalendarClock, CheckCircle2, ClipboardList, RotateCcw } from 'lucide-react';
import {
  assignmentStateLabels,
  formatAssignmentDeadline,
  type StudentAssignmentSummary,
  type StudentAssignmentState,
} from './student-assignment-types';

export type AssignmentFilter = 'all' | 'open' | 'submitted' | 'reviewed';

const filterLabels: Record<AssignmentFilter, string> = {
  all: '全部',
  open: '待完成',
  submitted: '已提交',
  reviewed: '已批阅',
};

export function belongsToAssignmentFilter(state: StudentAssignmentState, filter: AssignmentFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'open') return ['NOT_STARTED', 'IN_PROGRESS', 'RESUBMISSION_REQUIRED', 'OVERDUE'].includes(state);
  if (filter === 'reviewed') return state === 'REVIEWED';
  return ['SUBMITTED', 'PARSING', 'AWAITING_REVIEW', 'IN_REVIEW', 'PARTIAL_GRADING_FAILURE', 'AWAITING_TEACHER_CONFIRMATION'].includes(state);
}

export function studentAssignmentHref(assignment: Pick<StudentAssignmentSummary, 'id' | 'revisionId' | 'historicalOnly'>): string {
  const path = `/missions/assignments/${encodeURIComponent(assignment.id)}`;
  return assignment.historicalOnly
    ? `${path}?revisionId=${encodeURIComponent(assignment.revisionId)}`
    : path;
}

export function StudentAssignmentList({
  assignments,
  filter,
  onFilterChange,
}: {
  assignments: StudentAssignmentSummary[];
  filter: AssignmentFilter;
  onFilterChange: (filter: AssignmentFilter) => void;
}) {
  const visible = assignments.filter((assignment) => belongsToAssignmentFilter(assignment.state, filter));

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2" aria-label="主线作业筛选">
        {(Object.keys(filterLabels) as AssignmentFilter[]).map((item) => {
          const count = assignments.filter((assignment) => belongsToAssignmentFilter(assignment.state, item)).length;
          return (
            <button
              key={item}
              type="button"
              aria-pressed={filter === item}
              onClick={() => onFilterChange(item)}
              className={filter === item
                ? 'rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground'
                : 'btn-ghost-themed rounded-full px-4 py-2 text-sm'}
            >
              {filterLabels[item]} <span aria-hidden="true">·</span> {count}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="surface-card px-6 py-14 text-center" data-assignment-state="filtered-empty">
          <ClipboardList className="mx-auto h-9 w-9 text-subtle" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold text-foreground">此筛选下没有作业</h2>
          <p className="mt-2 text-sm text-subtle">切换到“全部”查看其他状态的主线作业。</p>
          <button type="button" onClick={() => onFilterChange('all')} className="btn-ghost-themed mt-5 rounded-lg px-4 py-2 text-sm">
            查看全部
          </button>
        </div>
      ) : (
        <ul className="space-y-3" aria-label="主线作业列表">
          {visible.map((assignment) => (
            <li key={assignment.id}>
              <AssignmentRow assignment={assignment} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AssignmentRow({ assignment }: { assignment: StudentAssignmentSummary }) {
  const progress = assignment.requiredQuestionCount === 0
    ? 0
    : Math.round((assignment.submittedRequiredCount / assignment.requiredQuestionCount) * 100);
  const isBlocked = assignment.contextStatus === 'STALE';

  return (
    <article className="surface-card group p-4 transition hover:border-primary/35 sm:p-5" data-assignment-state={assignment.state}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border/70 bg-card/60 px-2.5 py-1 text-xs font-medium text-foreground">
              {assignmentStateLabels[assignment.state]}
            </span>
            {assignment.contextStatus === 'HISTORICAL' && (
              <span className="rounded-full bg-slate-500/10 px-2.5 py-1 text-xs text-subtle">历史提交</span>
            )}
            {assignment.state === 'RESUBMISSION_REQUIRED' && <RotateCcw className="h-4 w-4 text-amber-500" aria-hidden="true" />}
          </div>
          <h2 className="mt-3 truncate text-base font-semibold text-foreground sm:text-lg">{assignment.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-subtle">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
              截止 {formatAssignmentDeadline(assignment.dueAt)}
            </span>
            <span>{assignment.submittedRequiredCount}/{assignment.requiredQuestionCount} 题已提交</span>
          </div>
        </div>
        <div className="w-full lg:w-52">
          <div className="flex items-center justify-between text-xs text-subtle">
            <span>必答进度</span><span>{progress}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-accent" role="progressbar" aria-label={`${assignment.title}必答进度`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="lg:w-36 lg:text-right">
          {isBlocked ? (
            <span className="inline-flex items-center gap-2 text-sm text-subtle"><AlertCircle className="h-4 w-4" />仅可查看</span>
          ) : (
            <Link href={studentAssignmentHref(assignment)} className="cta-primary inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm lg:w-auto">
              {assignment.historicalOnly ? '查看历史提交'
                : assignment.nextAction === 'start-answering' ? '开始作答'
                : assignment.nextAction === 'continue-answering' ? '继续作答'
                  : assignment.nextAction === 'resubmit-question' ? '处理重交'
                    : assignment.nextAction === 'view-feedback' ? '查看反馈'
                      : assignment.nextAction === 'contact-teacher' ? '查看详情'
                        : '查看记录'}
              {assignment.state === 'REVIEWED' ? <CheckCircle2 className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

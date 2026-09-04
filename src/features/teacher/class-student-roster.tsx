'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Database, GraduationCap, Loader2, Search, Trash2, UserPlus, Users, X } from 'lucide-react';

import type { TeacherClassInsightsPayload } from '@/app/api/teacher/classes/[classId]/insights/route';

export type RosterInsight = TeacherClassInsightsPayload['students'][number];
export type RosterRiskLevel = RosterInsight['riskLevel'];
export type RosterTrendDirection = RosterInsight['trendDirection'];

export interface RosterStudentInput {
  id: string;
  studentNumber: string | null;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
}

export interface ClassStudentRosterFilters {
  search: string;
  riskLevel: '' | RosterRiskLevel;
  trendDirection: '' | RosterTrendDirection;
  evidenceState: '' | 'missing';
  portraitAvailability: '' | 'unavailable';
}

export const EMPTY_ROSTER_FILTERS: ClassStudentRosterFilters = {
  search: '',
  riskLevel: '',
  trendDirection: '',
  evidenceState: '',
  portraitAvailability: '',
};

export function rosterFiltersActive(filters: ClassStudentRosterFilters): boolean {
  return filters.search.trim() !== ''
    || filters.riskLevel !== ''
    || filters.trendDirection !== ''
    || filters.evidenceState !== ''
    || filters.portraitAvailability !== '';
}

/** 稳定排序：有学号的学生按学号数值序在前，无学号学生按姓名在后，同键保持入参顺序。 */
export function compareRosterStudents(
  left: RosterStudentInput,
  right: RosterStudentInput,
): number {
  const leftNumber = left.studentNumber?.trim() ?? '';
  const rightNumber = right.studentNumber?.trim() ?? '';
  if (leftNumber && rightNumber) {
    return leftNumber.localeCompare(rightNumber, 'zh-CN', { numeric: true });
  }
  if (leftNumber) return -1;
  if (rightNumber) return 1;
  return (left.user.name ?? '').localeCompare(right.user.name ?? '', 'zh-CN');
}

export function isRosterPortraitUnavailable(insight: RosterInsight | undefined): boolean {
  return !insight || insight.availabilityReason !== 'available';
}

export function filterClassStudents<T extends RosterStudentInput>(
  students: T[],
  insightMap: Map<string, RosterInsight>,
  filters: ClassStudentRosterFilters,
): T[] {
  const search = filters.search.trim().toLowerCase();
  return students
    .filter((student) => {
      if (search) {
        const name = (student.user.name ?? '').toLowerCase();
        const number = (student.studentNumber ?? '').toLowerCase();
        if (!name.includes(search) && !number.includes(search)) return false;
      }
      const insight = insightMap.get(student.user.id);
      if (filters.riskLevel && (!insight || insight.riskLevel !== filters.riskLevel)) return false;
      if (filters.trendDirection && (!insight || insight.trendDirection !== filters.trendDirection)) return false;
      if (filters.evidenceState === 'missing' && (!insight || insight.evidenceStatus.state !== 'missing')) return false;
      if (filters.portraitAvailability === 'unavailable' && !isRosterPortraitUnavailable(insight)) return false;
      return true;
    })
    .sort(compareRosterStudents);
}

import { buildTeacherStudentInsightsHref, formatTeacherStudentDisplayId } from '@/features/teacher/teacher-insights';

type TeacherEvidenceStatus = TeacherClassInsightsPayload['students'][number]['evidenceStatus'];

export function formatAvailabilityReason(reason: string) {
  if (reason === 'available') return '可使用';
  if (reason === 'no-eligible-evidence') return '无合格证据';
  if (reason === 'no-evidence-after-revocation') return '支持证据已撤销';
  if (reason === 'migration-in-progress') return '累计画像迁移中';
  if (reason === 'processing-failed') return '累计画像处理失败';
  return '累计画像当前不可用';
}

function formatTeacherEvidenceState(status: TeacherEvidenceStatus): string {
  if (status.state === 'missing') return '缺少合格证据';
  if (status.confidence.level === 'low' || status.statusMarkers.includes('low-confidence')) {
    return '低置信';
  }
  return '可使用';
}

function getTeacherEvidenceStateChipClass(status: TeacherEvidenceStatus): string {
  const base = 'teacher-insight-chip';
  if (status.state === 'missing') return `${base} teacher-insight-chip-pending`;
  if (status.confidence.level === 'low' || status.statusMarkers.includes('low-confidence')) {
    return `${base} teacher-insight-chip-warning`;
  }
  return `${base} teacher-insight-chip-healthy`;
}

function formatTeacherEvidenceConfidence(status: TeacherEvidenceStatus): string {
  const levelLabel = status.confidence.level === 'high'
    ? '高'
    : status.confidence.level === 'medium'
      ? '中'
      : status.confidence.level === 'low'
        ? '低'
        : '无';
  return `${levelLabel}置信 · ${status.confidence.evidenceCount} 条证据`;
}

function formatTrendDirection(direction: TeacherClassInsightsPayload['students'][number]['trendDirection']) {
  if (direction === 'up') return '上升';
  if (direction === 'down') return '下降';
  if (direction === 'stable') return '稳定';
  return '尚无可比';
}

function formatEvidenceCutoff(value: string | null) {
  if (!value) return '不可用';
  return new Date(value).toLocaleString('zh-CN');
}

const ROSTER_FILTER_SELECT_CLASS = 'btn-ghost-themed rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none';

interface ClassStudentRosterProps {
  classId: string;
  classCode: string;
  students: RosterStudentInput[];
  insights: RosterInsight[] | null;
  removingStudentId: string | null;
  onRemoveStudent: (studentId: string, studentName: string) => void;
  onOpenAddStudents: () => void;
}

export function ClassStudentRoster({
  classId,
  classCode,
  students,
  insights,
  removingStudentId,
  onRemoveStudent,
  onOpenAddStudents,
}: ClassStudentRosterProps) {
  const [filters, setFilters] = useState<ClassStudentRosterFilters>(EMPTY_ROSTER_FILTERS);

  const studentInsightMap = useMemo(
    () => new Map((insights ?? []).map((student) => [student.id, student])),
    [insights],
  );
  const filteredStudents = useMemo(
    () => filterClassStudents(students, studentInsightMap, filters),
    [students, studentInsightMap, filters],
  );
  const hasActiveFilters = rosterFiltersActive(filters);

  const patchFilters = (patch: Partial<ClassStudentRosterFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  };

  return (
    <section id="students" className="surface-card p-6" data-teacher-class-student-roster>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-subtle" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">班级学生</h2>
            <p className="text-sm text-subtle">
              数据口径：当前累计画像（非历史诊断报告快照）。以学生画像、风险和成长档案为主视图。
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400" data-teacher-class-roster-count>
            命中 {filteredStudents.length} / {students.length} 人
          </span>
          <button type="button"
            onClick={onOpenAddStudents}
            className="flex items-center gap-1.5 rounded-lg border border-sky-500/50 px-3 py-1.5 text-sm text-sky-400 transition hover:bg-sky-500/10"
            aria-label="打开添加学生对话框"
          >
            <UserPlus className="h-4 w-4" />
            添加学生
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center" data-teacher-class-roster-filters>
        <div className="relative xl:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            aria-label="搜索学生姓名或学号"
            type="text"
            placeholder="搜索姓名或学号..."
            value={filters.search}
            onChange={(event) => patchFilters({ search: event.target.value })}
            className="w-full rounded-lg border border-border/70 bg-background/70 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-slate-500 focus:border-primary focus:outline-none"
          />
        </div>
        <select
          aria-label="按最后证据风险筛选学生"
          value={filters.riskLevel}
          onChange={(event) => patchFilters({ riskLevel: event.target.value as ClassStudentRosterFilters['riskLevel'] })}
          className={ROSTER_FILTER_SELECT_CLASS}
        >
          <option value="">全部风险</option>
          <option value="none">无风险</option>
          <option value="low">低风险</option>
          <option value="medium">中风险</option>
          <option value="high">高风险</option>
        </select>
        <select
          aria-label="按最后累计趋势筛选学生"
          value={filters.trendDirection}
          onChange={(event) => patchFilters({ trendDirection: event.target.value as ClassStudentRosterFilters['trendDirection'] })}
          className={ROSTER_FILTER_SELECT_CLASS}
        >
          <option value="">全部趋势</option>
          <option value="up">上升</option>
          <option value="stable">稳定</option>
          <option value="down">下降</option>
          <option value="not-comparable">尚无可比</option>
        </select>
        <select
          aria-label="按证据缺失筛选学生"
          value={filters.evidenceState}
          onChange={(event) => patchFilters({ evidenceState: event.target.value as ClassStudentRosterFilters['evidenceState'] })}
          className={ROSTER_FILTER_SELECT_CLASS}
        >
          <option value="">全部证据状态</option>
          <option value="missing">仅看证据缺失</option>
        </select>
        <select
          aria-label="按画像可用性筛选学生"
          value={filters.portraitAvailability}
          onChange={(event) => patchFilters({ portraitAvailability: event.target.value as ClassStudentRosterFilters['portraitAvailability'] })}
          className={ROSTER_FILTER_SELECT_CLASS}
        >
          <option value="">全部画像状态</option>
          <option value="unavailable">仅看画像不可用</option>
        </select>
        <button type="button"
          onClick={() => setFilters(EMPTY_ROSTER_FILTERS)}
          disabled={!hasActiveFilters}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 px-3 py-2 text-sm text-subtle transition hover:border-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="清除全部学生筛选"
        >
          <X className="h-4 w-4" />
          清除筛选
        </button>
      </div>

      {students.length === 0 ? (
        <div className="py-12 text-center">
          <GraduationCap className="mx-auto h-12 w-12 text-slate-600" />
          <p className="mt-4 text-slate-500">暂无学生加入此班级</p>
          <p className="mt-2 text-sm text-slate-600">
            将班级码 <span className="font-mono text-sky-400">{classCode}</span> 分享给学生
          </p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="py-12 text-center" data-teacher-class-roster-empty>
          <Users className="mx-auto h-12 w-12 text-slate-600" />
          <p className="mt-4 text-slate-500">没有符合条件的学生</p>
          <p className="mt-2 text-sm text-slate-600">当前搜索或筛选未命中任何班级成员。</p>
          {hasActiveFilters ? (
            <button type="button"
              onClick={() => setFilters(EMPTY_ROSTER_FILTERS)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border/70 px-3 py-2 text-sm text-subtle transition hover:border-border hover:text-foreground"
            >
              <X className="h-4 w-4" />
              清除筛选
            </button>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <table className="min-w-full border-collapse text-sm" data-teacher-mobile-cards="true" aria-label="班级学生清单">
            <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
              <tr className="border-b border-border/60 text-left text-xs uppercase tracking-[0.16em] text-subtle">
                <th className="px-4 py-3 font-medium">学生</th>
                <th className="px-4 py-3 font-medium">累计画像等级</th>
                <th className="px-4 py-3 font-medium">累计达成指数</th>
                <th className="px-4 py-3 font-medium">累计证据状态</th>
                <th className="px-4 py-3 font-medium">最后证据风险</th>
                <th className="px-4 py-3 font-medium">最后累计趋势</th>
                <th className="px-4 py-3 font-medium">证据截至</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => {
                const insight = studentInsightMap.get(student.user.id);
                return (
                  <tr
                    key={student.id}
                    className="border-b border-border/50 bg-card/45 transition hover:bg-accent/45"
                  >
                    <td className="px-4 py-4 align-top" data-label="学生">
                      <Link
                        href={buildTeacherStudentInsightsHref(classId, student.user.id)}
                        className="flex min-w-[220px] items-center gap-3"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-sm font-bold text-white">
                          {student.user.name?.charAt(0) || 'S'}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{student.user.name || '未命名学生'}</p>
                          <p className="text-xs text-subtle">
                            {formatTeacherStudentDisplayId({
                              studentNumber: student.studentNumber,
                              email: student.user.email,
                              fallbackId: student.user.id,
                            })}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-4 align-top text-foreground" data-label="画像等级">
                      {insight ? insight.overallLevel ?? formatAvailabilityReason(insight.availabilityReason) : '当前不可用'}
                    </td>
                    <td className="px-4 py-4 align-top" data-label="综合指数">
                      {insight ? (
                        <span className="font-semibold text-sky-600 dark:text-sky-300">
                          {insight.overallScore ?? '不可用'}
                        </span>
                      ) : (
                        <span className="text-subtle">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top" data-label="证据状态">
                      {insight ? (
                        <div className="min-w-[150px]">
                          <span className={getTeacherEvidenceStateChipClass(insight.evidenceStatus)}>
                            {formatTeacherEvidenceState(insight.evidenceStatus)}
                          </span>
                          <p className="mt-2 flex items-center gap-1 text-xs text-subtle">
                            <Database className="h-3.5 w-3.5" />
                            {formatTeacherEvidenceConfidence(insight.evidenceStatus)}
                          </p>
                        </div>
                      ) : (
                        <span className="teacher-insight-chip teacher-insight-chip-pending">当前不可用</span>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top" data-label="风险状态">
                      {insight ? (
                        <div className="min-w-[120px]">
                          <span className={`teacher-insight-chip teacher-insight-risk-${insight.riskLevel}`}>
                            {insight.riskLabel}
                          </span>
                          {insight.riskBadges.length > 0 ? (
                            <p className="mt-2 text-xs text-subtle">{insight.riskBadges.join('、')}</p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-sm text-subtle">不可用</span>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top text-foreground" data-label="累计趋势">
                      {insight ? formatTrendDirection(insight.trendDirection) : '不可用'}
                    </td>
                    <td className="px-4 py-4 align-top text-subtle" data-label="证据截至">
                      {insight ? formatEvidenceCutoff(insight.evidenceStatus.lastEvidenceAt) : '不可用'}
                    </td>
                    <td className="px-4 py-4 align-top" data-label="操作">
                      <div className="flex items-center gap-2">
                        <Link
                          href={buildTeacherStudentInsightsHref(classId, student.user.id)}
                          className="btn-ghost-themed rounded-lg px-3 py-1.5 text-sm"
                          aria-label={`查看学生 ${student.user.name || student.user.id} 详情`}
                        >
                          详情
                        </Link>
                        <button type="button"
                          onClick={() => onRemoveStudent(student.user.id, student.user.name || '该学生')}
                          disabled={removingStudentId === student.user.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 px-3 py-1.5 text-sm text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-300 disabled:opacity-50"
                          aria-label={`从班级移除学生 ${student.user.name || student.user.id}`}
                        >
                          {removingStudentId === student.user.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export type GovernanceTone = 'healthy' | 'warning' | 'pending';
export type InsightRiskLevel = 'none' | 'low' | 'medium' | 'high';
export type InsightTrendDirection = 'up' | 'stable' | 'down';

export interface TeacherStudentInsightSummary {
  id: string;
  name: string;
  overallScore: number;
  overallLevel: string;
  riskLevel: InsightRiskLevel;
  trendDirection: InsightTrendDirection;
  recentTrend: string;
  growthRecordCount: number;
  recommendationCount: number;
  strengths: string[];
  weaknesses: string[];
}

export interface GovernanceSummaryInput {
  totalStudents: number;
  coveredStudents: number;
  classSnapshotAt: string | null;
  latestStudentSnapshotAt: string | null;
  now?: Date;
}

export interface GovernanceSummary {
  tone: GovernanceTone;
  label: string;
  detail: string;
  coverageRatio: number;
  lastUpdatedLabel: string;
}

export function normalizeInsightRiskLevel(value: string | null | undefined): InsightRiskLevel {
  if (!value) return 'none';
  if (value === 'high' || value === '高风险') return 'high';
  if (value === 'medium' || value === '中风险') return 'medium';
  if (value === 'low' || value === '低风险') return 'low';
  return 'none';
}

export function getInsightRiskLabel(level: InsightRiskLevel) {
  if (level === 'high') return '高风险';
  if (level === 'medium') return '中风险';
  if (level === 'low') return '低风险';
  return '风险平稳';
}

export function parseStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

const RISK_PRIORITY: Record<InsightRiskLevel, number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3,
};

const TREND_PRIORITY: Record<InsightTrendDirection, number> = {
  down: 0,
  stable: 1,
  up: 2,
};

export function buildTeacherClassInsightsHref(classId: string) {
  return `/teacher/classes/${classId}/analytics-v2`;
}

export function buildTeacherHistoryHref() {
  return '/teacher/history';
}

export function buildTeacherStudentInsightsHref(classId: string, studentId: string) {
  return `/teacher/classes/${classId}/students/${studentId}`;
}

export function formatTeacherStudentDisplayId({
  studentNumber,
  email,
  fallbackId,
}: {
  studentNumber: string | null | undefined;
  email: string | null | undefined;
  fallbackId: string;
}) {
  if (studentNumber && studentNumber.trim().length > 0) {
    return studentNumber.trim();
  }

  if (email && email.trim().length > 0) {
    return email.trim();
  }

  return fallbackId.slice(0, 8);
}

export function summarizeGovernanceState({
  totalStudents,
  coveredStudents,
  classSnapshotAt,
  latestStudentSnapshotAt,
  now = new Date(),
}: GovernanceSummaryInput): GovernanceSummary {
  const safeTotal = Math.max(totalStudents, 0);
  const safeCovered = Math.max(Math.min(coveredStudents, safeTotal || coveredStudents), 0);
  const coverageRatio = safeTotal > 0 ? roundTo(safeCovered / safeTotal, 2) : 0;
  const latestTimestamp = latestStudentSnapshotAt ?? classSnapshotAt;

  if (safeCovered === 0 || !latestTimestamp) {
    return {
      tone: 'pending',
      label: '治理结果待生成',
      detail: safeTotal > 0 ? '还没有学生画像结果，班级页先展示基础管理信息。' : '班级暂无学生，暂无可治理数据。',
      coverageRatio,
      lastUpdatedLabel: '暂无快照',
    };
  }

  const freshnessMinutes = Math.max(
    0,
    Math.round((now.getTime() - new Date(latestTimestamp).getTime()) / 60000)
  );

  if (coverageRatio >= 0.6 && freshnessMinutes <= 120) {
    return {
      tone: 'healthy',
      label: '治理结果可用',
      detail: `已覆盖 ${safeCovered}/${safeTotal} 名学生，可支持班级与个体学情判断。`,
      coverageRatio,
      lastUpdatedLabel: formatFreshnessLabel(freshnessMinutes),
    };
  }

  return {
    tone: 'warning',
    label: '治理结果部分可用',
    detail: `当前仅覆盖 ${safeCovered}/${safeTotal} 名学生，需结合课堂记录综合判断。`,
    coverageRatio,
    lastUpdatedLabel: formatFreshnessLabel(freshnessMinutes),
  };
}

export function rankStudentsByAttention<T extends TeacherStudentInsightSummary>(students: T[]): T[] {
  return [...students].sort((left, right) => {
    const riskDiff = RISK_PRIORITY[left.riskLevel] - RISK_PRIORITY[right.riskLevel];
    if (riskDiff !== 0) return riskDiff;

    const scoreDiff = left.overallScore - right.overallScore;
    if (scoreDiff !== 0) return scoreDiff;

    const trendDiff = TREND_PRIORITY[left.trendDirection] - TREND_PRIORITY[right.trendDirection];
    if (trendDiff !== 0) return trendDiff;

    return left.growthRecordCount - right.growthRecordCount;
  });
}

function formatFreshnessLabel(freshnessMinutes: number) {
  if (freshnessMinutes < 60) {
    return `${freshnessMinutes} 分钟前更新`;
  }
  const hours = Math.floor(freshnessMinutes / 60);
  if (hours < 24) {
    return `${hours} 小时前更新`;
  }
  const days = Math.floor(hours / 24);
  return `${days} 天前更新`;
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

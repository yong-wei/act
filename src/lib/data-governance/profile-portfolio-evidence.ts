import type { ProfileSimulationEvidenceItem } from '@/lib/data-governance/profile-simulation-evidence';

export type PortfolioEvidenceSourceState = 'available' | 'empty' | 'unavailable';

export interface ClassroomPortfolioWork {
  id: string;
  title: string;
  type: string;
  content: string;
  createdAt: string;
  sessionName?: string;
}

export interface SimulationPortfolioDesign {
  id: string;
  name: string;
  score: number | null;
  parameters: Record<string, number>;
  createdAt: string;
}

export interface EthicsPortfolioCase {
  id: string;
  violationType: string;
  description: string;
  remediationAction: string;
  isResolved: boolean;
  createdAt: string;
}

export interface PortfolioEvidenceSource<T> {
  state: PortfolioEvidenceSourceState;
  total: number | null;
  items: T[];
}

interface ClassroomPortfolioWorkSource {
  id: string;
  lessonKey: string | null;
  stepId: string;
  submittedAt: Date;
  responseData: unknown;
  session: { plan: { title: string } } | null;
}

interface EthicsPortfolioCaseSource {
  id: string;
  violationType: string;
  aiCritique: string | null;
  studentJustification: string | null;
  isResolved: boolean;
  createdAt: Date;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function getPortfolioEvidenceSourceState(total: number | null): PortfolioEvidenceSourceState {
  if (total === null) return 'unavailable';
  return total > 0 ? 'available' : 'empty';
}

export function buildClassroomPortfolioWorks(
  rows: ClassroomPortfolioWorkSource[],
): ClassroomPortfolioWork[] {
  return rows.slice(0, 5).map((row) => {
    const response = record(row.responseData);
    const score = numberValue(response.score);
    const lessonKey = stringValue(row.lessonKey);
    const title = [lessonKey, row.stepId].filter(Boolean).join(' · ') || '课堂提交';

    return {
      id: row.id,
      title,
      type: '课堂提交',
      content: score === null
        ? `已提交课堂步骤 ${row.stepId}。`
        : `已提交课堂步骤 ${row.stepId}，得分 ${formatScore(score)} 分。`,
      createdAt: row.submittedAt.toISOString(),
      ...(row.session?.plan.title ? { sessionName: row.session.plan.title } : {}),
    };
  });
}

/**
 * 仿真设计记录消费统一学生安全投影（Issue #1991）：条目来自
 * `readProfileSimulationEvidence` 的 items，与普通个人中心统计同源同口径，
 * 不再直接读取 `SimulationLog`。
 */
export function buildSimulationPortfolioDesigns(
  rows: ProfileSimulationEvidenceItem[],
): SimulationPortfolioDesign[] {
  return rows.slice(0, 5).map((row) => ({
    id: row.id,
    name: row.title,
    score: row.score === null ? null : Math.round(row.score),
    parameters: row.parameters,
    createdAt: row.occurredAt,
  }));
}

export function buildEthicsPortfolioCases(
  rows: EthicsPortfolioCaseSource[],
): EthicsPortfolioCase[] {
  return rows.slice(0, 5).map((row) => ({
    id: row.id,
    violationType: row.violationType,
    description: stringValue(row.aiCritique) ?? '已记录一项伦理风险。',
    remediationAction: row.isResolved ? stringValue(row.studentJustification) ?? '' : '',
    isResolved: row.isResolved,
    createdAt: row.createdAt.toISOString(),
  }));
}

export type {
  ClassroomPortfolioWorkSource,
  EthicsPortfolioCaseSource,
};

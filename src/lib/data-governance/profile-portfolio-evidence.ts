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

interface SimulationPortfolioDesignSource {
  id: string;
  controlMode: string;
  inputParams: unknown;
  score: number | null;
  createdAt: Date;
}

interface EthicsPortfolioCaseSource {
  id: string;
  violationType: string;
  aiCritique: string | null;
  studentJustification: string | null;
  isResolved: boolean;
  createdAt: Date;
}

const SAFE_SIMULATION_PARAMETER_KEYS = ['kp', 'ki', 'kd', 'targetHeading', 'targetSpeed'] as const;

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

export function buildSimulationPortfolioDesigns(
  rows: SimulationPortfolioDesignSource[],
): SimulationPortfolioDesign[] {
  return rows.slice(0, 5).map((row) => {
    const inputParams = record(row.inputParams);
    const parameters = Object.fromEntries(
      SAFE_SIMULATION_PARAMETER_KEYS.flatMap((key) => {
        const value = numberValue(inputParams[key]);
        return value === null ? [] : [[key, value] as const];
      }),
    );

    return {
      id: row.id,
      name: `${row.controlMode.trim().toUpperCase() || '未知'} 仿真设计`,
      score: row.score === null ? null : Math.round(row.score),
      parameters,
      createdAt: row.createdAt.toISOString(),
    };
  });
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
  SimulationPortfolioDesignSource,
  EthicsPortfolioCaseSource,
};

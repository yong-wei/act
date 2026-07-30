import { prisma } from '@/lib/prisma';

export const CURRENT_RISK_FLAG_TYPES = [
  'stagnation',
  'constraint',
  'cross_domain',
] as const;

export type CurrentRiskFlagType = (typeof CURRENT_RISK_FLAG_TYPES)[number];
export type RiskFlagSeverity = 'low' | 'medium' | 'high';

export interface RiskFlagInput {
  flagType: CurrentRiskFlagType;
  severity: RiskFlagSeverity;
  description: string;
  evidenceJson: Record<string, unknown>;
}

export interface RiskRuleContext {
  db: RiskScannerDb;
  now: Date;
}

export interface RiskScanRule {
  name: CurrentRiskFlagType;
  evaluate(studentId: string, context: RiskRuleContext): Promise<RiskFlagInput | null>;
}

export interface RiskScannerDb {
  studentProfile: {
    findMany(args: Record<string, unknown>): Promise<Array<{ userId: string }>>;
  };
  knowledgeProgress: {
    findMany(args: Record<string, unknown>): Promise<Array<{
      nodeId: string;
      progress: number;
      lastVisited: Date;
    }>>;
  };
  studentCompetencySnapshot: {
    findFirst(args: Record<string, unknown>): Promise<{
      id: string;
      snapshotAt: Date;
      competencyVector: unknown;
    } | null>;
  };
  studentRiskFlag: {
    findFirst(args: Record<string, unknown>): Promise<{
      id: string;
      severity: string;
      description: string;
      evidenceJson: unknown;
    } | null>;
    create(args: Record<string, unknown>): Promise<unknown>;
    update(args: Record<string, unknown>): Promise<unknown>;
  };
}

const STAGNATION_PROGRESS_THRESHOLD = 5;
const CONSTRAINT_PROGRESS_THRESHOLD = 40;
const CROSS_DOMAIN_STD_THRESHOLD = 15;

function stableEvidenceJson(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function sameEvidence(
  existing: { severity: string; description: string; evidenceJson: unknown },
  next: RiskFlagInput,
) {
  return existing.severity === next.severity
    && existing.description === next.description
    && JSON.stringify(stableEvidenceJson(existing.evidenceJson)) === JSON.stringify(next.evidenceJson);
}

export const stagnationRule: RiskScanRule = {
  name: 'stagnation',
  async evaluate(studentId, context) {
    const recentProgress = await context.db.knowledgeProgress.findMany({
      where: { userId: studentId, status: 'IN_PROGRESS' },
      orderBy: { lastVisited: 'desc' },
      take: 10,
      select: {
        nodeId: true,
        progress: true,
        lastVisited: true,
      },
    });
    if (recentProgress.length === 0) return null;

    if (recentProgress.length < 3) return null;

    const avgProgress = recentProgress.reduce((sum, progress) => sum + progress.progress, 0)
      / recentProgress.length;
    if (avgProgress > STAGNATION_PROGRESS_THRESHOLD) return null;

    return {
      flagType: 'stagnation',
      severity: avgProgress < 1 ? 'high' : 'medium',
      description: `Knowledge progress remains low across ${recentProgress.length} nodes`,
      evidenceJson: {
        lowProgressNodeCount: recentProgress.length,
        avgProgress: Math.round(avgProgress * 10) / 10,
        evidenceCutoff: recentProgress[0]?.lastVisited.toISOString() ?? null,
      },
    };
  },
};

export const constraintRule: RiskScanRule = {
  name: 'constraint',
  async evaluate(studentId, context) {
    const stuckNodes = await context.db.knowledgeProgress.findMany({
      where: {
        userId: studentId,
        status: 'IN_PROGRESS',
        progress: {
          gt: STAGNATION_PROGRESS_THRESHOLD,
          lte: CONSTRAINT_PROGRESS_THRESHOLD,
        },
      },
      orderBy: { lastVisited: 'asc' },
      take: 3,
      select: {
        nodeId: true,
        progress: true,
        lastVisited: true,
      },
    });
    if (stuckNodes.length === 0) return null;

    return {
      flagType: 'constraint',
      severity: stuckNodes.length >= 3 ? 'high' : 'medium',
      description: `Learning progress remains constrained on ${stuckNodes.length} knowledge node(s)`,
      evidenceJson: {
        stuckNodeCount: stuckNodes.length,
        progressUpperBound: CONSTRAINT_PROGRESS_THRESHOLD,
        evidenceCutoff: stuckNodes
          .map((node) => node.lastVisited)
          .sort((left, right) => right.getTime() - left.getTime())[0]
          ?.toISOString() ?? null,
      },
    };
  },
};

export const crossDomainRule: RiskScanRule = {
  name: 'cross_domain',
  async evaluate(studentId, context) {
    const snapshot = await context.db.studentCompetencySnapshot.findFirst({
      where: { userId: studentId },
      orderBy: { snapshotAt: 'desc' },
      select: {
        id: true,
        snapshotAt: true,
        competencyVector: true,
      },
    });
    if (!snapshot) return null;

    const vector = stableEvidenceJson(snapshot.competencyVector);
    const dimensions = Object.values(vector).filter(
      (value): value is number => typeof value === 'number' && Number.isFinite(value),
    );
    if (dimensions.length < 3) return null;

    const mean = dimensions.reduce((sum, value) => sum + value, 0) / dimensions.length;
    const variance = dimensions.reduce((sum, value) => sum + (value - mean) ** 2, 0)
      / dimensions.length;
    const standardDeviation = Math.sqrt(variance);
    if (standardDeviation < CROSS_DOMAIN_STD_THRESHOLD) return null;

    return {
      flagType: 'cross_domain',
      severity: standardDeviation > 25 ? 'high' : 'medium',
      description: 'Cross-domain competency evidence is materially imbalanced',
      evidenceJson: {
        standardDeviation: Math.round(standardDeviation * 10) / 10,
        dimensionCount: dimensions.length,
        evidenceCutoff: snapshot.snapshotAt.toISOString(),
        snapshotRef: `student-competency-snapshot:${snapshot.id}`,
      },
    };
  },
};

export const CURRENT_RISK_SCAN_RULES: RiskScanRule[] = [
  stagnationRule,
  constraintRule,
  crossDomainRule,
];

export interface ScanResult {
  studentId: string;
  flagsCreated: number;
  flagsUpdated: number;
  flagsResolved: number;
  unchanged: number;
  failures: number;
}

export async function scanStudentRisks(
  studentId: string,
  options: {
    db?: RiskScannerDb;
    rules?: RiskScanRule[];
    now?: Date;
  } = {},
): Promise<ScanResult> {
  const db = options.db ?? (prisma as unknown as RiskScannerDb);
  const rules = options.rules ?? CURRENT_RISK_SCAN_RULES;
  const now = options.now ?? new Date();
  const result: ScanResult = {
    studentId,
    flagsCreated: 0,
    flagsUpdated: 0,
    flagsResolved: 0,
    unchanged: 0,
    failures: 0,
  };

  for (const rule of rules) {
    try {
      const next = await rule.evaluate(studentId, { db, now });
      const existing = await db.studentRiskFlag.findFirst({
        where: {
          userId: studentId,
          flagType: rule.name,
          isResolved: false,
        },
        select: {
          id: true,
          severity: true,
          description: true,
          evidenceJson: true,
        },
      });

      if (!next && existing) {
        await db.studentRiskFlag.update({
          where: { id: existing.id },
          data: {
            isResolved: true,
            resolvedAt: now,
            resolutionNote: `deterministic-rule-cleared:${rule.name}`,
          },
        });
        result.flagsResolved += 1;
        continue;
      }

      if (!next) {
        result.unchanged += 1;
        continue;
      }

      if (existing) {
        if (sameEvidence(existing, next)) {
          result.unchanged += 1;
          continue;
        }
        await db.studentRiskFlag.update({
          where: { id: existing.id },
          data: {
            severity: next.severity,
            description: next.description,
            evidenceJson: next.evidenceJson,
            resolutionNote: null,
          },
        });
        result.flagsUpdated += 1;
        continue;
      }

      await db.studentRiskFlag.create({
        data: {
          userId: studentId,
          flagType: next.flagType,
          severity: next.severity,
          description: next.description,
          evidenceJson: next.evidenceJson,
          triggeredAt: now,
        },
      });
      result.flagsCreated += 1;
    } catch (error) {
      result.failures += 1;
      console.warn(`[risk-scanner] Rule ${rule.name} failed for student ${studentId}:`, error);
    }
  }

  return result;
}

export async function scanBatchRisks(
  studentIds: string[],
  options: {
    db?: RiskScannerDb;
    rules?: RiskScanRule[];
    now?: Date;
  } = {},
) {
  const results: ScanResult[] = [];
  for (const studentId of studentIds) {
    results.push(await scanStudentRisks(studentId, options));
  }
  return results;
}

export async function scanAllStudentRisks(options: {
  db?: RiskScannerDb;
  rules?: RiskScanRule[];
  now?: Date;
  pageSize?: number;
  maxStudents?: number;
} = {}) {
  const db = options.db ?? (prisma as unknown as RiskScannerDb);
  const pageSize = Math.min(Math.max(options.pageSize ?? 100, 1), 500);
  const results: ScanResult[] = [];
  let cursorUserId: string | undefined;

  while (options.maxStudents === undefined || results.length < options.maxStudents) {
    const take = Math.min(pageSize, options.maxStudents === undefined
      ? pageSize
      : options.maxStudents - results.length);
    const students = await db.studentProfile.findMany({
      orderBy: { userId: 'asc' },
      take,
      ...(cursorUserId ? { cursor: { userId: cursorUserId }, skip: 1 } : {}),
      select: { userId: true },
    });
    if (students.length === 0) break;

    results.push(...await scanBatchRisks(
      students.map((student) => student.userId),
      {
        db,
        rules: options.rules,
        now: options.now,
      },
    ));
    cursorUserId = students.at(-1)?.userId;
    if (students.length < take) break;
  }

  return results;
}

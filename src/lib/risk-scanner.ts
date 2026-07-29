import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

// ---- Rule configuration ----

export interface RiskScanRule {
  name: string;
  evaluate(studentId: string): Promise<RiskFlagInput | null>;
}

export interface RiskFlagInput {
  flagType: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  evidenceJson: Record<string, unknown>;
}

const STAGNATION_WINDOW_DAYS = 14;
const STAGNATION_PROGRESS_THRESHOLD = 5;
const PARTICIPATION_INACTIVE_DAYS = 7;
const CONSTRAINT_STUCK_DAYS = 10;
const CROSS_DOMAIN_STD_THRESHOLD = 15;

// ---- Rules ----

const stagnationRule: RiskScanRule = {
  name: 'stagnation',
  async evaluate(studentId) {
    const recentProgress = await prisma.knowledgeProgress.findMany({
      where: { userId: studentId, status: 'IN_PROGRESS' },
      orderBy: { lastVisited: 'desc' },
      take: 10,
    });

    if (recentProgress.length === 0) return null;

    const staleProgress = recentProgress.filter(
      (p) => p.lastVisited < new Date(Date.now() - STAGNATION_WINDOW_DAYS * 86400000)
    );

    if (staleProgress.length < 3) return null;

    const avgProgress = recentProgress.reduce((sum, p) => sum + p.progress, 0) / recentProgress.length;
    if (avgProgress > STAGNATION_PROGRESS_THRESHOLD) return null;

    return {
      flagType: 'stagnation',
      severity: avgProgress < 1 ? 'high' : 'medium',
      description: `Knowledge progress stalled: ${staleProgress.length} nodes unchanged in ${STAGNATION_WINDOW_DAYS} days (avg ${avgProgress.toFixed(1)}%)`,
      evidenceJson: {
        staleNodeCount: staleProgress.length,
        avgProgress: Math.round(avgProgress * 10) / 10,
        windowDays: STAGNATION_WINDOW_DAYS,
        sampleNodeIds: staleProgress.slice(0, 3).map((p) => p.nodeId),
      },
    };
  },
};

const participationRule: RiskScanRule = {
  name: 'participation',
  async evaluate(studentId) {
    const latestActivity = await prisma.learningNote.findFirst({
      where: { userId: studentId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (!latestActivity) {
      const sessionCount = await prisma.studentState.count({
        where: { userId: studentId },
      });
      if (sessionCount > 0) return null;

      return {
        flagType: 'participation',
        severity: 'high',
        description: 'No learning activity found for this student',
        evidenceJson: { sessionCount: 0, reason: 'no-records' },
      };
    }

    const daysSinceLastActivity = Math.floor(
      (Date.now() - latestActivity.createdAt.getTime()) / 86400000
    );

    if (daysSinceLastActivity < PARTICIPATION_INACTIVE_DAYS) return null;

    return {
      flagType: 'participation',
      severity: daysSinceLastActivity > 14 ? 'high' : 'medium',
      description: `Student inactive for ${daysSinceLastActivity} days`,
      evidenceJson: {
        daysSinceLastActivity,
        lastActivityAt: latestActivity.createdAt.toISOString(),
        thresholdDays: PARTICIPATION_INACTIVE_DAYS,
      },
    };
  },
};

const constraintRule: RiskScanRule = {
  name: 'constraint',
  async evaluate(studentId) {
    const stuckNodes = await prisma.knowledgeProgress.findMany({
      where: {
        userId: studentId,
        status: 'IN_PROGRESS',
        lastVisited: { lt: new Date(Date.now() - CONSTRAINT_STUCK_DAYS * 86400000) },
      },
      orderBy: { lastVisited: 'asc' },
      take: 3,
    });

    if (stuckNodes.length === 0) return null;

    return {
      flagType: 'constraint',
      severity: stuckNodes.length >= 3 ? 'high' : 'medium',
      description: `Student stuck on ${stuckNodes.length} knowledge node(s) for >${CONSTRAINT_STUCK_DAYS} days`,
      evidenceJson: {
        stuckNodeIds: stuckNodes.map((n) => n.nodeId),
        stuckDays: CONSTRAINT_STUCK_DAYS,
        stuckNodeCount: stuckNodes.length,
      },
    };
  },
};

const crossDomainRule: RiskScanRule = {
  name: 'cross_domain',
  async evaluate(studentId) {
    const snapshot = await prisma.studentCompetencySnapshot.findFirst({
      where: { userId: studentId },
      orderBy: { snapshotAt: 'desc' },
    });

    if (!snapshot) return null;

    const vector = snapshot.competencyVector as Record<string, number>;
    const dimensions = Object.values(vector).filter((v) => typeof v === 'number');
    if (dimensions.length < 3) return null;

    const mean = dimensions.reduce((a, b) => a + b, 0) / dimensions.length;
    const variance = dimensions.reduce((sum, v) => sum + (v - mean) ** 2, 0) / dimensions.length;
    const std = Math.sqrt(variance);

    if (std < CROSS_DOMAIN_STD_THRESHOLD) return null;

    const entries = Object.entries(vector).sort(([, a], [, b]) => (b as number) - (a as number));
    const top = entries.slice(0, 2).map(([k]) => k);
    const bottom = entries.slice(-2).map(([k]) => k);

    return {
      flagType: 'cross_domain',
      severity: std > 25 ? 'high' : 'medium',
      description: `Competency imbalance detected (std=${std.toFixed(1)})`,
      evidenceJson: {
        stdDev: Math.round(std * 10) / 10,
        topDimensions: top,
        bottomDimensions: bottom,
        dimensionCount: dimensions.length,
      },
    };
  },
};

// ---- Scanner ----

const ALL_RULES: RiskScanRule[] = [
  stagnationRule,
  participationRule,
  constraintRule,
  crossDomainRule,
];

export interface ScanResult {
  studentId: string;
  flagsCreated: number;
  skipped: number;
}

export async function scanStudentRisks(
  studentId: string,
  rules: RiskScanRule[] = ALL_RULES,
): Promise<ScanResult> {
  let flagsCreated = 0;
  let skipped = 0;

  for (const rule of rules) {
    const base = rule.name;
    const existing = await prisma.studentRiskFlag.findFirst({
      where: {
        userId: studentId,
        flagType: base,
        isResolved: false,
      },
    });
    if (existing) {
      skipped++;
      continue;
    }

    try {
      const result = await rule.evaluate(studentId);
      if (result) {
        await prisma.studentRiskFlag.create({
          data: {
            userId: studentId,
            flagType: base,
            severity: result.severity,
            description: result.description,
            evidenceJson: result.evidenceJson as Prisma.InputJsonValue,
            triggeredAt: new Date(),
          },
        });
        flagsCreated++;
      }
    } catch (error) {
      console.warn(`[risk-scanner] Rule ${rule.name} failed for student ${studentId}:`, error);
    }
  }

  return { studentId, flagsCreated, skipped };
}

export async function scanBatchRisks(
  studentIds: string[],
  rules: RiskScanRule[] = ALL_RULES,
): Promise<ScanResult[]> {
  const results: ScanResult[] = [];
  for (const id of studentIds) {
    results.push(await scanStudentRisks(id, rules));
  }
  return results;
}
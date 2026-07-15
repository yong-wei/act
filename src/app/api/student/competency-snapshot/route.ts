/**
 * Student Competency Snapshot API
 *
 * Returns comprehensive competency data for the current student.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import { calculateTrendVector } from '@/lib/data-governance/competency-engine';
import type { CompetencyVector, TrendVector } from '@/lib/data-governance/competency-model';
import {
  dedupeRecommendations,
  dedupeRiskFlags,
} from '@/lib/data-governance/profile-center';
import {
  createPrismaDiagnosisReportSnapshotStore,
  hasDiagnosisReportSnapshotPersistenceTable,
  readLatestControlCorrectionDiagnosisReportSnapshotFromPersistence,
} from '@/lib/data-governance/control-correction-diagnosis-profile';
import {
  materializeRoleBasedLearningDiagnosis,
  type RoleBasedLearningDiagnosis,
} from '@/lib/data-governance/role-based-learning-diagnosis';
import type { RecommendationRationale } from '@/lib/data-governance/recommendation-engine';
import type { RiskFlag } from '@/lib/data-governance/risk-detector';

export const dynamic = 'force-dynamic';

interface EvidenceSummaryItem {
  factType: string;
  outcome: string;
  score?: number;
  moduleId?: string | null;
  lessonId?: string | null;
  sourceLogId?: string | null;
  evidenceTitle?: string;
  stepId?: string;
  questionSummaries?: Array<{
    questionId?: string;
    prompt?: string;
    studentAnswerRedacted?: boolean;
    referenceAnswer?: string;
    isCorrect?: boolean;
  }>;
}

export interface StudentSnapshotResponse {
  derivationState: 'current' | 'no-evidence' | 'no-recent-evidence' | 'no-evidence-after-revocation';
  evidenceState: 'current' | 'empty';
  currentSnapshot: {
    vector: CompetencyVector;
    snapshotAt: string;
    factCount: number;
  };
  previousSnapshot: {
    vector: CompetencyVector;
    snapshotAt: string;
  } | null;
  trendVector: TrendVector | null;
  evidenceSummary: Record<string, EvidenceSummaryItem[]>;
  riskFlags: RiskFlag[];
  recommendations: Array<{
    type: 'immediate' | 'weekly' | 'challenge';
    title: string;
    description: string;
    actionUrl?: string;
    priority: number;
    rationale: RecommendationRationale;
  }>;
  diagnosis: RoleBasedLearningDiagnosis;
}

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerAuthSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const userId = session.user.id;
    // Get current snapshot
    const currentSnapshot = await prisma.studentCompetencySnapshot.findFirst({
      where: { userId },
      orderBy: { snapshotAt: 'desc' },
    });

    if (!currentSnapshot) {
      return NextResponse.json({
        derivationState: 'no-evidence',
        evidenceState: 'empty',
        currentSnapshot: null,
        previousSnapshot: null,
        trendVector: null,
        evidenceSummary: {},
        riskFlags: [],
        recommendations: [],
        diagnosis: materializeRoleBasedLearningDiagnosis({
          view: 'student',
          goalId: 'control-correction',
          userId,
          targetUserId: userId,
          diagnosisReportSnapshot: null,
        }),
      } satisfies Omit<StudentSnapshotResponse, 'currentSnapshot'> & { currentSnapshot: null });
    }

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId },
      select: { classId: true },
    });

    const diagnosisReportSnapshot = await hasDiagnosisReportSnapshotPersistenceTable(prisma)
      ? await readLatestControlCorrectionDiagnosisReportSnapshotFromPersistence(
        createPrismaDiagnosisReportSnapshotStore(prisma.diagnosisReportSnapshot),
        {
          view: 'student',
          goalId: 'control-correction',
          userId,
          targetUserId: userId,
          classId: studentProfile?.classId ?? null,
        }
      )
      : null;

    // Get previous snapshot for trend calculation
    const previousSnapshot = await prisma.studentCompetencySnapshot.findFirst({
      where: {
        userId,
        snapshotAt: {
          lt: currentSnapshot.snapshotAt,
        },
      },
      orderBy: { snapshotAt: 'desc' },
    });

    // Get evidence summary from current snapshot
    const rawEvidenceSummary = (currentSnapshot.evidenceSummary as unknown as Record<string, unknown>) || {};
    const derivation = rawEvidenceSummary._derivation && typeof rawEvidenceSummary._derivation === 'object' ? rawEvidenceSummary._derivation as Record<string, unknown> : null;
    const noEvidenceAfterRevocation = derivation?.state === 'no-evidence-after-revocation'
      || derivation?.state === 'no-recent-evidence';
    const derivationState = derivation?.state === 'no-recent-evidence' || derivation?.state === 'no-evidence-after-revocation'
      ? derivation.state
      : 'current';
    const evidenceSummary = sanitizeEvidenceSummary(
      (currentSnapshot.evidenceSummary as unknown as Record<string, EvidenceSummaryItem[]>) || {}
    );

    // Get risk flags
    const rawRiskFlags = await prisma.studentRiskFlag.findMany({
      where: {
        userId,
        isResolved: false,
      },
      orderBy: { triggeredAt: 'desc' },
      take: 10,
    });

    const riskFlags = dedupeRiskFlags(
      rawRiskFlags.map((rf) => ({
        type: rf.flagType as RiskFlag['type'],
        severity: rf.severity as RiskFlag['severity'],
        description: rf.description,
        evidence: rf.evidenceJson as Record<string, unknown>,
        triggeredAt: rf.triggeredAt,
      }))
    );

    // Calculate trend vector
    const currentVector = currentSnapshot.competencyVector as unknown as CompetencyVector;
    const previousVector = previousSnapshot?.competencyVector as unknown as CompetencyVector | undefined;
    const trendVector = noEvidenceAfterRevocation ? null : previousVector
      ? calculateTrendVector(currentVector, previousVector)
      : (Object.fromEntries(
          Object.keys(currentVector).map((k) => [k, 'stable'])
        ) as unknown as TrendVector);

    // Generate basic recommendations based on snapshot data
    const recommendations = noEvidenceAfterRevocation ? [] : generateSnapshotRecommendations(
      currentVector,
      riskFlags,
      evidenceSummary,
      currentSnapshot.factCount
    );

    const response: StudentSnapshotResponse = {
      derivationState,
      evidenceState: noEvidenceAfterRevocation ? 'empty' : 'current',
      currentSnapshot: {
        vector: currentVector,
        snapshotAt: currentSnapshot.snapshotAt.toISOString(),
        factCount: currentSnapshot.factCount,
      },
      previousSnapshot: previousSnapshot
        ? {
            vector: previousVector!,
            snapshotAt: previousSnapshot.snapshotAt.toISOString(),
          }
        : null,
      trendVector,
      evidenceSummary,
      riskFlags,
      recommendations,
      diagnosis: materializeRoleBasedLearningDiagnosis({
        view: 'student',
        goalId: 'control-correction',
        userId,
        targetUserId: userId,
        learnerState: {
          generatedAt: currentSnapshot.snapshotAt.toISOString(),
        },
        diagnosisReportSnapshot,
      }),
    };

    return NextResponse.json(response);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[StudentSnapshot] Error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

function sanitizeEvidenceSummary(
  summary: Record<string, EvidenceSummaryItem[]>,
): Record<string, EvidenceSummaryItem[]> {
  return Object.fromEntries(
    Object.entries(summary).map(([dimension, items]) => [
      dimension,
      Array.isArray(items)
        ? items.slice(0, 6).map((item) => ({
            factType: item.factType,
            outcome: item.outcome,
            score: item.score,
            moduleId: item.moduleId,
            lessonId: item.lessonId,
            sourceLogId: item.sourceLogId,
            evidenceTitle: truncateOptionalText(item.evidenceTitle),
            stepId: item.stepId,
            questionSummaries: item.questionSummaries?.slice(0, 3).map((question) => ({
              questionId: question.questionId,
              prompt: truncateOptionalText(question.prompt),
              studentAnswerRedacted: typeof (question as { studentAnswer?: unknown }).studentAnswer === 'string' &&
                ((question as { studentAnswer?: string }).studentAnswer?.length ?? 0) > 0,
              referenceAnswer: truncateOptionalText(question.referenceAnswer),
              isCorrect: question.isCorrect,
            })),
          }))
        : [],
    ]),
  );
}

function truncateOptionalText(value: string | undefined, maxLength: number = 96) {
  if (typeof value !== 'string') return undefined;
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

/**
 * Generate recommendations based on snapshot data
 */
function generateSnapshotRecommendations(
  vector: CompetencyVector,
  riskFlags: RiskFlag[],
  _evidenceSummary: Record<string, EvidenceSummaryItem[]>,
  factCount: number
): StudentSnapshotResponse['recommendations'] {
  const recommendations: StudentSnapshotResponse['recommendations'] = [];

  // Find weakest dimensions
  const dimensions = Object.entries(vector)
    .map(([key, value]) => ({ dimension: key, score: value.score }))
    .sort((a, b) => a.score - b.score);

  const weakestDimension = dimensions[0];
  const secondWeakest = dimensions[1];

  // Immediate recommendations based on risks
  for (const risk of riskFlags) {
    switch (risk.type) {
      case 'ai_misuse':
        recommendations.push({
          type: 'immediate',
          title: '优化AI使用方式',
          description: '你近期频繁使用AI助手但问题解决率较低。建议先独立思考，再针对性地提问。',
          actionUrl: '/ai/copilot',
          priority: 90,
          rationale: buildSnapshotRecommendationRationale('snapshot-risk-ai_misuse', 'risk', vector, factCount),
        });
        break;
      case 'constraint':
        recommendations.push({
          type: 'immediate',
          title: '强化工程约束意识',
          description: '仿真中多次忽视工程约束。建议在调整参数前明确安全边界。',
          actionUrl: '/simulations/destroyer',
          priority: 85,
          rationale: buildSnapshotRecommendationRationale('snapshot-risk-constraint', 'risk', vector, factCount),
        });
        break;
      case 'participation':
        recommendations.push({
          type: 'immediate',
          title: '增加学习活跃度',
          description: '近一周学习活跃度较低，建议每天保持至少30分钟的学习时间。',
          actionUrl: '/missions',
          priority: 95,
          rationale: buildSnapshotRecommendationRationale('snapshot-risk-participation', 'risk', vector, factCount),
        });
        break;
      case 'cross_domain':
        recommendations.push({
          type: 'immediate',
          title: '加强跨域知识联系',
          description: '单点知识掌握较好，但跨域迁移能力需要提升。',
          actionUrl: '/interactive-learning',
          priority: 80,
          rationale: buildSnapshotRecommendationRationale('snapshot-risk-cross_domain', 'risk', vector, factCount),
        });
        break;
    }
  }

  // Weekly recommendations based on weak dimensions
  if (weakestDimension.score < 60) {
    const dimensionNames: Record<string, string> = {
      controlModeling: '控制建模',
      parameterDesign: '参数设计',
      crossDomainTransfer: '跨域迁移',
      engineeringDecision: '工程决策',
      inquiryReflection: '探究反思',
      selfDirectedLearning: '自主学习',
    };

    recommendations.push({
      type: 'weekly',
      title: `提升${dimensionNames[weakestDimension.dimension]}能力`,
      description: `这是你的薄弱领域（${Math.round(weakestDimension.score)}分），建议本周重点练习相关任务。`,
      actionUrl: '/missions',
      priority: 70,
      rationale: buildSnapshotRecommendationRationale('snapshot-weak-dimension', 'direct', vector, factCount),
    });
  }

  if (secondWeakest && secondWeakest.score < 65) {
    recommendations.push({
      type: 'weekly',
      title: '巩固基础能力',
      description: '多维度能力有待提升，建议系统复习基础知识。',
      actionUrl: '/knowledge',
      priority: 60,
      rationale: buildSnapshotRecommendationRationale('snapshot-foundation-review', 'direct', vector, factCount),
    });
  }

  // Challenge recommendations
  const strongDimensions = dimensions.filter((d) => d.score > 75);
  if (strongDimensions.length > 0) {
    recommendations.push({
      type: 'challenge',
      title: '挑战高难度任务',
      description: `你在${strongDimensions.map((d) => d.dimension).join('、')}方面表现优秀，可以尝试专家级任务。`,
      actionUrl: '/missions',
      priority: 50,
      rationale: buildSnapshotRecommendationRationale('snapshot-strong-dimension-challenge', 'direct', vector, factCount),
    });
  }

  // Sort by priority
  return dedupeRecommendations(
    recommendations.sort((a, b) => b.priority - a.priority)
  );
}

function buildSnapshotRecommendationRationale(
  reasonCode: string,
  evidenceRole: RecommendationRationale['evidenceRole'],
  vector: CompetencyVector,
  factCount: number
): RecommendationRationale {
  const confidenceValues = Object.values(vector)
    .map((dimension) => dimension.confidence)
    .filter((value) => Number.isFinite(value));
  const confidenceScore = confidenceValues.length
    ? roundTo(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length, 2)
    : 0;

  return {
    reasonCode,
    evidenceBasis: 'approved-snapshot',
    evidenceRole,
    contextOnly: evidenceRole === 'context',
    evidenceWindow: {
      firstStartedAt: null,
      lastStartedAt: null,
      daysCovered: 0,
    },
    evidenceCount: factCount,
    sourceCoverage: {
      LearningFact: factCount > 0 ? 'available' : 'missing',
      StudentCompetencySnapshot: 'available',
      StudentProfileSummary: 'missing',
    },
    confidence: {
      state: factCount > 0 ? 'ready' : 'missing',
      level: confidenceScore >= 0.75 ? 'high' : confidenceScore >= 0.45 ? 'medium' : 'low',
      score: confidenceScore,
      markers: factCount > 0 ? [] : ['missing-source'],
    },
  };
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

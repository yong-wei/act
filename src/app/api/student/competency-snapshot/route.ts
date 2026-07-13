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
  mapLegacyCompetencyDimensionToPortraitV2,
  PORTRAIT_V2_DIMENSIONS,
  type PortraitV2DimensionId,
} from '@/lib/data-governance/kaq-objective-taxonomy';
import {
  hasPortraitV2Evidence,
  resolvePrimaryPortraitV2,
  summarizePortraitV2,
} from '@/lib/data-governance/portrait-v2-consumer';
import type { PortraitV2ConsumerSummary } from '@/lib/data-governance/portrait-v2-consumer';
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
  currentSnapshot: {
    portrait: PortraitV2ConsumerSummary;
    legacyCompatibility: {
      authority: 'legacy-compatibility-only';
      source: string;
    };
    /** @deprecated Use portrait; retained only for legacy adapters. */
    vector: CompetencyVector;
    snapshotAt: string;
    factCount: number;
  };
  previousSnapshot: {
    vector: CompetencyVector;
    legacyCompatibility: {
      authority: 'legacy-compatibility-only';
    };
    snapshotAt: string;
  } | null;
  trendVector: TrendVector;
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

    const portraitResolution = await resolvePrimaryPortraitV2(prisma, userId, 'student', {
      legacySnapshot: currentSnapshot,
    });
    const portrait = summarizePortraitV2(portraitResolution.primaryPortrait);

    if (!currentSnapshot) {
      const hasPortraitV2Data = hasPortraitV2Evidence(portraitResolution.primaryPortrait);
      if (hasPortraitV2Data) {
        const currentVector = portraitResolution.legacyCompatibility.vector;
        const snapshotAt = portrait.generatedAt;
        const portraitFactCount = portrait.dimensions.reduce((sum, dimension) => sum + dimension.evidenceCount, 0);
        const recommendations = withPortraitRecommendationRationale(
          generateSnapshotRecommendations(currentVector, [], {}, portraitFactCount, portrait),
          portrait,
        );
        return NextResponse.json({
          currentSnapshot: {
            portrait,
            legacyCompatibility: {
              authority: 'legacy-compatibility-only',
              source: portraitResolution.legacyCompatibility.source,
            },
            vector: currentVector,
            snapshotAt,
            factCount: portraitFactCount,
          },
          previousSnapshot: null,
          trendVector: Object.fromEntries(
            Object.keys(currentVector).map((key) => [key, 'stable']),
          ) as unknown as TrendVector,
          evidenceSummary: mapEvidenceSummaryToPortrait({}),
          riskFlags: [],
          recommendations,
          diagnosis: materializeRoleBasedLearningDiagnosis({
            view: 'student',
            goalId: 'control-correction',
            userId,
            targetUserId: userId,
            diagnosisReportSnapshot: null,
          }),
        } satisfies StudentSnapshotResponse);
      }
      return NextResponse.json({
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
      } as unknown as StudentSnapshotResponse);
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
    const evidenceSummary = sanitizeEvidenceSummary(
      (currentSnapshot.evidenceSummary as unknown as Record<string, EvidenceSummaryItem[]>) || {}
    );
    const portraitEvidenceSummary = mapEvidenceSummaryToPortrait(evidenceSummary);

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
    // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: vector remains for trend and deprecated response compatibility only.
    const currentVector = currentSnapshot.competencyVector as unknown as CompetencyVector;
    const previousVector = previousSnapshot?.competencyVector as unknown as CompetencyVector | undefined;
    const trendVector = previousVector
      ? calculateTrendVector(currentVector, previousVector)
      : (Object.fromEntries(
          Object.keys(currentVector).map((k) => [k, 'stable'])
        ) as unknown as TrendVector);

    // Generate basic recommendations based on snapshot data
    const recommendations = withPortraitRecommendationRationale(
      generateSnapshotRecommendations(
        currentVector,
        riskFlags,
        evidenceSummary,
        currentSnapshot.factCount,
        portrait,
      ),
      portrait,
    );

    const response: StudentSnapshotResponse = {
      currentSnapshot: {
        portrait,
        legacyCompatibility: {
          authority: 'legacy-compatibility-only',
          source: portraitResolution.legacyCompatibility.source,
        },
        vector: currentVector,
        snapshotAt: currentSnapshot.snapshotAt.toISOString(),
        factCount: currentSnapshot.factCount,
      },
      previousSnapshot: previousSnapshot
        ? {
            vector: previousVector!,
            legacyCompatibility: {
              authority: 'legacy-compatibility-only',
            },
            snapshotAt: previousSnapshot.snapshotAt.toISOString(),
          }
        : null,
      trendVector,
      evidenceSummary: portraitEvidenceSummary,
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

function mapEvidenceSummaryToPortrait(
  summary: Record<string, EvidenceSummaryItem[]>,
): Record<string, EvidenceSummaryItem[]> {
  const legacyDimensions = [
    'controlModeling',
    'parameterDesign',
    'crossDomainTransfer',
    'engineeringDecision',
    'inquiryReflection',
    'selfDirectedLearning',
  ] as const;
  const portraitIds = new Set<PortraitV2DimensionId>(PORTRAIT_V2_DIMENSIONS.map((dimension) => dimension.id));
  const mapped = Object.fromEntries(
    PORTRAIT_V2_DIMENSIONS.map((dimension) => [dimension.id, [] as EvidenceSummaryItem[]]),
  ) as Record<PortraitV2DimensionId, EvidenceSummaryItem[]>;

  for (const [dimension, items] of Object.entries(summary)) {
    const targetDimensions = portraitIds.has(dimension as PortraitV2DimensionId)
      ? [dimension as PortraitV2DimensionId]
      : legacyDimensions.includes(dimension as (typeof legacyDimensions)[number])
        ? mapLegacyCompetencyDimensionToPortraitV2(dimension as (typeof legacyDimensions)[number]).targetDimensions
        : [];
    for (const targetDimension of targetDimensions) {
      mapped[targetDimension].push(...items);
    }
  }

  return mapped;
}

function truncateOptionalText(value: string | undefined, maxLength: number = 96) {
  if (typeof value !== 'string') return undefined;
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function withPortraitRecommendationRationale(
  recommendations: StudentSnapshotResponse['recommendations'],
  portrait: PortraitV2ConsumerSummary,
): StudentSnapshotResponse['recommendations'] {
  const weakPortrait = [...portrait.dimensions]
    .filter((dimension) => dimension.evidenceCount > 0)
    .sort((left, right) => left.score - right.score)[0]
    ?? [...portrait.dimensions].sort((left, right) => left.score - right.score)[0];

  return recommendations.map((recommendation) => ({
    ...recommendation,
    rationale: {
      ...recommendation.rationale,
      portraitV2: {
        dimensionIds: portrait.dimensions.map((dimension) => dimension.id),
        weakDimensionId: weakPortrait?.id ?? null,
        derivationKind: portrait.derivationKind,
        confidence: weakPortrait?.confidence ?? 0,
        freshness: weakPortrait?.freshness ?? { state: 'missing', asOf: null, evidenceAgeDays: null },
        limitations: portrait.limitations,
      },
    },
  }));
}

/**
 * Generate recommendations based on snapshot data
 */
function generateSnapshotRecommendations(
  vector: CompetencyVector,
  riskFlags: RiskFlag[],
  _evidenceSummary: Record<string, EvidenceSummaryItem[]>,
  factCount: number,
  portrait?: PortraitV2ConsumerSummary,
): StudentSnapshotResponse['recommendations'] {
  const recommendations: StudentSnapshotResponse['recommendations'] = [];

  // Find weakest dimensions
  const dimensions = portrait
    ? portrait.dimensions.map((dimension) => ({
        dimension: dimension.id,
        label: dimension.label,
        score: dimension.score,
      }))
    : Object.entries(vector).map(([key, value]) => ({ dimension: key, score: value.score, label: key }));
  const rankedDimensions = dimensions
    .filter((dimension) => portrait ? dimension.score > 0 || portrait.dimensions.some((item) => item.id === dimension.dimension && item.evidenceCount > 0) : true)
    .sort((a, b) => a.score - b.score);

  const weakestDimension = rankedDimensions[0] ?? dimensions[0];
  const secondWeakest = rankedDimensions[1];

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
          rationale: buildSnapshotRecommendationRationale('snapshot-risk-ai_misuse', 'risk', vector, factCount, portrait),
        });
        break;
      case 'constraint':
        recommendations.push({
          type: 'immediate',
          title: '强化工程约束意识',
          description: '仿真中多次忽视工程约束。建议在调整参数前明确安全边界。',
          actionUrl: '/simulations/destroyer',
          priority: 85,
          rationale: buildSnapshotRecommendationRationale('snapshot-risk-constraint', 'risk', vector, factCount, portrait),
        });
        break;
      case 'participation':
        recommendations.push({
          type: 'immediate',
          title: '增加学习活跃度',
          description: '近一周学习活跃度较低，建议每天保持至少30分钟的学习时间。',
          actionUrl: '/missions',
          priority: 95,
          rationale: buildSnapshotRecommendationRationale('snapshot-risk-participation', 'risk', vector, factCount, portrait),
        });
        break;
      case 'cross_domain':
        recommendations.push({
          type: 'immediate',
          title: '加强跨域知识联系',
          description: '单点知识掌握较好，但跨域迁移能力需要提升。',
          actionUrl: '/interactive-learning',
          priority: 80,
          rationale: buildSnapshotRecommendationRationale('snapshot-risk-cross_domain', 'risk', vector, factCount, portrait),
        });
        break;
    }
  }

  // Weekly recommendations based on weak dimensions
  if (weakestDimension.score < 60) {
    recommendations.push({
      type: 'weekly',
      title: `提升${weakestDimension.label}能力`,
      description: `这是你的薄弱领域（${Math.round(weakestDimension.score)}分），建议本周重点练习相关任务。`,
      actionUrl: '/missions',
      priority: 70,
      rationale: buildSnapshotRecommendationRationale('snapshot-weak-dimension', 'direct', vector, factCount, portrait),
    });
  }

  if (secondWeakest && secondWeakest.score < 65) {
    recommendations.push({
      type: 'weekly',
      title: '巩固基础能力',
      description: '多维度能力有待提升，建议系统复习基础知识。',
      actionUrl: '/knowledge',
      priority: 60,
      rationale: buildSnapshotRecommendationRationale('snapshot-foundation-review', 'direct', vector, factCount, portrait),
    });
  }

  // Challenge recommendations
  const strongDimensions = dimensions.filter((d) => d.score > 75);
  if (strongDimensions.length > 0) {
    recommendations.push({
      type: 'challenge',
      title: '挑战高难度任务',
      description: `你在${strongDimensions.map((d) => d.label).join('、')}方面表现优秀，可以尝试专家级任务。`,
      actionUrl: '/missions',
      priority: 50,
      rationale: buildSnapshotRecommendationRationale('snapshot-strong-dimension-challenge', 'direct', vector, factCount, portrait),
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
  factCount: number,
  portrait?: PortraitV2ConsumerSummary,
): RecommendationRationale {
  const confidenceValues = portrait
    ? portrait.dimensions.map((dimension) => dimension.confidence)
    : Object.values(vector).map((dimension) => dimension.confidence)
    .filter((value) => Number.isFinite(value));
  const confidenceScore = confidenceValues.length
    ? roundTo(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length, 2)
    : 0;

  const weakDimension = portrait
    ? [...portrait.dimensions]
      .filter((dimension) => dimension.evidenceCount > 0)
      .sort((left, right) => left.score - right.score)[0]
    : null;

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
    ...(portrait ? {
      portraitV2: {
        dimensionIds: portrait.dimensions.map((dimension) => dimension.id),
        weakDimensionId: weakDimension?.id ?? null,
        derivationKind: portrait.derivationKind,
        confidence: weakDimension?.confidence ?? 0,
        freshness: weakDimension?.freshness ?? { state: 'missing', asOf: null, evidenceAgeDays: null },
        limitations: portrait.limitations,
      },
    } : {}),
  };
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

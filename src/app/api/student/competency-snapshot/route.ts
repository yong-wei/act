/**
 * Canonical cumulative student portrait API.
 */

import { NextRequest, NextResponse } from 'next/server';

import {
  isAuthoritativeConsumerRead,
  isConsumerUnauthorized,
  readStudentEvidencePort,
} from '@/features/learning-record/consumers/public-api';
import { getServerAuthSession } from '@/lib/auth';
import type { CumulativePortraitReadModel } from '@/lib/data-governance/cumulative-portrait-read-model';
import { summarizePortraitV2 } from '@/lib/data-governance/portrait-v2-consumer';
import type { PortraitV2ProjectedPayload } from '@/lib/data-governance/portrait-v2-model';
import type {
  RoleBasedLearningDiagnosis,
  RoleBasedLearningDiagnosisClaim,
  RoleBasedLearningDiagnosisEvidenceRef,
} from '@/features/personalization/diagnosis/role-based-learning-diagnosis';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type SafeRisk = CumulativePortraitReadModel['lastRisk'][number] & {
  description: string;
};

export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const searchParams = new URL(request.url).searchParams;
    if (searchParams.has('timeRange')) {
      return NextResponse.json({
        error: 'unsupported-scope',
        scope: searchParams.get('timeRange') ?? '',
      }, { status: 400 });
    }

    const evidence = await readStudentEvidencePort({
      db: prisma,
      viewer: { role: 'student', subjectUserId: session.user.id },
      targetUserId: session.user.id,
    });
    const state = evidence.portrait;
    if (state.stateKind !== 'SNAPSHOT' || !state.payload) {
      return NextResponse.json({
        derivationState: evidence.reason ?? state.availabilityReason,
        evidenceState: evidence.knownZero || state.stateKind === 'NO_EVIDENCE' ? 'empty' : 'unavailable',
        availabilityReason: state.availabilityReason,
        projectionStatus: evidence.status,
        projectionReason: evidence.reason,
        knownZero: evidence.knownZero,
        currentSnapshot: null,
        previousSnapshot: null,
        trendVector: null,
        lastTrend: state.lastTrend,
        evidenceSummary: {},
        riskFlags: state.lastRisk.map(toSafeRisk),
        recommendations: [],
        diagnosis: null,
      });
    }

    const labeledCurrent = isAuthoritativeConsumerRead(evidence);
    const portrait = summarizePortraitV2(state.payload);
    const riskFlags = state.lastRisk.map(toSafeRisk);
    return NextResponse.json({
      derivationState: labeledCurrent ? 'current' : (evidence.reason ?? state.availabilityReason),
      evidenceState: labeledCurrent ? 'current' : evidence.status,
      availabilityReason: state.availabilityReason,
      projectionStatus: evidence.status,
      projectionReason: evidence.reason,
      knownZero: evidence.knownZero,
      provenanceRevision: evidence.read.fields.provenanceRevision,
      currentSnapshot: {
        portrait,
        snapshotAt: state.generatedAt,
        overallScore: state.overallScore,
        dimensionCoverage: state.dimensionCoverage,
        evidenceAsOf: state.evidenceAsOf,
        confidence: state.confidence,
        factCount: portrait.dimensions.reduce(
          (total, dimension) => total + dimension.evidenceCount,
          0,
        ),
      },
      previousSnapshot: null,
      trendVector: null,
      lastTrend: state.lastTrend,
      evidenceSummary: buildSafeEvidenceSummary(state),
      riskFlags,
      recommendations: buildRecommendations(state),
      diagnosis: withCumulativeStaleness(buildCumulativeDiagnosis(state), labeledCurrent, evidence.status),
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (isConsumerUnauthorized(error)) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }
    console.error('[StudentSnapshot] Error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

function toSafeRisk(
  risk: CumulativePortraitReadModel['lastRisk'][number],
): SafeRisk {
  const descriptions = {
    constraint: '累计学习证据显示工程约束处理需要关注。',
    stagnation: '连续累计能力状态显示能力提升停滞。',
    cross_domain: '累计学习证据显示跨域迁移能力需要关注。',
  } as const;
  return {
    ...risk,
    description: descriptions[risk.type],
  };
}

function buildSafeEvidenceSummary(state: CumulativePortraitReadModel) {
  if (!state.payload) return {};
  return Object.fromEntries(state.payload.dimensions.map((dimension) => [
    dimension.id,
    dimension.evidenceSummary.totalCount === 0
      ? []
      : [{
          factType: 'governed-cumulative-summary',
          outcome: 'cumulative',
          score: dimension.score,
          evidenceTitle: `${dimension.label}累计证据 ${dimension.evidenceSummary.totalCount} 条`,
        }],
  ]));
}

function buildRecommendations(state: CumulativePortraitReadModel) {
  if (!state.payload) return [];
  // 正式互动课程目录是已验证的学生学习入口（Issue #1930）：无法定位
  // 具体课程/资源时默认进入目录自选，不臆造任务、不返回空地址。
  const formalLearningEntry = '/interactive-learning/courses';
  const recommendations: Array<{
    type: 'immediate' | 'weekly';
    title: string;
    description: string;
    priority: number;
    actionUrl: string;
  }> = state.lastRisk.map((risk) => ({
    type: 'immediate',
    title: risk.type === 'constraint'
      ? '复核工程约束'
      : risk.type === 'stagnation'
        ? '回顾累计证据变化'
        : '加强跨域迁移练习',
    description: toSafeRisk(risk).description,
    priority: risk.severity === 'high' ? 90 : risk.severity === 'medium' ? 70 : 50,
    actionUrl: formalLearningEntry,
  }));
  const weakest = state.payload.dimensions
    .filter((dimension) => dimension.evidenceSummary.totalCount > 0)
    .sort((left, right) => left.score - right.score)[0];
  if (weakest) {
    recommendations.push({
      type: 'weekly',
      title: `巩固${weakest.label}`,
      description: '根据已有累计学习证据继续完成对应能力练习。',
      priority: 40,
      actionUrl: formalLearningEntry,
    });
  }
  return recommendations;
}

/** 累计画像陈旧时（之后有更新的学习证据）诊断继承显式限制，不伪装就绪（Issue #2010）。 */
function withCumulativeStaleness(
  diagnosis: RoleBasedLearningDiagnosis | null,
  labeledCurrent: boolean,
  portStatus: string,
): RoleBasedLearningDiagnosis | null {
  if (!diagnosis || labeledCurrent || portStatus !== 'stale') return diagnosis;
  return {
    ...diagnosis,
    limitations: [
      ...diagnosis.limitations,
      {
        reason: 'stale-evidence' as const,
        detail: '累计画像之后有更新的学习证据，诊断结论待重新聚合。',
      },
    ],
  };
}

function buildCumulativeDiagnosis(
  state: CumulativePortraitReadModel,
): RoleBasedLearningDiagnosis | null {
  if (!state.payload || !state.generatedAt) return null;
  const generatedAt = state.generatedAt;
  const claims: RoleBasedLearningDiagnosisClaim[] = state.payload.dimensions.map((dimension) => {
    const evidenceCount = dimension.evidenceSummary.totalCount;
    const judgment = evidenceCount === 0
      ? 'insufficient-evidence'
      : dimension.score < 65
        ? 'needs-attention'
        : dimension.score < 82
          ? 'developing'
          : 'stable';
    const confidenceState = evidenceCount === 0
      ? 'none'
      : dimension.confidence >= 0.8
        ? 'high'
        : dimension.confidence >= 0.5
          ? 'medium'
          : 'low';
    return {
      id: `cumulative:${dimension.id}`,
      dimensionId: dimension.id,
      judgment,
      studentExplanation: evidenceCount === 0
        ? `${dimension.label}尚无合格累计证据。`
        : `${dimension.label}累计得分为 ${Math.round(dimension.score)} 分。`,
      rootCause: evidenceCount === 0
        ? '该维度尚无合格累计证据。'
        : '该结论来自当前规范累计画像。',
      // 学生安全的证据引用（Issue #2010）：来自同一受治理累计画像读模型的
      // 维度级摘要——只有条数、截止与固定入口，不投影原始答案、事件载荷
      // 或 sourceLineage 引用值。
      evidenceRefs: evidenceCount > 0
        ? [buildCumulativeEvidenceRef(dimension, confidenceState)]
        : [],
      sourceCoverage: {
        LearningFact: evidenceCount > 0 ? 'available' : 'missing',
      },
      metrics: {
        score: evidenceCount > 0 ? dimension.score : null,
        percentile: unavailablePercentile(),
        growthPercentile: unavailablePercentile(),
      },
      confidence: {
        state: confidenceState,
        score: dimension.confidence,
        evidenceCount,
        sourceCompleteness: evidenceCount > 0 ? 1 : 0,
      },
      evidenceWindow: {
        generatedAt,
        sourceLastUpdatedAt: dimension.freshness.asOf,
        stale: false,
      },
      limitations: evidenceCount > 0
        ? []
        : [{ reason: 'missing-dimension-evidence', detail: '该维度尚无合格累计证据。' }],
      nextActions: [{
        kind: 'learning-path',
        label: '继续学习',
        href: '/interactive-learning/courses',
      }],
      privacyClass: 'student-visible',
      materializationVersion: 'role-based-learning-diagnosis.v1',
    };
  });
  return {
    version: 'role-based-learning-diagnosis.v1',
    view: 'student',
    goalId: 'cumulative-portrait-overall',
    generatedAt,
    materialization: {
      version: 'role-based-learning-diagnosis.v1',
      inputs: ['canonical-cumulative-portrait'],
      refresh: 'on-evidence-change-or-request',
    },
    claims,
    limitations: claims.flatMap((claim) => claim.limitations),
    rootCauseClusters: [],
    drilldownRefs: [],
    auditRefs: [],
    redactionPolicy: {
      rawPayloads: 'omitted',
      ordinaryViews: 'redacted-summaries-only',
    },
  };
}

function buildCumulativeEvidenceRef(
  dimension: PortraitV2ProjectedPayload['dimensions'][number],
  confidenceState: 'high' | 'medium' | 'low' | 'none',
): RoleBasedLearningDiagnosisEvidenceRef {
  const chunkId = `cumulative-portrait:${dimension.id}`;
  const asOf = dimension.freshness.asOf
    ? new Date(dimension.freshness.asOf).toLocaleDateString('zh-CN')
    : '未知';
  const displayTitle = `${dimension.label}累计证据摘要`;
  const capsule = `累计 ${dimension.evidenceSummary.totalCount} 条合格学习证据，证据截至 ${asOf}。`;
  return {
    chunkId,
    sourceType: 'diagnosis',
    displayTitle,
    displayHref: '/profile/evidence',
    confidence: confidenceState,
    capsule,
    citationChip: {
      chunkId,
      displayTitle,
      displayHref: '/profile/evidence',
      sourceType: 'diagnosis',
      authorityLevel: 'learner-evidence',
      confidence: confidenceState,
      freshnessBucket: toCitationFreshnessBucket(dimension.freshness.state),
      privacyVisibility: 'redacted',
      limitationState: null,
    },
  };
}

function toCitationFreshnessBucket(state: 'current' | 'partial' | 'stale' | 'missing') {
  if (state === 'current') return 'current' as const;
  if (state === 'partial') return 'recent' as const;
  if (state === 'stale') return 'stale' as const;
  return 'expired' as const;
}

function unavailablePercentile() {
  return {
    state: 'unavailable' as const,
    percentile: null,
    sampleSize: 0,
    fallback: 'cold-start' as const,
  };
}

import type { AdaptiveLearnerState } from '@/lib/data-governance/adaptive-learner-state-service';
import type { StudentEvidenceCoverageState } from '@/lib/data-governance/student-evidence-feature-cache';

export type AiWorkshopEvidenceStatus = 'available' | 'empty' | 'unavailable';
export type AiWorkshopEvidenceReadState = 'ready' | 'stale' | 'missing' | 'unavailable';

export const AI_WORKSHOP_EVIDENCE_SOURCE_KEYS = [
  'learningActivity',
  'competencySnapshot',
  'portraitSnapshot',
  'profileSummary',
] as const;

export type AiWorkshopEvidenceSourceKey = typeof AI_WORKSHOP_EVIDENCE_SOURCE_KEYS[number];

type AiWorkshopEvidenceSourceCoverage = Record<
  AiWorkshopEvidenceSourceKey,
  StudentEvidenceCoverageState
>;

export interface AiWorkshopEvidenceProjection {
  authority: 'server-owned';
  generatedAt: string;
  status: AiWorkshopEvidenceStatus;
  evidence: {
    count: number;
    readState: AiWorkshopEvidenceReadState;
    sourceCoverage: AiWorkshopEvidenceSourceCoverage;
    confidence: {
      level: 'none' | 'low' | 'medium' | 'high';
      score: number;
      sourceCompleteness: number;
    };
  };
  portrait: {
    state: AiWorkshopEvidenceStatus;
    availability: string;
  };
  path: {
    activeCount: number;
    status: string | null;
    currentNodeId: string | null;
  };
  limitations: string[];
}

export function createUnavailableAiWorkshopEvidence(
  generatedAt = new Date().toISOString(),
): AiWorkshopEvidenceProjection {
  return {
    authority: 'server-owned',
    generatedAt,
    status: 'unavailable',
    evidence: {
      count: 0,
      readState: 'unavailable',
      sourceCoverage: emptySourceCoverage('missing'),
      confidence: { level: 'none', score: 0, sourceCompleteness: 0 },
    },
    portrait: { state: 'unavailable', availability: 'service-unavailable' },
    path: { activeCount: 0, status: null, currentNodeId: null },
    limitations: ['当前学习画像服务暂时不可用，请稍后重试。'],
  };
}

type WorkshopEvidenceSource = Pick<
  AdaptiveLearnerState,
  'generatedAt' | 'authority' | 'primaryPortraitState' | 'primaryPortraitAvailability' | 'pathContext' | 'evidence' | 'missingEvidence'
>;

export function projectAiWorkshopEvidence(
  state: WorkshopEvidenceSource,
): AiWorkshopEvidenceProjection {
  const evidenceCount = state.evidence.confidence.evidenceCount;
  const portraitState = state.primaryPortraitState === 'SNAPSHOT'
    ? 'available'
    : state.primaryPortraitState === 'NO_EVIDENCE'
      ? 'empty'
      : 'unavailable';
  const status = portraitState === 'unavailable'
    ? 'unavailable'
    : evidenceCount > 0 || portraitState === 'available'
      ? 'available'
      : 'empty';

  return {
    authority: state.authority,
    generatedAt: state.generatedAt,
    status,
    evidence: {
      count: evidenceCount,
      readState: state.evidence.readState,
      sourceCoverage: projectSourceCoverage(state.evidence.sourceCoverage),
      confidence: {
        level: state.evidence.confidence.level,
        score: state.evidence.confidence.score,
        sourceCompleteness: state.evidence.confidence.sourceCompleteness,
      },
    },
    portrait: {
      state: portraitState,
      availability: state.primaryPortraitAvailability,
    },
    path: {
      activeCount: state.pathContext.activePathCount,
      status: state.pathContext.activeControlCorrectionPath.status,
      currentNodeId: state.pathContext.activeControlCorrectionPath.currentNodeId,
    },
    limitations: buildLimitations(state, status),
  };
}

function buildLimitations(
  state: WorkshopEvidenceSource,
  status: AiWorkshopEvidenceStatus,
): string[] {
  const limitations: string[] = [];

  if (status === 'unavailable') {
    limitations.push('当前学习画像服务暂时不可用，请稍后重试。');
  }
  if (status === 'empty') {
    limitations.push('当前没有已验证的学习记录，完成一次学习活动后这里会逐步形成个人数据。');
  }
  if (state.evidence.readState === 'stale' || state.evidence.statusMarkers.includes('stale')) {
    limitations.push('学习证据需要更新，当前个性化结果可能不完整。');
  }
  if (state.evidence.readState === 'missing') {
    limitations.push('当前学习证据缓存尚未建立，证据指标暂不能形成个人结论。');
  }
  if (state.evidence.statusMarkers.includes('partial')) {
    limitations.push('当前学习证据覆盖不完整，部分内容暂不能形成个人结论。');
  }
  if (state.evidence.statusMarkers.includes('low-confidence')) {
    limitations.push('当前个性化置信度较低，建议继续完成相关学习活动。');
  }
  if (status !== 'unavailable' && state.missingEvidence.length > 0 && limitations.length === 0) {
    limitations.push('仍有部分学习证据待补充，继续学习可提高个性化支持质量。');
  }

  return limitations;
}

function projectSourceCoverage(
  sourceCoverage: Record<string, StudentEvidenceCoverageState>,
): AiWorkshopEvidenceSourceCoverage {
  return {
    learningActivity: sourceCoverage.LearningFact ?? sourceCoverage.assessment ?? 'missing',
    competencySnapshot: sourceCoverage.StudentCompetencySnapshot ?? sourceCoverage.competencySnapshot ?? 'missing',
    portraitSnapshot: sourceCoverage.StudentPortraitV2Snapshot ?? sourceCoverage.portraitSnapshot ?? 'missing',
    profileSummary: sourceCoverage.StudentProfileSummary ?? sourceCoverage.profileSummary ?? 'missing',
  };
}

function emptySourceCoverage(state: StudentEvidenceCoverageState): AiWorkshopEvidenceSourceCoverage {
  return Object.fromEntries(
    AI_WORKSHOP_EVIDENCE_SOURCE_KEYS.map((key) => [key, state]),
  ) as AiWorkshopEvidenceSourceCoverage;
}

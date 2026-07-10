import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildGraphCenterPayload,
} from '../graph-center';
import {
  ADAPTIVE_LEARNER_STATE_FEATURE_FLAG,
  ADAPTIVE_LEARNER_STATE_FIELD_CONTRACTS,
  ADAPTIVE_LEARNER_STATE_PAYLOAD_VERSION,
  type AdaptiveLearnerSecondaryDimension,
  type AdaptiveLearnerState,
} from '../adaptive-learner-state-service';
import { createEmptyCompetencyVector, type CompetencyDimension, type CompetencyVector } from '../competency-model';
import {
  derivePortraitV2Compatibility,
  projectPortraitV2ForConsumer,
} from '../portrait-v2-model';
import {
  createLearningEvidenceCorpusChunk,
  validateLearningEvidenceCorpusChunk,
  type LearningEvidenceCorpusChunk,
} from '../learning-evidence-rag-corpus';
import { createTeacherKaqEvidenceTracePayload } from '../teacher-kaq-evidence-trace';
import { buildKaqArtifactVersionRefs } from '../../kaq-artifact-versioning';

const teacherTracePageSource = readFileSync(
  join(process.cwd(), 'src/app/teacher/classes/[classId]/kaq-evidence-trace/page.tsx'),
  'utf8',
);
const teacherAnalyticsSource = readFileSync(
  join(process.cwd(), 'src/app/teacher/classes/[classId]/analytics-v2/page.tsx'),
  'utf8',
);
const teacherTraceServerSource = readFileSync(
  join(process.cwd(), 'src/lib/data-governance/teacher-kaq-evidence-trace-server.ts'),
  'utf8',
);
const graphCenterPageSource = readFileSync(
  join(process.cwd(), 'src/app/graph-center/page.tsx'),
  'utf8',
);

describe('teacher K/A/Q evidence trace payload', () => {
  it('projects a teacher-safe node trace with SAR evidence, gaps, candidates, and return links', () => {
    const graphPayload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      viewerRole: 'TEACHER',
	      classOverlay: {
	        classId: 'class-1',
	        viewerRole: 'teacher',
	        authorized: true,
	        learnerStates: classOverlayLearnerStates(),
	      },
      sarAssociation: {
        enabled: true,
        classId: 'class-1',
        trustedScope: true,
      },
      evidenceCorpus: [
        teacherVisibleChunk({
          id: 'chunk-teacher-safe',
          classId: 'class-1',
          knowledgeNodeRefs: ['串联校正_6_fede5751'],
          redactedSummary: '班级在串联校正参数选择上证据不足。',
        }),
      ],
    });

    const payload = createTeacherKaqEvidenceTracePayload({
      classInfo: { id: 'class-1', name: '自动控制 1 班', code: 'ABC123' },
      graphPayload,
      query: { nodeId: 'kn:autocontrol:controller-correction' },
    });

    expect(payload.selection.nodeFound).toBe(true);
    expect(payload.node?.id).toBe('kn:autocontrol:controller-correction');
    expect(payload.sarTrace.status).toBe('available');
    expect(payload.sarTrace.topEvents.map((event) => event.safeSummary)).toContain('班级在串联校正参数选择上证据不足。');
    expect(payload.sarTrace.topEvents.find((event) => event.safeSummary === '班级在串联校正参数选择上证据不足。')?.authorityLevel)
      .toBe('teacher-approved');
    expect(payload.resourceGaps.map((gap) => gap.type)).toContain('citation-ready-resource');
    expect(payload.candidateResources.length).toBeGreaterThan(0);
    expect(payload.returnLinks.map((link) => link.id)).toEqual(expect.arrayContaining([
      'class-analytics',
      'graph-center',
      'resource-governance',
    ]));
  });

  it('does not serialize raw learner answers, private memory, hidden Arena internals, or audit-only refs', () => {
    const graphPayload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      viewerRole: 'TEACHER',
	      classOverlay: {
	        classId: 'class-1',
	        viewerRole: 'teacher',
	        authorized: true,
	        learnerStates: classOverlayLearnerStates(),
	      },
      sarAssociation: {
        enabled: true,
        classId: 'class-1',
        trustedScope: true,
      },
      evidenceCorpus: [
        teacherVisibleChunk({
          id: 'chunk-private-raw',
          classId: 'class-1',
          knowledgeNodeRefs: ['串联校正_6_fede5751'],
          rawText: 'RAW_LEARNER_ANSWER hidden Arena score private Konling memory',
          redactedSummary: '教师可见的安全证据摘要。',
        }),
        teacherVisibleChunk({
          id: 'chunk-other-class',
          classId: 'class-2',
          knowledgeNodeRefs: ['串联校正_6_fede5751'],
          rawText: 'CROSS_CLASS_RAW_ANSWER',
          redactedSummary: '跨班级证据不应出现。',
        }),
      ],
    });

    const payload = createTeacherKaqEvidenceTracePayload({
      classInfo: { id: 'class-1', name: '自动控制 1 班' },
      graphPayload,
      query: { nodeId: 'kn:autocontrol:controller-correction' },
    });
    const serialized = JSON.stringify(payload);

    expect(serialized).toContain('教师可见的安全证据摘要。');
    expect(serialized).not.toContain('RAW_LEARNER_ANSWER');
    expect(serialized).not.toContain('hidden Arena score');
    expect(serialized).not.toContain('private Konling memory');
    expect(serialized).not.toContain('CROSS_CLASS_RAW_ANSWER');
    expect(serialized).not.toContain('跨班级证据不应出现');
  });

  it('preserves a missing-node state instead of silently showing another node', () => {
    const graphPayload = buildGraphCenterPayload({
      domain: 'quality',
      selectedNodeId: 'kn:autocontrol:controller-correction',
      viewerRole: 'TEACHER',
      sarAssociation: {
        enabled: true,
        classId: 'class-1',
        trustedScope: true,
      },
    });

    const payload = createTeacherKaqEvidenceTracePayload({
      classInfo: { id: 'class-1', name: '自动控制 1 班' },
      graphPayload,
      query: { nodeId: 'kn:autocontrol:controller-correction' },
    });

    expect(payload.selection.nodeFound).toBe(false);
    expect(payload.node).toBeNull();
    expect(payload.limitations).toContain('requested-node-not-found');
    expect(payload.sarTrace.status).toBe('unavailable');
  });

  it('wires the teacher page and class analytics entry point', () => {
    expect(teacherTracePageSource).toContain('data-teacher-kaq-evidence-trace="surface"');
    expect(teacherTracePageSource).toContain('data-teacher-kaq-evidence-panel={marker}');
    expect(teacherTracePageSource).toContain('data-teacher-kaq-evidence-return-link={link.id}');
    expect(teacherAnalyticsSource).toContain('data-teacher-kaq-evidence-trace-entry="graph-center-context"');
    expect(teacherAnalyticsSource).toContain('/kaq-evidence-trace?domain=');
    expect(teacherAnalyticsSource).toContain('resolveGraphCenterTraceDomain');
    expect(teacherTraceServerSource).toContain('trustedScope: true');
    expect(graphCenterPageSource).not.toContain('trustedScope: true');
  });
});

const SECONDARY_DIMENSION_PRIMARY: Record<AdaptiveLearnerSecondaryDimension, CompetencyDimension> = {
  conceptMastery: 'controlModeling',
  timeFrequencyTransfer: 'crossDomainTransfer',
  modelingReliability: 'controlModeling',
  tuningEfficiency: 'parameterDesign',
  constrainedOptimization: 'parameterDesign',
  solutionStability: 'engineeringDecision',
  crossModalTransfer: 'crossDomainTransfer',
  scenarioGeneralization: 'crossDomainTransfer',
  riskRecognition: 'engineeringDecision',
  constraintCompliance: 'engineeringDecision',
  explanationQuality: 'inquiryReflection',
  aiUseStrategy: 'inquiryReflection',
  reflectionDepth: 'inquiryReflection',
  pathExecution: 'selfDirectedLearning',
  persistence: 'selfDirectedLearning',
  remedialInitiative: 'selfDirectedLearning',
};

function secondaryDimension(
  vector: CompetencyVector,
  primaryDimension: CompetencyDimension,
): AdaptiveLearnerState['secondaryDimensions'][AdaptiveLearnerSecondaryDimension] {
  const primary = vector[primaryDimension];
  return {
    primaryDimension,
    value: primary.score,
    confidence: primary.confidence,
    evidenceCount: primary.evidenceCount,
    source: 'primary-competency-derived',
  };
}

function buildSecondaryDimensions(vector: CompetencyVector): AdaptiveLearnerState['secondaryDimensions'] {
  return {
    conceptMastery: secondaryDimension(vector, SECONDARY_DIMENSION_PRIMARY.conceptMastery),
    timeFrequencyTransfer: secondaryDimension(vector, SECONDARY_DIMENSION_PRIMARY.timeFrequencyTransfer),
    modelingReliability: secondaryDimension(vector, SECONDARY_DIMENSION_PRIMARY.modelingReliability),
    tuningEfficiency: secondaryDimension(vector, SECONDARY_DIMENSION_PRIMARY.tuningEfficiency),
    constrainedOptimization: secondaryDimension(vector, SECONDARY_DIMENSION_PRIMARY.constrainedOptimization),
    solutionStability: secondaryDimension(vector, SECONDARY_DIMENSION_PRIMARY.solutionStability),
    crossModalTransfer: secondaryDimension(vector, SECONDARY_DIMENSION_PRIMARY.crossModalTransfer),
    scenarioGeneralization: secondaryDimension(vector, SECONDARY_DIMENSION_PRIMARY.scenarioGeneralization),
    riskRecognition: secondaryDimension(vector, SECONDARY_DIMENSION_PRIMARY.riskRecognition),
    constraintCompliance: secondaryDimension(vector, SECONDARY_DIMENSION_PRIMARY.constraintCompliance),
    explanationQuality: secondaryDimension(vector, SECONDARY_DIMENSION_PRIMARY.explanationQuality),
    aiUseStrategy: secondaryDimension(vector, SECONDARY_DIMENSION_PRIMARY.aiUseStrategy),
    reflectionDepth: secondaryDimension(vector, SECONDARY_DIMENSION_PRIMARY.reflectionDepth),
    pathExecution: secondaryDimension(vector, SECONDARY_DIMENSION_PRIMARY.pathExecution),
    persistence: secondaryDimension(vector, SECONDARY_DIMENSION_PRIMARY.persistence),
    remedialInitiative: secondaryDimension(vector, SECONDARY_DIMENSION_PRIMARY.remedialInitiative),
  };
}

function classOverlayLearnerStates(): AdaptiveLearnerState[] {
  return [1, 2, 3, 4, 5].map((index) => {
    const vector = createEmptyCompetencyVector();
    return {
      userId: `learner-${index}`,
      payloadVersion: ADAPTIVE_LEARNER_STATE_PAYLOAD_VERSION,
      roleScope: {
        role: 'student',
        classId: 'class-1',
        privacyScopes: ['student-visible'],
      },
      generatedAt: '2026-06-21T00:00:00.000Z',
      authority: 'server-owned',
      featureFlag: {
        name: ADAPTIVE_LEARNER_STATE_FEATURE_FLAG,
        enabled: true,
        fallback: 'legacy-profile-summary-and-recommendation-consumers',
      },
      clientHints: {
        received: false,
        authoritative: false,
        reason: 'client-hints-non-authoritative',
      },
      primaryPortrait: projectPortraitV2ForConsumer(
        derivePortraitV2Compatibility({
          userId: `learner-${index}`,
          snapshotAt: '2026-06-21T00:00:00.000Z',
          vector,
        }),
        'student',
      ),
      primaryCompetencies: {
        authority: 'legacy-compatibility-only',
        source: 'fallback-empty',
        vector,
      },
      secondaryDimensions: buildSecondaryDimensions(vector),
      knowledgeMastery: {
        coverage: 'available',
        tags: {
          'kn:autocontrol:controller-correction': {
            posteriorMastery: 0.6 + index * 0.05,
            confidence: 0.8,
            evidenceCount: 3,
            source: 'adaptive-assessment',
            algorithmVersion: 'test',
            lastUpdatedAt: '2026-06-20T00:00:00.000Z',
            supportingEvidenceRefs: [],
            sourceCoverage: {
              AdaptiveMasteryUpdate: 'available',
              LearningFact: 'available',
              ArenaSubmission: 'missing',
              AgentToolRun: 'missing',
              StudentEvidenceFeatureCache: 'available',
            },
          },
        },
      },
      masteryTraceability: {
        knowledgeTargets: {
          'kn:autocontrol:controller-correction': {
            targetId: 'kn:autocontrol:controller-correction',
            targetKind: 'knowledge',
            masteryLevel: 0.6 + index * 0.05,
            confidence: 0.8,
            freshness: 'current',
            supportingEvidenceRefs: [],
            sourceCoverage: {
              AdaptiveMasteryUpdate: 'available',
              LearningFact: 'available',
              ArenaSubmission: 'missing',
              AgentToolRun: 'missing',
              StudentEvidenceFeatureCache: 'available',
            },
            limitations: [],
          },
        },
        capabilityTargets: {},
      },
      resourcePreference: {
        preferredModalities: [],
        sourceCounts: {},
        confidence: 'none',
      },
      mediaAbsorption: {
        mediaFactCount: 0,
        averageCompletion: null,
        confidence: 'none',
      },
      pathContext: {
        activePathCount: 0,
        bookmarkedPathCount: 0,
        recentPathIds: [],
        activeControlCorrectionPath: {
          state: 'none',
          pathId: null,
          status: null,
          currentNodeId: null,
          terminalValidationState: null,
          lowConfidenceMarkers: [],
        },
        statusMarkers: ['missing'],
      },
      risks: {
        riskLevel: 'none',
        activeFlags: [],
      },
      assessmentState: {
        latestAbilityEstimate: null,
      },
      evidence: {
        readState: 'ready',
        evidenceWindow: {
          firstStartedAt: '2026-06-20T00:00:00.000Z',
          lastStartedAt: '2026-06-20T00:00:00.000Z',
          daysCovered: 1,
        },
        sourceCounts: {},
        sourceCoverage: {},
        confidence: {
          level: 'high',
          score: 0.8,
          evidenceCount: 3,
          sourceCompleteness: 1,
        },
        statusMarkers: [],
      },
      prerequisiteFeatureGroups: {
        simulationArena: null,
        pathExecution: null,
      },
      fieldContracts: ADAPTIVE_LEARNER_STATE_FIELD_CONTRACTS,
      missingEvidence: [],
    };
  });
}

function teacherVisibleChunk(input: {
  id: string;
  classId: string;
  knowledgeNodeRefs: string[];
  redactedSummary: string;
  rawText?: string;
}): LearningEvidenceCorpusChunk {
  const chunk = createLearningEvidenceCorpusChunk({
    id: input.id,
    family: 'report',
    sourceType: 'teacher-report',
    sourceRef: {
      id: input.id,
      ownerUserId: null,
      classId: input.classId,
      goalId: 'teacher-kaq-evidence-trace',
      resourceId: input.id,
    },
    spanRef: { kind: 'text-range', start: 0, end: 20, locator: 'teacher-trace' },
    display: {
      title: input.id,
      href: `/teacher/evidence/${input.id}`,
      capsule: 'Teacher evidence fixture.',
    },
    content: {
      text: input.rawText ?? null,
      redactedSummary: input.redactedSummary,
      hash: `${input.id}:hash`,
    },
    resourceProjection: {
      resourceId: input.id,
      segmentRef: `${input.id}:segment`,
      citationTargetRef: null,
      knowledgeNodeRefs: input.knowledgeNodeRefs,
      capabilityTargetRefs: [],
      contentHash: `${input.id}:hash`,
      versionRefs: buildKaqArtifactVersionRefs(),
    },
    privacyClass: 'teacher-visible',
    confidence: 'high',
    freshness: {
      indexedAt: '2026-07-02T00:00:00.000Z',
      sourceUpdatedAt: '2026-07-02T00:00:00.000Z',
      expiresAt: null,
      stale: false,
    },
    authority: {
      level: 'teacher-authored',
      knowledgeTags: input.knowledgeNodeRefs,
      pageAnchor: 'teacher-trace',
      freshnessBucket: 'current',
      scopeRule: {
        visibility: 'teacher-visible',
        allowedRoles: ['teacher', 'admin'],
        ownerRequired: false,
        classRequired: true,
      },
      conflictGroup: null,
      conflictSignal: null,
    },
    retrieval: {
      tags: input.knowledgeNodeRefs,
      goals: ['teacher-kaq-evidence-trace'],
      useCases: ['teacher-report'],
    },
  });
  expect(validateLearningEvidenceCorpusChunk(chunk)).toEqual([]);
  return chunk;
}

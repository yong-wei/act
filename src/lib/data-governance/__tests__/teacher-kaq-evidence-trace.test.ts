import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildGraphCenterPayload,
} from '../graph-center';
import { createLearningEvidenceCorpusChunk, type LearningEvidenceCorpusChunk } from '../learning-evidence-rag-corpus';
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

function classOverlayLearnerStates() {
  return [1, 2, 3, 4, 5].map((index) => ({
    userId: `learner-${index}`,
    roleScope: {
      role: 'student',
      classId: 'class-1',
      privacyScopes: ['student-visible'],
    },
    generatedAt: '2026-06-21T00:00:00.000Z',
    authority: 'server-owned',
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
            supportingEvidenceCount: 3,
            missingRequiredEvidenceTypes: [],
            freshness: 'current',
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
      qualityTargets: {},
      limitations: [],
    },
    pathContext: {
      activeControlCorrectionPath: {
        state: 'none',
        pathId: null,
        status: null,
        currentNodeId: null,
        terminalValidationState: null,
        lowConfidenceMarkers: [],
      },
    },
    recommendations: [],
    limitations: [],
  }));
}

function teacherVisibleChunk(input: {
  id: string;
  classId: string;
  knowledgeNodeRefs: string[];
  redactedSummary: string;
  rawText?: string;
}): LearningEvidenceCorpusChunk {
  return createLearningEvidenceCorpusChunk({
    id: input.id,
    family: 'teacher-evidence',
    sourceType: 'teacher-evidence',
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
    citationAddress: null,
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
      level: 'canonical',
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
      useCases: ['diagnosis'],
    },
  });
}

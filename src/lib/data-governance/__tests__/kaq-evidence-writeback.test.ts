import { describe, expect, it } from 'vitest';

import {
  buildKonlingInterventionWritebackInput,
  buildPathExecutionWritebackInput,
  buildTeacherApprovedGradingWritebackInput,
  materializeKaqEvidenceWriteback,
  projectKaqEvidenceWritebackForConsumer,
} from '../kaq-evidence-writeback';
import { buildKaqArtifactVersionRefs } from '../../kaq-artifact-versioning';
import { buildControlCorrectionResourceNodeRegistry } from '../../control-correction-resource-seed';

const versionRefs = buildKaqArtifactVersionRefs({
  citationVersion: 'learning-evidence-citation.v1',
});

const subject = {
  ownerUserId: 'student-1',
  studentId: 'student-1',
  classId: 'class-1',
};

describe('K/A/Q evidence writeback governance', () => {
  it('routes knowledge, capability, and quality contributions separately from one governed source', () => {
    const result = materializeKaqEvidenceWriteback({
      id: 'writeback-grading-1',
      source: {
        sourceClass: 'teacher-approved-grading',
        sourceId: 'grading-run-1',
        sourceRef: { kind: 'DocumentRubricGrading', id: 'grading-run-1' },
        official: true,
        teacherApproved: true,
        aiGenerated: false,
      },
      subject,
      actor: { type: 'teacher', id: 'teacher-1' },
      privacyScope: 'teacher',
      materializedAt: '2026-06-23T03:30:00.000Z',
      evidenceWindow: {
        from: '2026-06-23T03:00:00.000Z',
        to: '2026-06-23T03:30:00.000Z',
      },
      versionRefs,
      contributions: [
        {
          domain: 'knowledge',
          objectiveId: 'knowledge:autocontrol:time-domain-performance',
          graphNodeId: 'kn:autocontrol:time-domain-performance',
          learningGoalId: 'control-correction',
          confidence: 0.74,
          terminalValidationCandidate: false,
        },
        {
          domain: 'capability',
          objectiveId: 'capability:autocontrol:validate-with-simulation-evidence',
          graphNodeId: 'cap:autocontrol:validate-with-simulation-evidence',
          learningGoalId: 'control-correction',
          confidence: 0.82,
          terminalValidationCandidate: true,
        },
        {
          domain: 'quality',
          objectiveId: 'quality:autocontrol:evidence-integrity',
          graphNodeId: 'qual:autocontrol:evidence-integrity',
          learningGoalId: 'control-correction',
          confidence: 0.66,
          terminalValidationCandidate: false,
        },
      ],
    });

    expect(result.status).toBe('accepted');
    expect(result.overlayUpdates.map((item) => item.domain)).toEqual(['knowledge', 'capability', 'quality']);
    expect(result.overlayUpdates[1]).toMatchObject({
      domain: 'capability',
      targetRef: {
        objectiveId: 'capability:autocontrol:validate-with-simulation-evidence',
        graphNodeId: 'cap:autocontrol:validate-with-simulation-evidence',
        learningGoalId: 'control-correction',
      },
      subject,
      terminalValidationAccepted: true,
      authorityLevel: 'teacher-approved',
    });
    expect(result.audit).toMatchObject({
      eventType: 'kaq-evidence-writeback.materialized',
      sourceClass: 'teacher-approved-grading',
      teacherApproved: true,
      aiGenerated: false,
      status: 'accepted',
    });
  });

  it('keeps preview-only evidence from satisfying official terminal validation', () => {
    const result = materializeKaqEvidenceWriteback({
      id: 'writeback-preview-1',
      source: {
        sourceClass: 'simulation-preview',
        sourceId: 'simulation-run-preview-1',
        sourceRef: { kind: 'SimulationRun', id: 'simulation-run-preview-1' },
        official: false,
        teacherApproved: false,
        aiGenerated: false,
      },
      subject,
      actor: { type: 'service', id: 'simulation-preview' },
      privacyScope: 'service',
      materializedAt: '2026-06-23T03:31:00.000Z',
      evidenceWindow: {
        from: '2026-06-23T03:29:00.000Z',
        to: '2026-06-23T03:31:00.000Z',
      },
      versionRefs,
      contributions: [
        {
          domain: 'capability',
          objectiveId: 'capability:autocontrol:validate-with-simulation-evidence',
          graphNodeId: 'cap:autocontrol:validate-with-simulation-evidence',
          learningGoalId: 'control-correction',
          confidence: 0.92,
          terminalValidationCandidate: true,
        },
      ],
    });

    expect(result.status).toBe('degraded');
    expect(result.overlayUpdates).toHaveLength(1);
    expect(result.overlayUpdates[0]).toMatchObject({
      domain: 'capability',
      terminalValidationAccepted: false,
      authorityLevel: 'preview',
      limitationCodes: ['preview-not-terminal-validation'],
    });
    expect(result.overlayUpdates[0].confidence).toBeLessThanOrEqual(0.4);
  });

  it('does not promote preview source classes through inconsistent teacher approval flags', () => {
    const result = materializeKaqEvidenceWriteback({
      id: 'writeback-preview-flagged-1',
      source: {
        sourceClass: 'simulation-preview',
        sourceId: 'simulation-run-preview-flagged-1',
        sourceRef: { kind: 'SimulationRun', id: 'simulation-run-preview-flagged-1' },
        official: false,
        teacherApproved: true,
        aiGenerated: false,
      },
      subject,
      actor: { type: 'teacher', id: 'teacher-1' },
      privacyScope: 'teacher',
      materializedAt: '2026-06-23T03:31:30.000Z',
      evidenceWindow: {
        from: '2026-06-23T03:30:00.000Z',
        to: '2026-06-23T03:31:30.000Z',
      },
      versionRefs,
      contributions: [
        {
          domain: 'capability',
          objectiveId: 'capability:autocontrol:validate-with-simulation-evidence',
          graphNodeId: 'cap:autocontrol:validate-with-simulation-evidence',
          learningGoalId: 'control-correction',
          confidence: 0.95,
          terminalValidationCandidate: true,
        },
      ],
    });

    expect(result.status).toBe('degraded');
    expect(result.overlayUpdates[0]).toMatchObject({
      authorityLevel: 'preview',
      terminalValidationAccepted: false,
      limitationCodes: ['preview-not-terminal-validation'],
    });
    expect(result.overlayUpdates[0].confidence).toBeLessThanOrEqual(0.4);
  });

  it('does not accept path execution completion as terminal validation by itself', () => {
    const pathInput = buildPathExecutionWritebackInput({
      id: 'path-terminal-candidate-1',
      executionId: 'path-exec-terminal-1',
      subject,
      learningGoalId: 'control-correction',
      terminalObjectiveId: 'capability:autocontrol:validate-with-simulation-evidence',
      terminalGraphNodeId: 'cap:autocontrol:validate-with-simulation-evidence',
      outcome: 'completed',
      score: 0.91,
      versionRefs,
      materializedAt: '2026-06-23T03:31:45.000Z',
    });

    const result = materializeKaqEvidenceWriteback(pathInput);

    expect(result.status).toBe('degraded');
    expect(result.overlayUpdates).toHaveLength(1);
    expect(result.overlayUpdates[0]).toMatchObject({
      sourceClass: 'path-execution',
      terminalValidationAccepted: false,
      limitationCodes: ['source-not-terminal-validation-authority'],
    });
    expect(result.audit.limitationCodes).toContain('source-not-terminal-validation-authority');
  });

  it('requires teacher approval before instructional checkpoints satisfy terminal validation', () => {
    const baseInput: Parameters<typeof materializeKaqEvidenceWriteback>[0] = {
      id: 'checkpoint-terminal-candidate-1',
      source: {
        sourceClass: 'instructional-checkpoint',
        sourceId: 'checkpoint-1',
        sourceRef: { kind: 'InstructionalCheckpoint', id: 'checkpoint-1' },
        official: false,
        teacherApproved: false,
        aiGenerated: false,
      },
      subject,
      actor: { type: 'service', id: 'lesson-runtime' },
      privacyScope: 'service',
      materializedAt: '2026-06-23T03:31:50.000Z',
      evidenceWindow: {
        from: '2026-06-23T03:30:00.000Z',
        to: '2026-06-23T03:31:50.000Z',
      },
      versionRefs,
      contributions: [
        {
          domain: 'capability',
          objectiveId: 'capability:autocontrol:validate-with-simulation-evidence',
          graphNodeId: 'cap:autocontrol:validate-with-simulation-evidence',
          learningGoalId: 'control-correction',
          confidence: 0.88,
          terminalValidationCandidate: true,
        },
      ],
    };

    const unapproved = materializeKaqEvidenceWriteback(baseInput);
    const approved = materializeKaqEvidenceWriteback({
      ...baseInput,
      id: 'checkpoint-terminal-candidate-2',
      source: {
        ...baseInput.source,
        sourceId: 'checkpoint-2',
        sourceRef: { kind: 'InstructionalCheckpoint', id: 'checkpoint-2' },
        teacherApproved: true,
      },
      actor: { type: 'teacher', id: 'teacher-1' },
      privacyScope: 'teacher',
    });

    expect(unapproved.status).toBe('degraded');
    expect(unapproved.overlayUpdates[0]).toMatchObject({
      sourceClass: 'instructional-checkpoint',
      terminalValidationAccepted: false,
      limitationCodes: ['source-not-terminal-validation-authority'],
    });
    expect(approved.status).toBe('accepted');
    expect(approved.overlayUpdates[0]).toMatchObject({
      sourceClass: 'instructional-checkpoint',
      authorityLevel: 'teacher-approved',
      terminalValidationAccepted: true,
      limitationCodes: [],
    });
  });

  it('blocks production writeback when required version refs are missing', () => {
    const result = materializeKaqEvidenceWriteback({
      id: 'writeback-arena-1',
      source: {
        sourceClass: 'arena-official',
        sourceId: 'arena-submission-1',
        sourceRef: { kind: 'ArenaSubmission', id: 'arena-submission-1' },
        official: true,
        teacherApproved: false,
        aiGenerated: false,
      },
      subject,
      actor: { type: 'service', id: 'arena-evaluator' },
      privacyScope: 'service',
      materializedAt: '2026-06-23T03:32:00.000Z',
      evidenceWindow: {
        from: '2026-06-23T03:20:00.000Z',
        to: '2026-06-23T03:32:00.000Z',
      },
      versionRefs: buildKaqArtifactVersionRefs({
        graphCatalogVersion: null,
        objectiveCatalogVersion: null,
      }),
      contributions: [
        {
          domain: 'capability',
          objectiveId: 'capability:autocontrol:transfer-to-ship-ocean-mission',
          graphNodeId: 'cap:autocontrol:transfer-to-ship-ocean-mission',
          learningGoalId: 'control-correction',
          confidence: 0.88,
          terminalValidationCandidate: true,
        },
      ],
    });

    expect(result.status).toBe('blocked');
    expect(result.overlayUpdates).toEqual([]);
    expect(result.audit.status).toBe('blocked');
    expect(result.audit.limitationCodes).toEqual(expect.arrayContaining([
      'missing-version-ref:objectiveCatalogVersion',
      'missing-version-ref:graphCatalogVersion',
    ]));
  });

  it('carries non-official version limitations into overlay updates', () => {
    const result = materializeKaqEvidenceWriteback({
      id: 'writeback-konling-missing-version-1',
      source: {
        sourceClass: 'konling-intervention',
        sourceId: 'tool-run-missing-version-1',
        sourceRef: { kind: 'AgentToolRun', id: 'tool-run-missing-version-1' },
        official: false,
        teacherApproved: false,
        aiGenerated: true,
        citationRefs: ['citation:missing-version-1'],
      },
      subject,
      actor: { type: 'service', id: 'konling-runtime' },
      privacyScope: 'student',
      materializedAt: '2026-06-23T03:32:30.000Z',
      evidenceWindow: { from: null, to: '2026-06-23T03:32:30.000Z' },
      versionRefs: buildKaqArtifactVersionRefs({
        groundingVersion: null,
        citationVersion: null,
      }),
      contributions: [
        {
          domain: 'quality',
          objectiveId: 'quality:autocontrol:ai-use-responsibility',
          graphNodeId: 'qual:autocontrol:ai-use-responsibility',
          learningGoalId: 'control-correction',
          confidence: 0.58,
          terminalValidationCandidate: false,
        },
      ],
    });

    expect(result.status).toBe('degraded');
    expect(result.overlayUpdates).toHaveLength(1);
    expect(result.overlayUpdates[0].limitationCodes).toEqual(expect.arrayContaining([
      'missing-version-ref:groundingVersion',
      'missing-version-ref:citationVersion',
    ]));
    expect(result.overlayUpdates[0].confidence).toBeLessThanOrEqual(0.6);
    expect(result.audit.limitationCodes).toEqual(expect.arrayContaining([
      'missing-version-ref:groundingVersion',
      'missing-version-ref:citationVersion',
    ]));
  });

  it('degrades stale official terminal validation refs without accepting terminal mastery', () => {
    const result = materializeKaqEvidenceWriteback({
      id: 'writeback-arena-stale-version-1',
      source: {
        sourceClass: 'arena-official',
        sourceId: 'arena-submission-stale-1',
        sourceRef: { kind: 'ArenaSubmission', id: 'arena-submission-stale-1' },
        official: true,
        teacherApproved: false,
        aiGenerated: false,
      },
      subject,
      actor: { type: 'service', id: 'arena-evaluator' },
      privacyScope: 'service',
      materializedAt: '2026-06-23T03:32:40.000Z',
      evidenceWindow: { from: null, to: '2026-06-23T03:32:40.000Z' },
      versionRefs: buildKaqArtifactVersionRefs({
        graphCatalogVersion: 'autocontrol-kaq-graph.stale',
      }),
      contributions: [
        {
          domain: 'capability',
          objectiveId: 'capability:autocontrol:transfer-to-ship-ocean-mission',
          graphNodeId: 'cap:autocontrol:transfer-to-ship-ocean-mission',
          learningGoalId: 'control-correction',
          confidence: 0.88,
          terminalValidationCandidate: true,
        },
      ],
    });

    expect(result.status).toBe('degraded');
    expect(result.overlayUpdates).toHaveLength(1);
    expect(result.overlayUpdates[0]).toMatchObject({
      terminalValidationAccepted: false,
      limitationCodes: ['stale-version-ref:graphCatalogVersion'],
    });
    expect(result.audit.limitationCodes).toContain('stale-version-ref:graphCatalogVersion');
  });

  it('projects privacy-safe views for student, teacher, admin, and service consumers', () => {
    const result = materializeKaqEvidenceWriteback({
      id: 'writeback-konling-1',
      source: {
        sourceClass: 'konling-intervention',
        sourceId: 'tool-run-1',
        sourceRef: { kind: 'AgentToolRun', id: 'tool-run-1' },
        official: false,
        teacherApproved: false,
        aiGenerated: true,
        citationRefs: ['citation:path-execution-1'],
      },
      subject,
      actor: { type: 'service', id: 'konling-runtime' },
      privacyScope: 'student',
      materializedAt: '2026-06-23T03:33:00.000Z',
      evidenceWindow: {
        from: '2026-06-23T03:25:00.000Z',
        to: '2026-06-23T03:33:00.000Z',
      },
      versionRefs,
      contributions: [
        {
          domain: 'quality',
          objectiveId: 'quality:autocontrol:ai-use-responsibility',
          graphNodeId: 'qual:autocontrol:ai-use-responsibility',
          learningGoalId: 'control-correction',
          confidence: 0.58,
          terminalValidationCandidate: false,
        },
      ],
    });

    const student = projectKaqEvidenceWritebackForConsumer(result, 'student');
    const teacher = projectKaqEvidenceWritebackForConsumer(result, 'teacher');
    const admin = projectKaqEvidenceWritebackForConsumer(result, 'admin');
    const service = projectKaqEvidenceWritebackForConsumer(result, 'service');

    expect(student.audit).toBeNull();
    expect(student.overlayUpdates[0].sourceRef).toBeNull();
    expect(student.overlayUpdates[0].sourceId).toBeNull();
    expect(teacher.audit?.sourceRef).toBeNull();
    expect(teacher.audit?.sourceId).toBeNull();
    expect(teacher.overlayUpdates[0].sourceRef).toBeNull();
    expect(teacher.overlayUpdates[0].sourceId).toBeNull();
    expect(admin.audit?.sourceRef).toEqual({ kind: 'AgentToolRun', id: 'tool-run-1' });
    expect(admin.audit?.citationRefs).toEqual(['citation:path-execution-1']);
    expect(admin.overlayUpdates[0].sourceId).toBe('tool-run-1');
    expect(admin.overlayUpdates[0].citationRefs).toEqual(['citation:path-execution-1']);
    expect(student.overlayUpdates[0].citationRefs).toBeNull();
    expect(teacher.overlayUpdates[0].citationRefs).toBeNull();
    expect(service.audit?.actor).toEqual({ type: 'service', id: 'konling-runtime' });
  });

  it('blocks unknown, mismatched, or cross-domain target bindings', () => {
    const unknown = materializeKaqEvidenceWriteback({
      id: 'writeback-invalid-target-1',
      source: {
        sourceClass: 'teacher-approved-grading',
        sourceId: 'grading-run-invalid-1',
        sourceRef: { kind: 'DocumentRubricGrading', id: 'grading-run-invalid-1' },
        official: true,
        teacherApproved: true,
        aiGenerated: false,
      },
      subject,
      actor: { type: 'teacher', id: 'teacher-1' },
      privacyScope: 'teacher',
      materializedAt: '2026-06-23T03:33:30.000Z',
      evidenceWindow: { from: null, to: '2026-06-23T03:33:30.000Z' },
      versionRefs,
      contributions: [
        {
          domain: 'capability',
          objectiveId: 'capability:not-real',
          graphNodeId: 'cap:autocontrol:validate-with-simulation-evidence',
          learningGoalId: 'control-correction',
          confidence: 0.8,
          terminalValidationCandidate: true,
        },
      ],
    });
    const mismatched = materializeKaqEvidenceWriteback({
      id: 'writeback-invalid-target-2',
      source: {
        sourceClass: 'teacher-approved-grading',
        sourceId: 'grading-run-invalid-2',
        sourceRef: { kind: 'DocumentRubricGrading', id: 'grading-run-invalid-2' },
        official: true,
        teacherApproved: true,
        aiGenerated: false,
      },
      subject,
      actor: { type: 'teacher', id: 'teacher-1' },
      privacyScope: 'teacher',
      materializedAt: '2026-06-23T03:33:40.000Z',
      evidenceWindow: { from: null, to: '2026-06-23T03:33:40.000Z' },
      versionRefs,
      contributions: [
        {
          domain: 'quality',
          objectiveId: 'quality:autocontrol:evidence-integrity',
          graphNodeId: 'cap:autocontrol:validate-with-simulation-evidence',
          learningGoalId: 'control-correction',
          confidence: 0.8,
          terminalValidationCandidate: true,
        },
      ],
    });

    expect(unknown.status).toBe('blocked');
    expect(unknown.overlayUpdates).toEqual([]);
    expect(unknown.audit.limitationCodes).toContain('unknown-objective-id');
    expect(mismatched.status).toBe('blocked');
    expect(mismatched.overlayUpdates).toEqual([]);
    expect(mismatched.audit.limitationCodes).toContain('target-objective-node-mismatch');
  });

  it('keeps valid sibling contributions when one target binding is invalid', () => {
    const result = materializeKaqEvidenceWriteback({
      id: 'writeback-partial-target-1',
      source: {
        sourceClass: 'teacher-approved-grading',
        sourceId: 'grading-run-partial-1',
        sourceRef: { kind: 'DocumentRubricGrading', id: 'grading-run-partial-1' },
        official: true,
        teacherApproved: true,
        aiGenerated: false,
      },
      subject,
      actor: { type: 'teacher', id: 'teacher-1' },
      privacyScope: 'teacher',
      materializedAt: '2026-06-23T03:33:45.000Z',
      evidenceWindow: { from: null, to: '2026-06-23T03:33:45.000Z' },
      versionRefs,
      contributions: [
        {
          domain: 'capability',
          objectiveId: 'capability:autocontrol:validate-with-simulation-evidence',
          graphNodeId: 'cap:autocontrol:validate-with-simulation-evidence',
          learningGoalId: 'control-correction',
          confidence: 0.82,
          terminalValidationCandidate: true,
        },
        {
          domain: 'quality',
          objectiveId: 'quality:not-real',
          graphNodeId: 'qual:autocontrol:evidence-integrity',
          learningGoalId: 'control-correction',
          confidence: 0.7,
          terminalValidationCandidate: false,
        },
      ],
    });

    expect(result.status).toBe('degraded');
    expect(result.overlayUpdates).toHaveLength(1);
    expect(result.overlayUpdates[0]).toMatchObject({
      domain: 'capability',
      terminalValidationAccepted: true,
      limitationCodes: [],
    });
    expect(result.audit.limitationCodes).toContain('unknown-objective-id');
  });

  it('does not fabricate overlay state for invalid non-official targets', () => {
    const result = materializeKaqEvidenceWriteback({
      id: 'writeback-invalid-konling-1',
      source: {
        sourceClass: 'konling-intervention',
        sourceId: 'tool-run-invalid-1',
        sourceRef: { kind: 'AgentToolRun', id: 'tool-run-invalid-1' },
        official: false,
        teacherApproved: false,
        aiGenerated: true,
      },
      subject,
      actor: { type: 'service', id: 'konling-runtime' },
      privacyScope: 'student',
      materializedAt: '2026-06-23T03:33:50.000Z',
      evidenceWindow: { from: null, to: '2026-06-23T03:33:50.000Z' },
      versionRefs,
      contributions: [
        {
          domain: 'quality',
          objectiveId: 'quality:not-real',
          graphNodeId: 'qual:autocontrol:ai-use-responsibility',
          learningGoalId: 'control-correction',
          confidence: 0.5,
          terminalValidationCandidate: false,
        },
      ],
    });

    expect(result.status).toBe('blocked');
    expect(result.overlayUpdates).toEqual([]);
    expect(result.audit.limitationCodes).toContain('unknown-objective-id');
  });

  it('blocks invalid preview targets before low-confidence overlay projection', () => {
    const result = materializeKaqEvidenceWriteback({
      id: 'writeback-invalid-preview-1',
      source: {
        sourceClass: 'simulation-preview',
        sourceId: 'simulation-preview-invalid-1',
        sourceRef: { kind: 'SimulationRun', id: 'simulation-preview-invalid-1' },
        official: false,
        teacherApproved: false,
        aiGenerated: false,
      },
      subject,
      actor: { type: 'service', id: 'simulation-preview' },
      privacyScope: 'service',
      materializedAt: '2026-06-23T03:33:52.000Z',
      evidenceWindow: { from: null, to: '2026-06-23T03:33:52.000Z' },
      versionRefs,
      contributions: [
        {
          domain: 'capability',
          objectiveId: 'capability:not-real',
          graphNodeId: 'cap:autocontrol:validate-with-simulation-evidence',
          learningGoalId: 'control-correction',
          confidence: 0.9,
          terminalValidationCandidate: true,
        },
      ],
    });

    expect(result.status).toBe('blocked');
    expect(result.overlayUpdates).toEqual([]);
    expect(result.audit.limitationCodes).toEqual(expect.arrayContaining([
      'unknown-objective-id',
      'preview-not-terminal-validation',
    ]));
  });

  it('blocks mismatched student subject ownership before overlay materialization', () => {
    const result = materializeKaqEvidenceWriteback({
      id: 'writeback-subject-mismatch-1',
      source: {
        sourceClass: 'simulation-validation',
        sourceId: 'simulation-run-1',
        sourceRef: { kind: 'SimulationRun', id: 'simulation-run-1' },
        official: true,
        teacherApproved: false,
        aiGenerated: false,
      },
      subject: {
        ownerUserId: 'student-1',
        studentId: 'student-2',
        classId: 'class-1',
      },
      actor: { type: 'service', id: 'simulation-validation' },
      privacyScope: 'service',
      materializedAt: '2026-06-23T03:33:55.000Z',
      evidenceWindow: { from: null, to: '2026-06-23T03:33:55.000Z' },
      versionRefs,
      contributions: [
        {
          domain: 'capability',
          objectiveId: 'capability:autocontrol:validate-with-simulation-evidence',
          graphNodeId: 'cap:autocontrol:validate-with-simulation-evidence',
          learningGoalId: 'control-correction',
          confidence: 0.9,
          terminalValidationCandidate: true,
        },
      ],
    });

    expect(result.status).toBe('blocked');
    expect(result.overlayUpdates).toEqual([]);
    expect(result.audit.limitationCodes).toContain('subject-owner-mismatch');
  });

  it('blocks missing subject ownership without throwing', () => {
    const result = materializeKaqEvidenceWriteback({
      id: 'writeback-subject-missing-1',
      source: {
        sourceClass: 'simulation-validation',
        sourceId: 'simulation-run-2',
        sourceRef: { kind: 'SimulationRun', id: 'simulation-run-2' },
        official: true,
        teacherApproved: false,
        aiGenerated: false,
      },
      subject: {} as Parameters<typeof materializeKaqEvidenceWriteback>[0]['subject'],
      actor: { type: 'service', id: 'simulation-validation' },
      privacyScope: 'service',
      materializedAt: '2026-06-23T03:33:56.000Z',
      evidenceWindow: { from: null, to: '2026-06-23T03:33:56.000Z' },
      versionRefs,
      contributions: [
        {
          domain: 'capability',
          objectiveId: 'capability:autocontrol:validate-with-simulation-evidence',
          graphNodeId: 'cap:autocontrol:validate-with-simulation-evidence',
          learningGoalId: 'control-correction',
          confidence: 0.9,
          terminalValidationCandidate: true,
        },
      ],
    });

    expect(result.status).toBe('blocked');
    expect(result.overlayUpdates).toEqual([]);
    expect(result.audit.limitationCodes).toContain('missing-subject-owner');
  });

  it('blocks writeback with missing replayable source refs before terminal validation', () => {
    const baseInput: Parameters<typeof materializeKaqEvidenceWriteback>[0] = {
      id: 'writeback-missing-source-ref-1',
      source: {
        sourceClass: 'simulation-validation',
        sourceId: '',
        sourceRef: { kind: 'SimulationRun', id: '' },
        official: true,
        teacherApproved: false,
        aiGenerated: false,
      },
      subject,
      actor: { type: 'service', id: 'simulation-validation' },
      privacyScope: 'service',
      materializedAt: '2026-06-23T03:34:10.000Z',
      evidenceWindow: { from: null, to: '2026-06-23T03:34:10.000Z' },
      versionRefs,
      contributions: [
        {
          domain: 'capability',
          objectiveId: 'capability:autocontrol:validate-with-simulation-evidence',
          graphNodeId: 'cap:autocontrol:validate-with-simulation-evidence',
          learningGoalId: 'control-correction',
          confidence: 0.9,
          terminalValidationCandidate: true,
        },
      ],
    };
    const missingId = materializeKaqEvidenceWriteback(baseInput);
    const missingKind = materializeKaqEvidenceWriteback({
      ...baseInput,
      id: 'writeback-missing-source-ref-kind-1',
      source: {
        ...baseInput.source,
        sourceId: 'simulation-run-missing-kind-1',
        sourceRef: { kind: ' ', id: 'simulation-run-missing-kind-1' },
      },
    });

    expect(missingId.status).toBe('blocked');
    expect(missingId.overlayUpdates).toEqual([]);
    expect(missingId.audit.limitationCodes).toContain('missing-source-ref');
    expect(missingKind.status).toBe('blocked');
    expect(missingKind.overlayUpdates).toEqual([]);
    expect(missingKind.audit.limitationCodes).toContain('missing-source-ref');
  });

  it('does not accept low-confidence teacher-approved grading as terminal validation', () => {
    const input = buildTeacherApprovedGradingWritebackInput({
      id: 'grading-writeback-low-score-1',
      gradingRunId: 'grading-run-low-score-1',
      subject,
      teacherId: 'teacher-9',
      learningGoalId: 'control-correction',
      objectiveId: 'quality:autocontrol:evidence-integrity',
      graphNodeId: 'qual:autocontrol:evidence-integrity',
      score: 0,
      versionRefs,
      materializedAt: '2026-06-23T03:35:30.000Z',
    });
    const result = materializeKaqEvidenceWriteback(input);
    const forcedCandidate = materializeKaqEvidenceWriteback({
      ...input,
      id: 'grading-writeback-low-score-forced-1',
      contributions: [
        {
          ...input.contributions[0],
          terminalValidationCandidate: true,
        },
      ],
    });

    expect(input.contributions[0].terminalValidationCandidate).toBe(false);
    expect(result.status).toBe('accepted');
    expect(result.overlayUpdates[0]).toMatchObject({
      sourceClass: 'teacher-approved-grading',
      terminalValidationAccepted: false,
      limitationCodes: [],
    });
    expect(forcedCandidate.status).toBe('degraded');
    expect(forcedCandidate.overlayUpdates[0]).toMatchObject({
      terminalValidationAccepted: false,
      limitationCodes: ['low-confidence-terminal-validation'],
    });
  });

  it('accepts teacher-approved AI grading provenance as terminal validation when confidence passes', () => {
    const input = buildTeacherApprovedGradingWritebackInput({
      id: 'grading-writeback-ai-approved-1',
      gradingRunId: 'grading-run-ai-approved-1',
      subject,
      teacherId: 'teacher-9',
      learningGoalId: 'control-correction',
      objectiveId: 'quality:autocontrol:evidence-integrity',
      graphNodeId: 'qual:autocontrol:evidence-integrity',
      score: 0.86,
      versionRefs,
      materializedAt: '2026-06-23T03:35:40.000Z',
    });
    const result = materializeKaqEvidenceWriteback({
      ...input,
      source: {
        ...input.source,
        aiGenerated: true,
      },
    });

    expect(result.status).toBe('accepted');
    expect(result.overlayUpdates[0]).toMatchObject({
      aiGenerated: true,
      teacherApproved: true,
      terminalValidationAccepted: true,
      limitationCodes: [],
    });
  });

  it('requires resource target version refs and blocks unverified resource node ids', () => {
    const result = materializeKaqEvidenceWriteback({
      id: 'writeback-resource-target-1',
      source: {
        sourceClass: 'teacher-approved-grading',
        sourceId: 'grading-run-resource-1',
        sourceRef: { kind: 'DocumentRubricGrading', id: 'grading-run-resource-1' },
        official: true,
        teacherApproved: true,
        aiGenerated: false,
      },
      subject,
      actor: { type: 'teacher', id: 'teacher-1' },
      privacyScope: 'teacher',
      materializedAt: '2026-06-23T03:35:45.000Z',
      evidenceWindow: { from: null, to: '2026-06-23T03:35:45.000Z' },
      versionRefs: buildKaqArtifactVersionRefs({
        resourceRegistryVersion: null,
        resourceProjectionVersion: null,
      }),
      contributions: [
        {
          domain: 'capability',
          objectiveId: 'capability:autocontrol:validate-with-simulation-evidence',
          graphNodeId: 'cap:autocontrol:validate-with-simulation-evidence',
          learningGoalId: 'control-correction',
          resourceNodeId: 'resource:not-verified',
          confidence: 0.8,
          terminalValidationCandidate: true,
        },
      ],
    });

    expect(result.status).toBe('blocked');
    expect(result.overlayUpdates).toEqual([]);
    expect(result.audit.limitationCodes).toEqual(expect.arrayContaining([
      'missing-version-ref:resourceRegistryVersion',
      'missing-version-ref:resourceProjectionVersion',
      'unverified-resource-node-id',
    ]));
  });

  it('accepts resource-targeted evidence when the resource node is verified by registry input', () => {
    const registry = buildControlCorrectionResourceNodeRegistry();
    const result = materializeKaqEvidenceWriteback({
      id: 'writeback-resource-target-verified-1',
      source: {
        sourceClass: 'teacher-approved-grading',
        sourceId: 'grading-run-resource-verified-1',
        sourceRef: { kind: 'DocumentRubricGrading', id: 'grading-run-resource-verified-1' },
        official: true,
        teacherApproved: true,
        aiGenerated: false,
      },
      subject,
      actor: { type: 'teacher', id: 'teacher-1' },
      privacyScope: 'teacher',
      materializedAt: '2026-06-23T03:35:50.000Z',
      evidenceWindow: { from: null, to: '2026-06-23T03:35:50.000Z' },
      versionRefs,
      resourceTargetRegistry: registry,
      contributions: [
        {
          domain: 'capability',
          objectiveId: 'capability:autocontrol:validate-with-simulation-evidence',
          graphNodeId: 'cap:autocontrol:validate-with-simulation-evidence',
          learningGoalId: 'control-correction',
          resourceNodeId: 'registry:lesson09-correction-precheck',
          confidence: 0.8,
          terminalValidationCandidate: true,
        },
      ],
    });

    expect(result.status).toBe('accepted');
    expect(result.overlayUpdates).toHaveLength(1);
    expect(result.overlayUpdates[0]).toMatchObject({
      targetRef: {
        resourceNodeId: 'registry:lesson09-correction-precheck',
      },
      terminalValidationAccepted: true,
      limitationCodes: [],
    });
    expect(result.audit.limitationCodes).not.toContain('unverified-resource-node-id');
  });

  it('blocks verified resource targets when resource version refs are missing', () => {
    const registry = buildControlCorrectionResourceNodeRegistry();
    const result = materializeKaqEvidenceWriteback({
      id: 'writeback-resource-target-missing-version-1',
      source: {
        sourceClass: 'teacher-approved-grading',
        sourceId: 'grading-run-resource-missing-version-1',
        sourceRef: { kind: 'DocumentRubricGrading', id: 'grading-run-resource-missing-version-1' },
        official: true,
        teacherApproved: true,
        aiGenerated: false,
      },
      subject,
      actor: { type: 'teacher', id: 'teacher-1' },
      privacyScope: 'teacher',
      materializedAt: '2026-06-23T03:35:55.000Z',
      evidenceWindow: { from: null, to: '2026-06-23T03:35:55.000Z' },
      versionRefs: buildKaqArtifactVersionRefs({
        resourceRegistryVersion: null,
        resourceProjectionVersion: null,
      }),
      resourceTargetRegistry: registry,
      contributions: [
        {
          domain: 'capability',
          objectiveId: 'capability:autocontrol:validate-with-simulation-evidence',
          graphNodeId: 'cap:autocontrol:validate-with-simulation-evidence',
          learningGoalId: 'control-correction',
          resourceNodeId: 'registry:lesson09-correction-precheck',
          confidence: 0.8,
          terminalValidationCandidate: true,
        },
      ],
    });

    expect(result.status).toBe('blocked');
    expect(result.overlayUpdates).toEqual([]);
    expect(result.audit.limitationCodes).toEqual(expect.arrayContaining([
      'missing-version-ref:resourceRegistryVersion',
      'missing-version-ref:resourceProjectionVersion',
    ]));
    expect(result.audit.limitationCodes).not.toContain('unverified-resource-node-id');
  });

  it('blocks non-official resource-targeted evidence when resource version refs are missing', () => {
    const registry = buildControlCorrectionResourceNodeRegistry();
    const result = materializeKaqEvidenceWriteback({
      id: 'writeback-resource-target-konling-missing-version-1',
      source: {
        sourceClass: 'konling-intervention',
        sourceId: 'tool-run-resource-target-1',
        sourceRef: { kind: 'AgentToolRun', id: 'tool-run-resource-target-1' },
        official: false,
        teacherApproved: false,
        aiGenerated: true,
      },
      subject,
      actor: { type: 'service', id: 'konling-runtime' },
      privacyScope: 'student',
      materializedAt: '2026-06-23T03:36:05.000Z',
      evidenceWindow: { from: null, to: '2026-06-23T03:36:05.000Z' },
      versionRefs: buildKaqArtifactVersionRefs({
        resourceRegistryVersion: null,
        resourceProjectionVersion: null,
      }),
      resourceTargetRegistry: registry,
      contributions: [
        {
          domain: 'quality',
          objectiveId: 'quality:autocontrol:ai-use-responsibility',
          graphNodeId: 'qual:autocontrol:ai-use-responsibility',
          learningGoalId: 'control-correction',
          resourceNodeId: 'registry:lesson09-correction-precheck',
          confidence: 0.5,
          terminalValidationCandidate: false,
        },
      ],
    });

    expect(result.status).toBe('blocked');
    expect(result.overlayUpdates).toEqual([]);
    expect(result.audit.limitationCodes).toEqual(expect.arrayContaining([
      'missing-version-ref:resourceRegistryVersion',
      'missing-version-ref:resourceProjectionVersion',
    ]));
    expect(result.audit.limitationCodes).not.toContain('unverified-resource-node-id');
  });

  it('keeps non-resource sibling contributions when resource target version refs are missing', () => {
    const registry = buildControlCorrectionResourceNodeRegistry();
    const result = materializeKaqEvidenceWriteback({
      id: 'writeback-resource-target-sibling-version-1',
      source: {
        sourceClass: 'teacher-approved-grading',
        sourceId: 'grading-run-resource-sibling-1',
        sourceRef: { kind: 'DocumentRubricGrading', id: 'grading-run-resource-sibling-1' },
        official: true,
        teacherApproved: true,
        aiGenerated: false,
      },
      subject,
      actor: { type: 'teacher', id: 'teacher-1' },
      privacyScope: 'teacher',
      materializedAt: '2026-06-23T03:36:10.000Z',
      evidenceWindow: { from: null, to: '2026-06-23T03:36:10.000Z' },
      versionRefs: buildKaqArtifactVersionRefs({
        resourceRegistryVersion: null,
        resourceProjectionVersion: null,
      }),
      resourceTargetRegistry: registry,
      contributions: [
        {
          domain: 'capability',
          objectiveId: 'capability:autocontrol:validate-with-simulation-evidence',
          graphNodeId: 'cap:autocontrol:validate-with-simulation-evidence',
          learningGoalId: 'control-correction',
          confidence: 0.82,
          terminalValidationCandidate: true,
        },
        {
          domain: 'quality',
          objectiveId: 'quality:autocontrol:evidence-integrity',
          graphNodeId: 'qual:autocontrol:evidence-integrity',
          learningGoalId: 'control-correction',
          resourceNodeId: 'registry:lesson09-correction-precheck',
          confidence: 0.7,
          terminalValidationCandidate: false,
        },
      ],
    });

    expect(result.status).toBe('degraded');
    expect(result.overlayUpdates).toHaveLength(1);
    expect(result.overlayUpdates[0]).toMatchObject({
      domain: 'capability',
      terminalValidationAccepted: true,
      limitationCodes: [],
    });
    expect(result.audit.limitationCodes).toEqual(expect.arrayContaining([
      'missing-version-ref:resourceRegistryVersion',
      'missing-version-ref:resourceProjectionVersion',
    ]));
  });

  it('builds governed candidate inputs for path execution, Konling, and teacher-approved grading outcomes', () => {
    const pathInput = buildPathExecutionWritebackInput({
      id: 'path-writeback-1',
      executionId: 'path-exec-1',
      subject,
      learningGoalId: 'control-correction',
      terminalObjectiveId: 'capability:autocontrol:validate-with-simulation-evidence',
      terminalGraphNodeId: 'cap:autocontrol:validate-with-simulation-evidence',
      outcome: 'completed',
      score: 0.91,
      versionRefs,
      materializedAt: '2026-06-23T03:34:00.000Z',
    });
    const konlingInput = buildKonlingInterventionWritebackInput({
      id: 'konling-writeback-1',
      toolRunId: 'tool-run-2',
      subject,
      learningGoalId: 'control-correction',
      qualityObjectiveId: 'quality:autocontrol:ai-use-responsibility',
      graphNodeId: 'qual:autocontrol:ai-use-responsibility',
      accepted: true,
      citationRefs: ['citation:tool-run-2'],
      versionRefs,
      materializedAt: '2026-06-23T03:35:00.000Z',
    });
    const gradingInput = buildTeacherApprovedGradingWritebackInput({
      id: 'grading-writeback-2',
      gradingRunId: 'grading-run-2',
      subject,
      teacherId: 'teacher-9',
      learningGoalId: 'control-correction',
      objectiveId: 'quality:autocontrol:evidence-integrity',
      graphNodeId: 'qual:autocontrol:evidence-integrity',
      score: 0.86,
      versionRefs,
      materializedAt: '2026-06-23T03:36:00.000Z',
    });

    expect(pathInput.source.sourceClass).toBe('path-execution');
    expect(pathInput.contributions[0]).toMatchObject({
      domain: 'capability',
      objectiveId: 'capability:autocontrol:validate-with-simulation-evidence',
      graphNodeId: 'cap:autocontrol:validate-with-simulation-evidence',
      terminalValidationCandidate: true,
    });
    expect(konlingInput.source).toMatchObject({
      sourceClass: 'konling-intervention',
      aiGenerated: true,
    });
    expect(konlingInput.contributions[0]).toMatchObject({
      domain: 'quality',
      terminalValidationCandidate: false,
    });
    expect(gradingInput.source).toMatchObject({
      sourceClass: 'teacher-approved-grading',
      teacherApproved: true,
    });
    expect(gradingInput.actor).toEqual({ type: 'teacher', id: 'teacher-9' });
    expect(gradingInput.contributions[0].domain).toBe('quality');
  });

  it('does not write path selection as K/A/Q capability evidence', () => {
    const selectedInput = buildPathExecutionWritebackInput({
      id: 'path-selection-writeback-1',
      executionId: 'path-selection-1',
      subject,
      learningGoalId: 'control-correction',
      terminalObjectiveId: 'capability:autocontrol:validate-with-simulation-evidence',
      terminalGraphNodeId: 'cap:autocontrol:validate-with-simulation-evidence',
      outcome: 'selected' as Parameters<typeof buildPathExecutionWritebackInput>[0]['outcome'],
      score: 0.91,
      versionRefs,
      materializedAt: '2026-06-23T03:37:00.000Z',
    });

    const result = materializeKaqEvidenceWriteback(selectedInput);

    expect(selectedInput.contributions).toEqual([]);
    expect(result.status).toBe('blocked');
    expect(result.overlayUpdates).toEqual([]);
  });
});

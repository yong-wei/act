import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  revalidatePath: vi.fn(),
  prisma: {
    courseEnhancementPack: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    lessonPlan: {
      findUnique: vi.fn(),
    },
    classSession: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('server-only', () => ({}));

import { POST } from '@/app/teacher/prep-packs/actions/route';

const baseDate = new Date('2026-06-13T00:00:00.000Z');

function enhancementRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'enhancement-pack-1',
    teacherId: 'teacher-1',
    classId: 'class-1',
    goalId: 'control-correction',
    lessonId: 'lesson-3-6',
    sourcePrepPackId: 'prep-pack-1',
    diagnosisSnapshotId: 'diagnosis-1',
    status: 'review-ready',
    source: {
      prepPackId: 'prep-pack-1',
      diagnosisSnapshotId: 'diagnosis-1',
      sourceEvidenceRefs: ['diagnosis-1'],
    },
    items: [{
      id: 'item-1',
      prepPackItemId: 'prep-item-1',
      itemType: 'review-card',
      title: '控制校正复盘卡',
      insertionTarget: {
        type: 'lesson-stage',
        lessonId: 'lesson-3-6',
        lessonStage: 'participatory-learning',
        lessonStepId: 'step-quiz',
      },
      linkedResource: {
        nodeId: 'resource-node-1',
        title: '控制校正复盘卡',
        href: '/resources/resource-node-1',
      },
      estimatedTimeMinutes: 8,
      evidenceBasis: [{
        sourceId: 'diagnosis-1',
        displayTitle: '班级诊断',
        capsule: '终端验证证据不足。',
        confidence: 'high',
        privacy: 'aggregate',
        citationChip: {
          chunkId: 'diagnosis-1',
          displayTitle: '班级诊断',
          displayHref: null,
          sourceType: 'diagnosis',
          authorityLevel: 'verified',
          confidence: 'high',
          freshnessBucket: 'current',
          privacyVisibility: 'redacted',
          limitationState: null,
        },
      }],
      methodologyNotes: ['aggregate only'],
      privacyScope: 'aggregate-and-redacted-only',
      lifecycle: {
        state: 'approved',
        reviewedBy: 'teacher-1',
        reviewedAt: baseDate.toISOString(),
      },
      activation: {
        activatedBy: null,
        activatedAt: null,
        rolledBackBy: null,
        rolledBackAt: null,
        rollbackReason: null,
      },
      impactEvidence: [],
    }],
    auditLog: [],
    teacherFeedback: [],
    activatedAt: null,
    rolledBackAt: null,
    archivedAt: null,
    createdAt: baseDate,
    updatedAt: baseDate,
    ...overrides,
  };
}

function activeEnhancementRecord(overrides: Record<string, unknown> = {}) {
  const base = enhancementRecord();
  const activatedAt = '2026-06-13T01:00:00.000Z';
  return {
    ...base,
    status: 'active',
    activatedAt: new Date(activatedAt),
    items: [{
      ...base.items[0],
      activation: {
        activatedBy: 'teacher-1',
        activatedAt,
        rolledBackBy: null,
        rolledBackAt: null,
        rollbackReason: null,
      },
    }],
    ...overrides,
  };
}

function postForm(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return new Request('http://localhost/teacher/prep-packs/actions', {
    method: 'POST',
    body: formData,
  });
}

describe('teacher prep-pack lifecycle actions route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.courseEnhancementPack.findUnique.mockResolvedValue(enhancementRecord());
    mocks.prisma.lessonPlan.findUnique.mockResolvedValue({
      id: 'lesson-3-6',
      items: [{
        id: 'step-quiz',
        stage: 'PARTICIPATORY',
        resourceId: 'resource-node-1',
        knowledgeNodeId: null,
        resource: { registryId: 'control-correction-diagnosis-recap' },
      }],
    });
    mocks.prisma.classSession.findMany.mockResolvedValue([{
      id: 'session-1',
      currentItemId: 'step-quiz',
    }]);
    mocks.prisma.courseEnhancementPack.upsert.mockImplementation(async (args) => enhancementRecord({
      status: args.update.status,
      items: args.update.items,
      auditLog: args.update.auditLog,
      teacherFeedback: args.update.teacherFeedback,
      activatedAt: args.update.activatedAt,
      rolledBackAt: args.update.rolledBackAt,
      archivedAt: args.update.archivedAt,
    }));
  });

  it('rejects non-teacher lifecycle submissions before loading a pack', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });

    const response = await POST(postForm({ packId: 'enhancement-pack-1', action: 'activate' }) as never);

    expect(response.headers.get('location')).toContain('status=forbidden');
    expect(mocks.prisma.courseEnhancementPack.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.courseEnhancementPack.upsert).not.toHaveBeenCalled();
  });

  it('does not operate on another teacher owned pack', async () => {
    mocks.prisma.courseEnhancementPack.findUnique.mockResolvedValue(enhancementRecord({ teacherId: 'teacher-2' }));

    const response = await POST(postForm({ packId: 'enhancement-pack-1', action: 'activate' }) as never);

    expect(response.headers.get('location')).toContain('status=not-found');
    expect(mocks.prisma.courseEnhancementPack.upsert).not.toHaveBeenCalled();
  });

  it('activates a teacher owned pack through the persisted enhancement function', async () => {
    const response = await POST(postForm({
      packId: 'enhancement-pack-1',
      action: 'activate',
      classId: 'class-1',
      clusterId: 'cluster-terminal-validation',
      graphNodeId: 'kn:autocontrol:terminal-validation',
      learningGoalId: 'control-correction',
      resourceGapStatus: 'partial',
    }) as never);

    expect(response.headers.get('location')).toContain('status=activate');
    expect(response.headers.get('location')).toContain('classId=class-1');
    expect(response.headers.get('location')).toContain('cluster=cluster-terminal-validation');
    expect(response.headers.get('location')).toContain('graphNodeId=kn%3Aautocontrol%3Aterminal-validation');
    expect(response.headers.get('location')).toContain('learningGoalId=control-correction');
    expect(response.headers.get('location')).toContain('resourceGapStatus=partial');
    expect(mocks.prisma.courseEnhancementPack.upsert).toHaveBeenCalledTimes(1);
    const upsertArg = mocks.prisma.courseEnhancementPack.upsert.mock.calls[0][0];
    expect(upsertArg.where).toEqual({ sourcePrepPackId: 'prep-pack-1' });
    expect(upsertArg.update.status).toBe('active');
    expect(JSON.stringify(upsertArg.update.auditLog)).toContain('"action":"activate"');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/teacher/prep-packs');
  });

  it('rejects activation when persisted insertion anchors are absent from the real runtime', async () => {
    mocks.prisma.lessonPlan.findUnique.mockResolvedValue({
      id: 'lesson-3-6',
      items: [{
        id: 'other-step',
        stage: 'SUMMARY',
        resourceId: null,
        knowledgeNodeId: null,
        resource: null,
      }],
    });
    mocks.prisma.classSession.findMany.mockResolvedValue([]);

    const response = await POST(postForm({ packId: 'enhancement-pack-1', action: 'activate' }) as never);

    expect(response.headers.get('location')).toContain('status=action-failed');
    expect(mocks.prisma.courseEnhancementPack.upsert).not.toHaveBeenCalled();
  });

  it('rejects rollback and impact evidence before the pack is active', async () => {
    const rollback = await POST(postForm({ packId: 'enhancement-pack-1', action: 'rollback' }) as never);
    const impact = await POST(postForm({
      packId: 'enhancement-pack-1',
      itemId: 'item-1',
      action: 'impact-evidence',
    }) as never);

    expect(rollback.headers.get('location')).toContain('status=invalid-lifecycle');
    expect(impact.headers.get('location')).toContain('status=invalid-lifecycle');
    expect(mocks.prisma.courseEnhancementPack.upsert).not.toHaveBeenCalled();
  });

  it('rolls back only an active teacher owned pack', async () => {
    mocks.prisma.courseEnhancementPack.findUnique.mockResolvedValue(activeEnhancementRecord());

    const response = await POST(postForm({
      packId: 'enhancement-pack-1',
      action: 'rollback',
      reason: '课堂后撤回 overlay',
    }) as never);

    expect(response.headers.get('location')).toContain('status=rollback');
    const upsertArg = mocks.prisma.courseEnhancementPack.upsert.mock.calls[0][0];
    expect(upsertArg.update.status).toBe('rolled-back');
    expect(JSON.stringify(upsertArg.update.auditLog)).toContain('"action":"rollback"');
  });

  it('records impact evidence through the persisted pack writer only after activation', async () => {
    mocks.prisma.courseEnhancementPack.findUnique.mockResolvedValue(activeEnhancementRecord());

    const response = await POST(postForm({
      packId: 'enhancement-pack-1',
      itemId: 'item-1',
      action: 'impact-evidence',
      reason: '课后观察显示补强有效',
    }) as never);

    expect(response.headers.get('location')).toContain('status=impact-evidence');
    const upsertArg = mocks.prisma.courseEnhancementPack.upsert.mock.calls[0][0];
    expect(JSON.stringify(upsertArg.update.items)).toContain('"sourceType":"teacher-observation"');
    expect(JSON.stringify(upsertArg.update.teacherFeedback)).toContain('课后观察显示补强有效');
    expect(JSON.stringify(upsertArg.update.auditLog)).toContain('"action":"impact-evidence"');
  });

  it('rejects rollback and impact evidence after the pack is archived', async () => {
    mocks.prisma.courseEnhancementPack.findUnique.mockResolvedValue(activeEnhancementRecord({
      status: 'archived',
      archivedAt: new Date('2026-06-13T02:00:00.000Z'),
    }));

    const rollback = await POST(postForm({ packId: 'enhancement-pack-1', action: 'rollback' }) as never);
    const impact = await POST(postForm({
      packId: 'enhancement-pack-1',
      itemId: 'item-1',
      action: 'impact-evidence',
    }) as never);

    expect(rollback.headers.get('location')).toContain('status=invalid-lifecycle');
    expect(impact.headers.get('location')).toContain('status=invalid-lifecycle');
    expect(mocks.prisma.courseEnhancementPack.upsert).not.toHaveBeenCalled();
  });
});

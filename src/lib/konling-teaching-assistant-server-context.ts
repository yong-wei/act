import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  parsePersistedDocumentRubricGradingDraft,
  validateDocumentRubricGradingDraftInvariants,
  type PersistedDocumentRubricGradingDraft,
} from '@/lib/data-governance/document-rubric-grading-workbench';
import {
  CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION,
} from '@/lib/data-governance/control-correction-diagnosis-profile';
import {
  normalizeKonlingRole,
  resolveKonlingTeachingAssistantMode,
  type KonlingRuntimeContext,
  type KonlingRuntimeScope,
  type KonlingTeachingAssistantServerModeContext,
} from '@/lib/konling-agent-runtime';

interface SignedModeContextPayload {
  mode: string;
  classId?: string;
  courseId?: string;
  pageId?: string;
  resourceId?: string;
  teacherId?: string;
  goalId?: string;
  graphNodeId?: string;
  classReportId?: string;
  prepPackId?: string;
  issuedAt?: string;
  expiresAt?: string;
  context: KonlingTeachingAssistantServerModeContext;
}

type VerifiedModeContextPayload = SignedModeContextPayload & {
  classId: string;
  expiresAt: string;
};

interface LearningEvidenceDraftReader {
  findFirst(input: {
    where: {
      id: string;
      sourceType: 'document_rubric_grading';
    };
  }): Promise<unknown | null>;
}

interface ClassReader {
  findUnique(input: {
    where: { id: string };
    select: { teacherId: true };
  }): Promise<{ teacherId: string | null } | null>;
}

interface TeachingResourceReader {
  findUnique(input: {
    where: { id: string };
    select: { id: true; teacherOnly: true; type: true };
  }): Promise<{ id: string; teacherOnly: boolean; type: string } | null>;
}

interface CourseEnhancementPackReader {
  findFirst(input: {
    where: {
      classId: string;
      teacherId: string;
      goalId: string;
      OR: Array<{ id: string } | { sourcePrepPackId: string }>;
    };
  }): Promise<{ id: string; sourcePrepPackId: string; classId: string; teacherId: string; goalId: string; status?: string | null } | null>;
}

interface DiagnosisReportSnapshotReader {
  findMany(input: {
    where: {
      goalId: string;
      subjectKind: 'class';
      classId: string;
      materializerVersion: typeof CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION;
    };
    orderBy?: { generatedAt: 'desc' };
    take?: number;
  }): Promise<Array<{ id: string; goalId: string; classId: string | null }>>;
}

export interface KonlingTeachingAssistantServerContextDb {
  learningEvidenceDraft?: LearningEvidenceDraftReader;
  class?: ClassReader;
  teachingResource?: TeachingResourceReader;
  courseEnhancementPack?: CourseEnhancementPackReader;
  diagnosisReportSnapshot?: DiagnosisReportSnapshotReader;
}

interface ResolvedDocumentGradingDraft {
  parsed: ReturnType<typeof parsePersistedDocumentRubricGradingDraft> & {};
}

export function createKonlingTeachingAssistantServerContextToken(payload: SignedModeContextPayload): string | null {
  const secret = resolveModeContextSigningSecret();
  if (!secret) {
    return null;
  }
  const issuedAt = payload.issuedAt ?? new Date().toISOString();
  const expiresAt = payload.expiresAt ?? new Date(Date.parse(issuedAt) + 8 * 60 * 60 * 1000).toISOString();
  const encoded = Buffer.from(JSON.stringify({ ...payload, issuedAt, expiresAt }), 'utf8').toString('base64url');
  return `${encoded}.${signModeContext(encoded, secret)}`;
}

export async function resolveKonlingTeachingAssistantServerModeContext(input: {
  db: KonlingTeachingAssistantServerContextDb;
  modeId?: string | null;
  scope: KonlingRuntimeScope;
  runtimeContext?: KonlingRuntimeContext | null;
  clientContextHints?: Record<string, unknown> | null;
}): Promise<KonlingTeachingAssistantServerModeContext> {
  const mode = resolveKonlingTeachingAssistantMode(input.modeId);
  const signedPayload = verifySignedModeContext(input.clientContextHints, {
    modeId: mode.id,
    scope: input.scope,
    hints: input.clientContextHints,
  });
  const verifiedHints = signedPayload ? {
    ...input.clientContextHints,
    ...(signedPayload.goalId ? { goalId: signedPayload.goalId } : {}),
    ...(signedPayload.graphNodeId ? { graphNodeId: signedPayload.graphNodeId } : {}),
    ...(signedPayload.classReportId ? { classReportId: signedPayload.classReportId } : {}),
    ...(signedPayload.prepPackId ? { prepPackId: signedPayload.prepPackId } : {}),
  } : input.clientContextHints;

  if (mode.id === 'resource-coach') {
    return resolveResourceCoachModeContext(input);
  }
  if (mode.id === 'path-advisor') {
    return resolvePathAdvisorModeContext({
      ...input,
      signedPayload,
    });
  }
  if (mode.id === 'grading-assistant') {
    return resolveDocumentGradingModeContext(input, 'teacher');
  }
  if (mode.id === 'feedback-explainer') {
    return resolveDocumentGradingModeContext(input, 'student');
  }
  if (mode.id === 'class-summarizer') {
    if (signedPayload) {
      if (input.scope.role !== 'teacher' && input.scope.role !== 'admin') return {};
      if (input.scope.role === 'teacher' && !await teacherOwnsClass(input.db, signedPayload.classId, input.scope.authenticatedUserId)) {
        return {};
      }
      return signedPayload.context;
    }
    return resolveClassSummarizerModeContext({ ...input, clientContextHints: verifiedHints });
  }
  if (mode.id === 'prep-coauthor') {
    return resolvePrepCoauthorModeContext({ ...input, clientContextHints: verifiedHints });
  }
  return {};
}

export function resolveKonlingTeachingAssistantSignedGraphNodeId(input: {
  modeId?: string | null;
  scope: KonlingRuntimeScope;
  clientContextHints?: Record<string, unknown> | null;
}): string | null {
  const mode = resolveKonlingTeachingAssistantMode(input.modeId);
  const signedPayload = verifySignedModeContext(input.clientContextHints, {
    modeId: mode.id,
    scope: input.scope,
    hints: input.clientContextHints,
  });
  return signedPayload?.graphNodeId ?? null;
}

export async function resolveKonlingTeachingAssistantScopeOverride(input: {
  db: KonlingTeachingAssistantServerContextDb;
  modeId?: string | null;
  authenticatedUserId: string;
  role?: string | null;
  clientContextHints?: Record<string, unknown> | null;
}): Promise<{ targetUserId?: string; classId?: string }> {
  const mode = resolveKonlingTeachingAssistantMode(input.modeId);
  if (mode.id === 'path-advisor') {
    const payload = verifySignedModeContextSignature(input.clientContextHints);
    const role = normalizeKonlingRole(input.role?.toUpperCase());
    if (
      role === 'student' &&
      payload?.mode === 'path-advisor' &&
      payload.classId &&
      payload.context['student-path-center'] === true &&
      (!payload.courseId || payload.courseId === stringHint(input.clientContextHints, 'courseId')) &&
      (!payload.pageId || payload.pageId === 'adaptive-path-center' || payload.pageId === 'student-path-center') &&
      (!payload.goalId || payload.goalId === stringHint(input.clientContextHints, 'goalId')) &&
      (!payload.graphNodeId || payload.graphNodeId === stringHint(input.clientContextHints, 'graphNodeId'))
    ) {
      return { classId: payload.classId };
    }
    return {};
  }
  if (mode.id !== 'grading-assistant' && mode.id !== 'feedback-explainer') return {};

  const resolved = await resolveDocumentGradingDraft(input);
  if (!resolved) return {};
  const role = normalizeKonlingRole(input.role?.toUpperCase());

  if (mode.id === 'grading-assistant') {
    if (role !== 'teacher' && role !== 'admin') return {};
    if (role === 'teacher' && !await teacherOwnsClass(input.db, resolved.parsed.goalContext.classId, input.authenticatedUserId)) {
      return {};
    }
    return {
      targetUserId: resolved.parsed.asset.studentId,
      classId: resolved.parsed.goalContext.classId,
    };
  }

  if (role !== 'student' || input.authenticatedUserId !== resolved.parsed.asset.studentId) return {};
  return {
    targetUserId: resolved.parsed.asset.studentId,
    classId: resolved.parsed.goalContext.classId,
  };
}

async function resolveDocumentGradingModeContext(
  input: {
    db: KonlingTeachingAssistantServerContextDb;
    scope: KonlingRuntimeScope;
    clientContextHints?: Record<string, unknown> | null;
  },
  surface: 'teacher' | 'student',
): Promise<KonlingTeachingAssistantServerModeContext> {
  const resolved = await resolveDocumentGradingDraft(input);
  if (!resolved) return {};

  if (surface === 'teacher') {
    if (input.scope.role !== 'teacher' && input.scope.role !== 'admin') return {};
    if (input.scope.classId !== resolved.parsed.goalContext.classId) return {};
    if (input.scope.targetUserId !== resolved.parsed.asset.studentId) return {};
    if (input.scope.role === 'teacher' && !await teacherOwnsClass(input.db, resolved.parsed.goalContext.classId, input.scope.authenticatedUserId)) {
      return {};
    }
    return {
      rubric: true,
      'converted-document': true,
      'draft-grading-state': true,
      'teacher-review-state': true,
    };
  }

  if (input.scope.role !== 'student') return {};
  if (input.scope.authenticatedUserId !== resolved.parsed.asset.studentId) return {};
  if (input.scope.targetUserId !== resolved.parsed.asset.studentId) return {};
  return {
    'student-feedback': resolved.parsed.run.status === 'returned' || resolved.parsed.run.status === 'approved',
    rubric: true,
  };
}

async function resolveDocumentGradingDraft(input: {
  db: KonlingTeachingAssistantServerContextDb;
  clientContextHints?: Record<string, unknown> | null;
}): Promise<ResolvedDocumentGradingDraft | null> {
  const gradingRunId = stringHint(input.clientContextHints, 'gradingRunId');
  if (!gradingRunId || !input.db.learningEvidenceDraft) return null;

  const draft = await input.db.learningEvidenceDraft.findFirst({
    where: {
      id: gradingRunId,
      sourceType: 'document_rubric_grading',
    },
  });
  if (!draft) return null;

  const persistedDraft = draft as PersistedDocumentRubricGradingDraft;
  const parsed = parsePersistedDocumentRubricGradingDraft(persistedDraft);
  if (!parsed) return null;

  const invariants = validateDocumentRubricGradingDraftInvariants({
    draft: persistedDraft,
    parsed,
  });
  return invariants.valid ? { parsed } : null;
}

async function teacherOwnsClass(
  db: KonlingTeachingAssistantServerContextDb,
  classId: string,
  teacherId: string,
): Promise<boolean> {
  const classData = await db.class?.findUnique({
    where: { id: classId },
    select: { teacherId: true },
  });
  return Boolean(classData && classData.teacherId === teacherId);
}

async function resolveClassSummarizerModeContext(input: {
  db: KonlingTeachingAssistantServerContextDb;
  scope: KonlingRuntimeScope;
  runtimeContext?: KonlingRuntimeContext | null;
  clientContextHints?: Record<string, unknown> | null;
}): Promise<KonlingTeachingAssistantServerModeContext> {
  if (input.scope.role !== 'teacher' && input.scope.role !== 'admin') return {};
  if (!input.scope.classId || !input.db.diagnosisReportSnapshot) return {};
  if (input.scope.role === 'teacher' && !await teacherOwnsClass(input.db, input.scope.classId, input.scope.authenticatedUserId)) {
    return {};
  }
  const goalId = stringHint(input.clientContextHints, 'goalId') ?? 'control-correction';
  const classReportId = stringHint(input.clientContextHints, 'classReportId');
  const rows = await input.db.diagnosisReportSnapshot.findMany({
    where: {
      goalId,
      subjectKind: 'class',
      classId: input.scope.classId,
      materializerVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION,
    },
    orderBy: { generatedAt: 'desc' },
    take: 1,
  });
  const snapshot = rows[0];
  if (!snapshot) return {};
  if (classReportId && classReportId !== snapshot.id && classReportId !== `${input.scope.classId}:${snapshot.goalId}`) return {};
  return {
    'class-report': true,
    'diagnosis-view': true,
  };
}

function resolvePrepCoauthorModeContext(input: {
  db: KonlingTeachingAssistantServerContextDb;
  scope: KonlingRuntimeScope;
  clientContextHints?: Record<string, unknown> | null;
}): Promise<KonlingTeachingAssistantServerModeContext> {
  if (input.scope.role !== 'teacher' && input.scope.role !== 'admin') return Promise.resolve({});
  if (!input.scope.classId || !input.db.courseEnhancementPack) return Promise.resolve({});
  const prepPackId = stringHint(input.clientContextHints, 'prepPackId');
  const goalId = stringHint(input.clientContextHints, 'goalId');
  if (!prepPackId || !goalId) return Promise.resolve({});
  return input.db.courseEnhancementPack.findFirst({
    where: {
      classId: input.scope.classId,
      teacherId: input.scope.authenticatedUserId,
      goalId,
      OR: [
        { id: prepPackId },
        { sourcePrepPackId: prepPackId },
      ],
    },
  }).then((pack) => {
    if (!pack) return {};
    if (pack.status === 'archived' || pack.status === 'rolled-back') return {};
    return {
      'prep-pack': true,
      'diagnosis-view': true,
      'teacher-review-state': true,
    };
  });
}

function stringHint(hints: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = hints?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function resolveResourceCoachModeContext(input: {
  db: KonlingTeachingAssistantServerContextDb;
  scope: KonlingRuntimeScope;
}): Promise<KonlingTeachingAssistantServerModeContext> {
  if (!input.scope.resourceId || !input.db.teachingResource) return {};
  const resource = await input.db.teachingResource.findUnique({
    where: { id: input.scope.resourceId },
    select: { id: true, teacherOnly: true, type: true },
  });
  if (!resource) return {};
  if (resource.teacherOnly && input.scope.role !== 'teacher' && input.scope.role !== 'admin') return {};
  return {
    'resource-node': true,
    ...(resource.type === 'STATIC_MEDIA' ? { 'media-resource': true } : {}),
  };
}

function resolvePathAdvisorModeContext(input: {
  scope: KonlingRuntimeScope;
  signedPayload: VerifiedModeContextPayload | null;
}): KonlingTeachingAssistantServerModeContext {
  if (!input.signedPayload) return {};
  if (input.scope.role !== 'student') return {};
  if (input.scope.authenticatedUserId !== input.scope.targetUserId) return {};
  if (input.signedPayload.context['student-path-center'] !== true) return {};
  return {
    ...input.signedPayload.context,
    'student-path-center': true,
  };
}

function verifySignedModeContext(
  hints: Record<string, unknown> | null | undefined,
  input: {
    modeId: string;
    scope: KonlingRuntimeScope;
    hints?: Record<string, unknown> | null;
  },
): VerifiedModeContextPayload | null {
  const token = stringHint(hints, 'modeContextToken');
  if (!token) return null;

  const payload = verifySignedModeContextSignature(hints);
  if (!payload) return null;
  if (payload.mode !== input.modeId) return null;
  if (!payload.classId || payload.classId !== input.scope.classId) return null;
  if (payload.courseId && payload.courseId !== input.scope.courseId) return null;
  if (payload.pageId && payload.pageId !== input.scope.pageId) return null;
  if (payload.resourceId && payload.resourceId !== input.scope.resourceId) return null;
  if (input.modeId === 'prep-coauthor') {
    if (!payload.teacherId || payload.teacherId !== input.scope.authenticatedUserId) return null;
    if (!payload.goalId || !payload.prepPackId) return null;
  }
  if (input.modeId === 'class-summarizer') {
    if (!payload.goalId || !payload.classReportId) return null;
  }
  if (payload.goalId && stringHint(input.hints, 'goalId') && payload.goalId !== stringHint(input.hints, 'goalId')) return null;
  if (payload.graphNodeId && stringHint(input.hints, 'graphNodeId') && payload.graphNodeId !== stringHint(input.hints, 'graphNodeId')) return null;
  if (payload.classReportId && stringHint(input.hints, 'classReportId') && payload.classReportId !== stringHint(input.hints, 'classReportId')) return null;
  if (payload.prepPackId && stringHint(input.hints, 'prepPackId') && payload.prepPackId !== stringHint(input.hints, 'prepPackId')) return null;
  if (!payload.expiresAt) return null;
  const expiresAt = Date.parse(payload.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  return payload as VerifiedModeContextPayload;
}

function verifySignedModeContextSignature(
  hints: Record<string, unknown> | null | undefined,
): SignedModeContextPayload | null {
  const token = stringHint(hints, 'modeContextToken');
  if (!token) return null;

  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const secret = resolveModeContextSigningSecret();
  if (!secret) return null;
  const expectedSignature = signModeContext(encoded, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  let payload: SignedModeContextPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SignedModeContextPayload;
  } catch {
    return null;
  }
  if (!payload.expiresAt) return null;
  const expiresAt = Date.parse(payload.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  return payload;
}

function resolveModeContextSigningSecret(): string | null {
  const secret = process.env.KONLING_SERVER_MODE_CONTEXT_SECRET ||
    process.env.KONLING_MODE_CONTEXT_SECRET ||
    '';
  const trimmed = secret.trim();
  if (!trimmed || isPlaceholderSigningSecret(trimmed)) return null;
  return trimmed;
}

function isPlaceholderSigningSecret(secret: string): boolean {
  const normalized = secret.toLowerCase();
  return normalized === 'konling-mode-context-development-secret' ||
    normalized === 'replace-with-strong-konling-context-secret' ||
    normalized === 'development-secret' ||
    normalized === 'your-secret-key' ||
    normalized === 'changeme' ||
    normalized === 'secret';
}

function signModeContext(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

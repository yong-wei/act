import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  parsePersistedDocumentRubricGradingDraft,
  validateDocumentRubricGradingDraftInvariants,
  type PersistedDocumentRubricGradingDraft,
} from '@/lib/data-governance/document-rubric-grading-workbench';
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
  context: KonlingTeachingAssistantServerModeContext;
}

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
    select: { id: true; teacherOnly: true };
  }): Promise<{ id: string; teacherOnly: boolean } | null>;
}

export interface KonlingTeachingAssistantServerContextDb {
  learningEvidenceDraft?: LearningEvidenceDraftReader;
  class?: ClassReader;
  teachingResource?: TeachingResourceReader;
}

interface ResolvedDocumentGradingDraft {
  parsed: ReturnType<typeof parsePersistedDocumentRubricGradingDraft> & {};
}

export function createKonlingTeachingAssistantServerContextToken(payload: SignedModeContextPayload): string | null {
  const secret = resolveModeContextSigningSecret();
  if (!secret) {
    return null;
  }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encoded}.${signModeContext(encoded, secret)}`;
}

export async function resolveKonlingTeachingAssistantServerModeContext(input: {
  db: KonlingTeachingAssistantServerContextDb;
  modeId?: string | null;
  scope: KonlingRuntimeScope;
  runtimeContext: KonlingRuntimeContext;
  clientContextHints?: Record<string, unknown> | null;
}): Promise<KonlingTeachingAssistantServerModeContext> {
  const mode = resolveKonlingTeachingAssistantMode(input.modeId);
  const signedContext = verifySignedModeContext(input.clientContextHints, {
    modeId: mode.id,
    scope: input.scope,
  });
  if (signedContext) return signedContext;

  if (mode.id === 'resource-coach') {
    return resolveResourceCoachModeContext(input);
  }
  if (mode.id === 'grading-assistant') {
    return resolveDocumentGradingModeContext(input, 'teacher');
  }
  if (mode.id === 'feedback-explainer') {
    return resolveDocumentGradingModeContext(input, 'student');
  }
  if (mode.id === 'class-summarizer') {
    return resolveClassSummarizerModeContext(input);
  }
  if (mode.id === 'prep-coauthor') {
    return resolvePrepCoauthorModeContext(input);
  }
  return {};
}

export async function resolveKonlingTeachingAssistantScopeOverride(input: {
  db: KonlingTeachingAssistantServerContextDb;
  modeId?: string | null;
  authenticatedUserId: string;
  role?: string | null;
  clientContextHints?: Record<string, unknown> | null;
}): Promise<{ targetUserId?: string; classId?: string }> {
  const mode = resolveKonlingTeachingAssistantMode(input.modeId);
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

function resolveClassSummarizerModeContext(input: {
  scope: KonlingRuntimeScope;
  runtimeContext: KonlingRuntimeContext;
  clientContextHints?: Record<string, unknown> | null;
}): KonlingTeachingAssistantServerModeContext {
  return {};
}

function resolvePrepCoauthorModeContext(input: {
  scope: KonlingRuntimeScope;
  clientContextHints?: Record<string, unknown> | null;
}): KonlingTeachingAssistantServerModeContext {
  return {};
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
    select: { id: true, teacherOnly: true },
  });
  if (!resource) return {};
  if (resource.teacherOnly && input.scope.role !== 'teacher' && input.scope.role !== 'admin') return {};
  return { 'resource-node': true };
}

function verifySignedModeContext(
  hints: Record<string, unknown> | null | undefined,
  input: {
    modeId: string;
    scope: KonlingRuntimeScope;
  },
): KonlingTeachingAssistantServerModeContext | null {
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
  if (payload.mode !== input.modeId) return null;
  if (payload.classId && payload.classId !== input.scope.classId) return null;
  if (payload.courseId && payload.courseId !== input.scope.courseId) return null;
  if (payload.pageId && payload.pageId !== input.scope.pageId) return null;
  if (payload.resourceId && payload.resourceId !== input.scope.resourceId) return null;
  return payload.context;
}

function resolveModeContextSigningSecret(): string | null {
  const secret = process.env.KONLING_MODE_CONTEXT_SECRET || '';
  const trimmed = secret.trim();
  if (!trimmed || isPlaceholderSigningSecret(trimmed)) return null;
  return trimmed;
}

function isPlaceholderSigningSecret(secret: string): boolean {
  const normalized = secret.toLowerCase();
  return normalized === 'konling-mode-context-development-secret' ||
    normalized === 'development-secret' ||
    normalized === 'your-secret-key' ||
    normalized === 'changeme' ||
    normalized === 'secret';
}

function signModeContext(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

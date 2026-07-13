import { createHash } from 'node:crypto';

import { Prisma, UserRole } from '@prisma/client';
import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import {
  buildDocumentRubricDraftDedupeKey,
  convertSubmissionDocument,
  createDraftRubricGrading,
  createMarkItDownConversionAdapter,
  createSubmissionAsset,
  normalizeDocumentRubricGoalDimension,
  textFixtureMarkItDownRunner,
  type RubricDefinition,
} from '@/lib/data-governance/document-rubric-grading-workbench';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import { legacyDocumentGradingRouteDisabled } from '@/lib/data-governance/math-document-grading-api';

export const dynamic = 'force-dynamic';

type SubmissionBody = {
  studentId?: string;
  classId?: string;
  assignmentId?: string;
  goalId?: string;
  targetGoal?: string;
  learningGoal?: string;
  fileName?: string;
  mimeType?: string;
  bytes?: string;
  contentEncoding?: 'utf8' | 'base64';
  rubric?: RubricDefinition;
  assetId?: string;
  preserveSpanMapping?: boolean;
};

export async function POST(request: Request) {
  try {
    if (legacyDocumentGradingRouteDisabled()) {
      return NextResponse.json({ error: 'legacy-document-grading-route-disabled', replacement: '/api/teacher/document-grading/pipeline' }, { status: 410, headers: { Deprecation: 'true' } });
    }
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    if (!isSubmissionCreatorRole(session.user.role)) {
      return NextResponse.json({ error: '无权创建文档评分提交' }, { status: 403 });
    }

    const body = await request.json() as SubmissionBody;
    if (session.user.role === UserRole.STUDENT && body.rubric) {
      return NextResponse.json({ error: '学生提交不能指定评分量规' }, { status: 403 });
    }
    if (session.user.role === UserRole.STUDENT && (body.goalId || body.targetGoal || body.learningGoal)) {
      return NextResponse.json({ error: '学生提交不能指定学习目标归因' }, { status: 403 });
    }

    const validationError = validateSubmissionBody(body, session.user.role);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
    const submission = body as Required<Pick<SubmissionBody,
      'studentId' | 'classId' | 'assignmentId' | 'fileName' | 'mimeType' | 'bytes'
    >> & SubmissionBody;

    const classData = await prisma.class.findUnique({
      where: { id: submission.classId },
      select: { id: true, teacherId: true },
    });
    if (!classData) {
      return NextResponse.json({ error: '班级不存在' }, { status: 404 });
    }
    if (session.user.role === UserRole.TEACHER && classData.teacherId !== session.user.id) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }
    if (session.user.role === UserRole.STUDENT && submission.studentId !== session.user.id) {
      return NextResponse.json({ error: '学生只能提交自己的文档' }, { status: 403 });
    }

    const studentProfile = await prisma.studentProfile.findFirst({
      where: {
        classId: submission.classId,
        userId: submission.studentId,
      },
      select: { id: true },
    });
    if (!studentProfile) {
      return NextResponse.json({ error: '学生不在该班级中' }, { status: 404 });
    }

    const serverPolicy = session.user.role === UserRole.STUDENT
      ? await resolveServerSubmissionPolicyForStudent({
          assignmentId: submission.assignmentId,
          classId: submission.classId,
        })
      : null;
    const rubric = serverPolicy?.rubric ?? submission.rubric;
    if (!rubric) {
      return NextResponse.json({ error: '作业未配置服务端评分量规' }, { status: 422 });
    }

    const uploadedAt = new Date();
    const contentEncoding = body.contentEncoding ?? 'utf8';
    const asset = createSubmissionAsset({
      id: buildSubmissionAssetId({
        studentId: submission.studentId,
        classId: submission.classId,
        assignmentId: submission.assignmentId,
        bytes: submission.bytes,
        contentEncoding,
      }),
      studentId: submission.studentId,
      classId: submission.classId,
      assignmentId: submission.assignmentId,
      fileName: submission.fileName,
      mimeType: submission.mimeType,
      bytes: submission.bytes,
      contentEncoding,
      uploadedAt: uploadedAt.toISOString(),
    });
    const convertedDocument = await convertSubmissionDocument({
      asset,
      adapter: createMarkItDownConversionAdapter({
        now: uploadedAt,
        preserveSpanMapping: body.preserveSpanMapping ?? isTextLikeMimeType(submission.mimeType),
        runner: isTextLikeMimeType(submission.mimeType)
          ? (textSubmission) => textFixtureMarkItDownRunner({
              ...textSubmission,
              bytes: decodeSubmissionTextBytes(textSubmission.bytes, textSubmission.contentEncoding),
              contentEncoding: 'utf8',
            }, true)
          : undefined,
      }),
      now: uploadedAt,
    });
    const run = createDraftRubricGrading({
      convertedDocument,
      rubric,
      now: uploadedAt,
    });
    const dedupeKey = buildDocumentRubricDraftDedupeKey(asset, run);
    const goalId = serverPolicy?.goalId ?? body.goalId ?? submission.assignmentId;
    const targetGoal = serverPolicy?.targetGoal ?? body.targetGoal ?? goalId;
    const learningGoal = serverPolicy?.learningGoal ?? body.learningGoal ?? targetGoal;
    const existingDraft = await prisma.learningEvidenceDraft.findUnique({
      where: { dedupeKey },
      select: {
        id: true,
        dedupeKey: true,
        ownerUserId: true,
        classId: true,
        sourceType: true,
        reviewerState: true,
      },
    });
    if (existingDraft &&
      (existingDraft.sourceType !== 'document_rubric_grading' ||
        existingDraft.ownerUserId !== asset.studentId ||
        existingDraft.classId !== asset.classId)) {
      return NextResponse.json({ error: '重复提交归属不一致' }, { status: 409 });
    }
    if (existingDraft && existingDraft.reviewerState !== 'pending') {
      return NextResponse.json({
        status: existingDraft.reviewerState,
        gradingRunId: existingDraft.id,
        dedupeKey: existingDraft.dedupeKey,
        preservedReviewState: true,
        asset: {
          id: asset.id,
          checksum: asset.checksum,
          format: asset.format,
          fileName: asset.fileName,
        },
        conversion: {
          status: convertedDocument.status,
          adapter: convertedDocument.adapter,
          referencePrecision: convertedDocument.referencePrecision,
          warnings: convertedDocument.warnings,
          confidence: convertedDocument.confidence,
        },
        teacherWorkbenchHref: `/teacher/grading-workbench?gradingRunId=${encodeURIComponent(existingDraft.id)}`,
      });
    }

    const data = {
      sourceRefs: toPrismaJsonObject({
        asset,
        classId: asset.classId,
        assignmentId: asset.assignmentId,
        goalId,
        targetGoal,
        learningGoal,
      }),
      summary: toPrismaJsonObject({ run, rubric }),
      evidenceRefs: toPrismaJsonObject({ convertedDocument }),
      provenance: toPrismaJsonObject({
        createdBy: session.user.id,
        createdByRole: session.user.role,
        conversion: {
          adapter: convertedDocument.adapter,
          status: convertedDocument.status,
          referencePrecision: convertedDocument.referencePrecision,
          warnings: convertedDocument.warnings,
          confidence: convertedDocument.confidence,
        },
      }),
      confidence: convertedDocument.confidence,
      reviewerState: 'pending',
      occurredAt: uploadedAt,
      classId: asset.classId,
    };
    const persisted = existingDraft
      ? await prisma.learningEvidenceDraft.update({
          where: { id: existingDraft.id },
          data,
          select: {
            id: true,
            dedupeKey: true,
            reviewerState: true,
          },
        })
      : await createDocumentRubricDraftOrReadDuplicate({
          dedupeKey,
          data: {
            id: run.id,
            ownerUserId: asset.studentId,
            sourceType: 'document_rubric_grading',
            factType: 'document_rubric_grading',
            privacyScope: 'teacher_review',
            dedupeKey,
            ...data,
          },
        });

    return NextResponse.json({
      status: persisted.reviewerState,
      gradingRunId: persisted.id,
      dedupeKey: persisted.dedupeKey,
      asset: {
        id: asset.id,
        checksum: asset.checksum,
        format: asset.format,
        fileName: asset.fileName,
      },
      conversion: {
        status: convertedDocument.status,
        adapter: convertedDocument.adapter,
        referencePrecision: convertedDocument.referencePrecision,
        warnings: convertedDocument.warnings,
        confidence: convertedDocument.confidence,
      },
      teacherWorkbenchHref: `/teacher/grading-workbench?gradingRunId=${encodeURIComponent(persisted.id)}`,
    }, { status: 201 });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[DocumentRubricGrading] submission create failed', error);
    return NextResponse.json({ error: '创建文档评分提交失败' }, { status: 500 });
  }
}

type ServerSubmissionPolicy = {
  rubric: RubricDefinition;
  goalId?: string;
  targetGoal?: string;
  learningGoal?: string;
};

async function resolveServerSubmissionPolicyForStudent(input: {
  assignmentId: string;
  classId: string;
}): Promise<ServerSubmissionPolicy | null> {
  const resource = await prisma.teachingResource.findFirst({
    where: {
      id: input.assignmentId,
      teacherOnly: false,
      lessonItems: {
        some: {
          plan: {
            sessions: {
              some: {
                classId: input.classId,
              },
            },
          },
        },
      },
    },
    select: {
      config: true,
      lessonItems: {
        where: {
          plan: {
            sessions: {
              some: {
                classId: input.classId,
              },
            },
          },
        },
        select: {
          overrideConfig: true,
        },
      },
    },
  });
  for (const item of resource?.lessonItems ?? []) {
    const overridePolicy = extractSubmissionPolicyFromAssignmentConfig(
      mergeAssignmentConfigs(resource?.config ?? null, item.overrideConfig),
    );
    if (overridePolicy) {
      return overridePolicy;
    }
  }
  return extractSubmissionPolicyFromAssignmentConfig(resource?.config ?? null);
}

async function createDocumentRubricDraftOrReadDuplicate(input: {
  dedupeKey: string;
  data: NonNullable<Parameters<typeof prisma.learningEvidenceDraft.create>[0]>['data'];
}) {
  try {
    return await prisma.learningEvidenceDraft.create({
      data: input.data,
      select: {
        id: true,
        dedupeKey: true,
        reviewerState: true,
      },
    });
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) {
      throw error;
    }
    const existing = await prisma.learningEvidenceDraft.findUnique({
      where: { dedupeKey: input.dedupeKey },
      select: {
        id: true,
        dedupeKey: true,
        reviewerState: true,
      },
    });
    if (!existing) {
      throw error;
    }
    return existing;
  }
}

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return Boolean(error &&
    typeof error === 'object' &&
    !Array.isArray(error) &&
    (error as { code?: unknown }).code === 'P2002');
}

function mergeAssignmentConfigs(base: unknown, override: unknown): unknown {
  if (!isPlainRecord(base)) return override ?? base;
  if (!isPlainRecord(override)) return override ?? base;
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    merged[key] = isPlainRecord(value) && isPlainRecord(merged[key])
      ? mergeAssignmentConfigs(merged[key], value)
      : value;
  }
  return merged;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function extractSubmissionPolicyFromAssignmentConfig(config: unknown): ServerSubmissionPolicy | null {
  const rubric = extractRubricFromAssignmentConfig(config);
  if (!rubric) return null;
  const goalContext = extractGoalContextFromAssignmentConfig(config);
  return {
    rubric,
    ...goalContext,
  };
}

function extractRubricFromAssignmentConfig(config: unknown): RubricDefinition | null {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  const record = config as Record<string, unknown>;
  const documentGrading = record.documentGrading;
  if (documentGrading && typeof documentGrading === 'object' && !Array.isArray(documentGrading)) {
    const rubric = (documentGrading as Record<string, unknown>).rubric;
    if (isRubricDefinition(rubric)) return rubric;
  }
  if (isRubricDefinition(record.documentRubric)) return record.documentRubric;
  if (isRubricDefinition(record.rubric)) return record.rubric;
  return null;
}

function extractGoalContextFromAssignmentConfig(config: unknown): Omit<ServerSubmissionPolicy, 'rubric'> {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return {};
  const record = config as Record<string, unknown>;
  const documentGrading = record.documentGrading;
  const gradingRecord = documentGrading && typeof documentGrading === 'object' && !Array.isArray(documentGrading)
    ? documentGrading as Record<string, unknown>
    : {};
  const goalId = stringFrom(gradingRecord.goalId) ?? stringFrom(record.goalId);
  const targetGoal = stringFrom(gradingRecord.targetGoal) ?? stringFrom(record.targetGoal);
  const learningGoal = stringFrom(gradingRecord.learningGoal) ?? stringFrom(record.learningGoal);
  return {
    ...(goalId ? { goalId } : {}),
    ...(targetGoal ? { targetGoal } : {}),
    ...(learningGoal ? { learningGoal } : {}),
  };
}

function validateSubmissionBody(body: SubmissionBody, role: UserRole): string | null {
  if (!isNonEmptyString(body.studentId)) return '缺少学生标识';
  if (!isNonEmptyString(body.classId)) return '缺少班级标识';
  if (!isNonEmptyString(body.assignmentId)) return '缺少作业标识';
  if (!isNonEmptyString(body.fileName)) return '缺少文件名';
  if (!isNonEmptyString(body.mimeType)) return '缺少文件类型';
  if (!isNonEmptyString(body.bytes)) return '缺少文件内容';
  if (body.contentEncoding && body.contentEncoding !== 'utf8' && body.contentEncoding !== 'base64') {
    return '文件编码无效';
  }
  if (body.assetId) {
    return '不允许客户端指定资产标识';
  }
  if (role !== UserRole.STUDENT && !isRubricDefinition(body.rubric)) {
    return '缺少有效评分量规';
  }
  return null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isSubmissionCreatorRole(role: UserRole): boolean {
  return role === UserRole.STUDENT || role === UserRole.TEACHER || role === UserRole.ADMIN;
}

function isRubricDefinition(value: unknown): value is RubricDefinition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const rubric = value as RubricDefinition;
  if (!(typeof rubric.id === 'string' &&
    typeof rubric.title === 'string' &&
    typeof rubric.version === 'string' &&
    typeof rubric.maxScore === 'number' &&
    Number.isFinite(rubric.maxScore) &&
    rubric.maxScore > 0 &&
    Array.isArray(rubric.criteria) &&
    rubric.criteria.length > 0)) {
    return false;
  }
  if (!hasUniqueIds(rubric.criteria)) {
    return false;
  }
  return rubric.criteria.every((criterion) => typeof criterion.id === 'string' &&
      typeof criterion.label === 'string' &&
      typeof criterion.weight === 'number' &&
      Number.isFinite(criterion.weight) &&
      criterion.weight >= 0 &&
      typeof criterion.evidenceRequirement === 'string' &&
      typeof criterion.goalDimension === 'string' &&
      isSupportedRubricGoalDimension(criterion.goalDimension) &&
      Array.isArray(criterion.levels) &&
      criterion.levels.length > 0 &&
      hasUniqueIds(criterion.levels) &&
      criterion.levels.every((level) => typeof level.id === 'string' &&
        typeof level.label === 'string' &&
        typeof level.score === 'number' &&
        Number.isFinite(level.score) &&
        level.score >= 0 &&
        level.score <= rubric.maxScore &&
        typeof level.description === 'string'));
}

function hasUniqueIds(items: Array<{ id?: unknown }>): boolean {
  const ids = items.map((item) => item.id);
  return ids.every((id) => typeof id === 'string' && id.length > 0) &&
    new Set(ids).size === ids.length;
}

function stringFrom(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function isSupportedRubricGoalDimension(value: string): boolean {
  try {
    normalizeDocumentRubricGoalDimension(value);
    return true;
  } catch {
    return false;
  }
}

function isTextLikeMimeType(mimeType: string): boolean {
  return mimeType.startsWith('text/') || mimeType.includes('markdown') || mimeType.includes('json');
}

function buildSubmissionAssetId(input: {
  studentId: string;
  classId: string;
  assignmentId: string;
  bytes: string;
  contentEncoding: 'utf8' | 'base64';
}): string {
  const decoded = input.contentEncoding === 'base64'
    ? Buffer.from(input.bytes.replace(/^data:[^;]+;base64,/, ''), 'base64')
    : input.bytes;
  const digest = createHash('sha256').update(decoded).digest('hex').slice(0, 16);
  return `asset:${input.studentId}:${input.classId}:${input.assignmentId}:${digest}`;
}

function decodeSubmissionTextBytes(bytes: string, contentEncoding: 'utf8' | 'base64'): string {
  if (contentEncoding === 'base64') {
    return Buffer.from(bytes.replace(/^data:[^;]+;base64,/, ''), 'base64').toString('utf8');
  }
  return bytes;
}

function toPrismaJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

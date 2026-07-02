import {
  buildGraphCenterPayload,
  type GraphCenterDomain,
} from './graph-center';
import { buildGraphCenterCoverageSources } from './graph-center-sources';
import type { PortraitV2DimensionId } from './kaq-objective-taxonomy';
import {
  createTeacherKaqEvidenceTracePayload,
  type TeacherKaqEvidenceTracePayload,
  type TeacherKaqEvidenceTraceQuery,
} from './teacher-kaq-evidence-trace';
import { prisma } from '@/lib/prisma';

export class TeacherKaqEvidenceTraceRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface TeacherKaqEvidenceTraceSessionUser {
  id: string;
  role?: string | null;
}

export async function loadTeacherKaqEvidenceTracePayloadForUser(input: {
  sessionUser: TeacherKaqEvidenceTraceSessionUser;
  classId: string;
  searchParams: URLSearchParams;
}): Promise<TeacherKaqEvidenceTracePayload> {
  if (input.sessionUser.role !== 'TEACHER' && input.sessionUser.role !== 'ADMIN') {
    throw new TeacherKaqEvidenceTraceRequestError(403, '权限不足');
  }

  const query = parseTeacherKaqEvidenceTraceSearchParams(input.searchParams);
  const classData = await prisma.class.findUnique({
    where: { id: input.classId },
    select: {
      id: true,
      name: true,
      code: true,
      teacherId: true,
    },
  });

  if (!classData) {
    throw new TeacherKaqEvidenceTraceRequestError(404, '班级不存在');
  }

  if (classData.teacherId !== input.sessionUser.id && input.sessionUser.role !== 'ADMIN') {
    throw new TeacherKaqEvidenceTraceRequestError(403, '权限不足');
  }

  const student = query.studentId
    ? await prisma.studentProfile.findFirst({
        where: {
          classId: input.classId,
          userId: query.studentId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })
    : null;

  if (query.studentId && !student) {
    throw new TeacherKaqEvidenceTraceRequestError(404, '学生不在该班级中');
  }

  const coverageSources = await buildGraphCenterCoverageSources({
    viewerRole: input.sessionUser.role === 'ADMIN' ? 'ADMIN' : 'TEACHER',
    viewerUserId: input.sessionUser.id,
    requestedLearnerId: query.studentId,
    requestedClassId: input.classId,
  });
  const graphPayload = buildGraphCenterPayload({
    domain: query.domain,
    objectiveId: query.objectiveId,
    portraitDimension: query.portraitDimension,
    selectedNodeId: query.nodeId,
    viewerRole: input.sessionUser.role === 'ADMIN' ? 'ADMIN' : 'TEACHER',
    sarAssociation: {
      enabled: true,
      studentId: query.studentId,
      classId: input.classId,
      trustedScope: true,
    },
    ...coverageSources,
  });

  return createTeacherKaqEvidenceTracePayload({
    classInfo: {
      id: classData.id,
      name: classData.name,
      code: classData.code,
    },
    student: student
        ? {
          id: student.user.id,
          name: student.user.name ?? '未命名学生',
          studentNumber: student.studentNumber,
        }
      : null,
    graphPayload,
    query,
  });
}

export function parseTeacherKaqEvidenceTraceSearchParams(searchParams: URLSearchParams): TeacherKaqEvidenceTraceQuery {
  return {
    domain: parseDomain(searchParams.get('domain')),
    objectiveId: normalizeSearchParam(searchParams.get('objectiveId')),
    portraitDimension: normalizeSearchParam(searchParams.get('portraitDimension')) as PortraitV2DimensionId | null,
    nodeId: normalizeSearchParam(searchParams.get('nodeId')),
    studentId: normalizeSearchParam(searchParams.get('studentId')),
  };
}

function parseDomain(value: string | null): GraphCenterDomain | undefined {
  if (value === 'knowledge' || value === 'capability' || value === 'quality') return value;
  return undefined;
}

function normalizeSearchParam(value: string | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

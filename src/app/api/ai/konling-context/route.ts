/**
 * Konling (AI Assistant) Context API
 *
 * Provides pre-aggregated student context for AI assistant.
 * Target response time: < 100ms
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import {
  isAdaptiveLearnerStateServiceEnabled,
  readAdaptiveLearnerState,
} from '@/lib/data-governance/adaptive-learner-state-service';
import {
  buildKonlingDualDomainProvenanceMetadataPayload,
  buildKonlingRuntimeContext,
  type KonlingKnowledgeWorkspaceHint,
} from '@/lib/konling-agent-runtime';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || session.user.id;
    const classId = searchParams.get('classId');
    const courseId = searchParams.get('courseId');
    const pageId = searchParams.get('pageId');
    const resourceId = searchParams.get('resourceId');
    const pathNodeId = searchParams.get('pathNodeId');
    const knowledgeWorkspaceHint = buildKnowledgeWorkspaceHint(searchParams);

    // Only allow viewing own data unless teacher/admin
    const isTeacherOrAdmin = session.user.role === 'TEACHER' || session.user.role === 'ADMIN';
    if (userId !== session.user.id && !isTeacherOrAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (session.user.role === 'TEACHER' && userId !== session.user.id) {
      const scope = await verifyTeacherStudentScope({
        teacherId: session.user.id,
        studentId: userId,
        classId,
      });
      if (!scope.ok) {
        return NextResponse.json({ error: scope.error }, { status: scope.status });
      }
    }

    const learnerState = isAdaptiveLearnerStateServiceEnabled()
      ? await readAdaptiveLearnerState(prisma, {
          userId,
          classId,
          role: session.user.role === 'ADMIN'
            ? 'admin'
            : session.user.role === 'TEACHER'
              ? 'teacher'
              : 'student',
          portraitConsumer: 'konling',
        }).catch((error) => {
          console.error('[KonlingContext] Learner state read failed:', error);
          return null;
        })
      : null;

    const runtimeContext = await buildKonlingRuntimeContext(prisma, {
      authenticatedUserId: session.user.id,
      authenticatedUserName: session.user.name,
      role: session.user.role,
      targetUserId: userId,
      classId,
      courseId,
      pageId,
      resourceId,
      pathNodeId,
      knowledgeWorkspaceHint,
    }).catch((error) => {
      console.error('[KonlingContext] Runtime context read failed:', error);
      return null;
    });

    // Fetch optimized profile summary (should be < 100ms)
    const profile = await prisma.studentProfileSummary.findUnique({
      where: { userId },
    });

    if (!profile) {
      // Return default context if no profile exists yet
      return NextResponse.json({
        student_profile_context: {
          overall_level: '数据采集中',
          overall_score: 0,
          strengths: [],
          weaknesses: [],
          recent_trend: '暂无数据',
          trend_direction: 'stable',
          risk_flags: [],
          risk_level: 'none',
          recommended_scaffolding: '继续学习以生成个性化建议',
        },
        current_task_context: {
          page_type: runtimeContext?.pageContext.pageType ?? 'unknown',
          course_id: runtimeContext?.pageContext.courseId ?? null,
          current_step: runtimeContext?.pageContext.stepId ?? null,
          completion_rate: 0,
          relevant_weaknesses: [],
        },
        competency_vector: null,
        learner_state_context: learnerState,
        plan_context: runtimeContext?.planContext ?? null,
        knowledge_workspace_context: runtimeContext?.knowledgeWorkspace ?? null,
        teaching_projection_context: runtimeContext?.teachingProjectionContext ?? null,
        dual_domain_provenance: buildKonlingDualDomainProvenanceMetadataPayload(runtimeContext),
        scoped_memory: runtimeContext?.memory ?? [],
        permitted_tools: runtimeContext?.permittedTools ?? [],
        missing_context: runtimeContext?.missingContext ?? [],
      });
    }

    // PORTRAIT_V2_TRUSTED_BOUNDARY: legacy competency vector is compatibility-only
    // and must not surface when the current trusted portrait is NO_EVIDENCE or unavailable.
    const hasTrustedPortraitForLegacyVector = Boolean(
      learnerState?.primaryPortraitState === 'SNAPSHOT'
      && learnerState?.primaryPortraitAvailability === 'available'
    );
    const snapshot = hasTrustedPortraitForLegacyVector
      ? await prisma.studentCompetencySnapshot.findFirst({
          where: { userId },
          orderBy: { snapshotAt: 'desc' },
        })
      : null;

    const response = {
      student_profile_context: {
        overall_level: profile.overallLevel,
        overall_score: profile.overallScore,
        strengths: profile.strengthsJson as string[],
        weaknesses: profile.weaknessesJson as string[],
        recent_trend: profile.recentTrend,
        trend_direction: profile.trendDirection,
        risk_flags: profile.riskFlagsJson as string[],
        risk_level: profile.riskLevel,
        recommended_scaffolding: profile.recommendedScaffolding,
      },
      current_task_context: {
        page_type: runtimeContext?.pageContext.pageType ?? 'unknown',
        course_id: runtimeContext?.pageContext.courseId ?? null,
        current_step: runtimeContext?.pageContext.stepId ?? null,
        completion_rate: 0,
        relevant_weaknesses: (profile.weaknessesJson as string[]) || [],
      },
      competency_vector: snapshot?.competencyVector || null,
      learner_state_context: learnerState,
      plan_context: runtimeContext?.planContext ?? null,
      knowledge_workspace_context: runtimeContext?.knowledgeWorkspace ?? null,
      teaching_projection_context: runtimeContext?.teachingProjectionContext ?? null,
      dual_domain_provenance: buildKonlingDualDomainProvenanceMetadataPayload(runtimeContext),
      scoped_memory: runtimeContext?.memory ?? [],
      permitted_tools: runtimeContext?.permittedTools ?? [],
      missing_context: runtimeContext?.missingContext ?? [],
    };

    return NextResponse.json(response);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[KonlingContext] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function buildKnowledgeWorkspaceHint(searchParams: URLSearchParams): KonlingKnowledgeWorkspaceHint | null {
  const selectedNodeId = searchParams.get('selectedNodeId');
  const requestedNodeId = searchParams.get('requestedNodeId');
  const hoveredNodeId = searchParams.get('hoveredNodeId');
  const status = parseKnowledgeWorkspaceStatus(searchParams.get('status'));
  const activeFilters = [
    ...searchParams.getAll('activeFilters'),
    ...splitDelimitedParam(searchParams.get('activeFilterSummary')),
  ].flatMap(splitDelimitedParam);
  const hint: KonlingKnowledgeWorkspaceHint = {
    selectedNodeId,
    requestedNodeId,
    status,
    activeFilters,
    densityMode: searchParams.get('densityMode'),
    viewMode: searchParams.get('viewMode'),
    visibleRelationCount: parseCount(searchParams.get('visibleRelationCount')),
    selectedNodeRelationCount:
      parseCount(searchParams.get('selectedNodeRelationCount'))
      ?? parseCount(searchParams.get('selectedRelationCount')),
  };

  if (
    selectedNodeId
    || requestedNodeId
    || hoveredNodeId
    || status
    || activeFilters.length > 0
    || hint.densityMode
    || hint.viewMode
    || hint.visibleRelationCount
    || hint.selectedNodeRelationCount
  ) {
    return hint;
  }

  return null;
}

function parseKnowledgeWorkspaceStatus(value: string | null): KonlingKnowledgeWorkspaceHint['status'] {
  if (value === 'selected-node' || value === 'no-selection' || value === 'degraded') return value;
  return null;
}

function splitDelimitedParam(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[|,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCount(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

async function verifyTeacherStudentScope(input: {
  teacherId: string;
  studentId: string;
  classId: string | null;
}): Promise<{ ok: true } | { ok: false; status: 400 | 403 | 404; error: string }> {
  if (!input.classId) {
    return {
      ok: false,
      status: 400,
      error: '教师读取 Konling 学习上下文必须提供 classId',
    };
  }

  const classData = await prisma.class.findUnique({
    where: { id: input.classId },
    select: { id: true, teacherId: true },
  });

  if (!classData) {
    return {
      ok: false,
      status: 404,
      error: '班级不存在',
    };
  }

  if (classData.teacherId !== input.teacherId) {
    return {
      ok: false,
      status: 403,
      error: '无权查看该班级 Konling 学习上下文',
    };
  }

  const studentProfile = await prisma.studentProfile.findFirst({
    where: {
      userId: input.studentId,
      classId: input.classId,
    },
    select: {
      userId: true,
      classId: true,
    },
  });

  if (!studentProfile) {
    return {
      ok: false,
      status: 404,
      error: '学生不在该班级中',
    };
  }

  return { ok: true };
}

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

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || session.user.id;

    // Only allow viewing own data unless teacher/admin
    const isTeacherOrAdmin = session.user.role === 'TEACHER' || session.user.role === 'ADMIN';
    if (userId !== session.user.id && !isTeacherOrAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
          page_type: 'unknown',
          course_id: null,
          current_step: null,
          completion_rate: 0,
          relevant_weaknesses: [],
        },
        competency_vector: null,
      });
    }

    // Get latest competency snapshot for full vector
    const snapshot = await prisma.studentCompetencySnapshot.findFirst({
      where: { userId },
      orderBy: { snapshotAt: 'desc' },
    });

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
        page_type: 'unknown', // To be populated from request context
        course_id: null,
        current_step: null,
        completion_rate: 0,
        relevant_weaknesses: (profile.weaknessesJson as string[]) || [],
      },
      competency_vector: snapshot?.competencyVector || null,
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

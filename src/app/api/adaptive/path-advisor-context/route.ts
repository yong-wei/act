import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import {
  createKonlingTeachingAssistantServerContextToken,
} from '@/lib/konling-teaching-assistant-server-context';
import { getAdaptivePathAdvisorGoalContext } from '@/features/personalization/path-planning/public-api';
import { isRegisteredAdaptiveLearningPathGoal } from '@/features/personalization/path-planning/public-api';
import {
  adaptiveGenerationReadinessFromEngineeringGraphSelection,
  buildAdaptiveGenerationReadiness,
  type AdaptiveGenerationReadiness,
} from '@/features/personalization/path-planning/public-api';
import { expandLearningGoalSubgraph } from '@/lib/graphs/goal-subgraph-expansion-service';
import { resolveEngineeringGraphProductionSelection } from '@/lib/versioned-knowledge-activation/resolve';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const goalId = url.searchParams.get('goal');
  const graphNodeId = url.searchParams.get('graphNodeId')?.trim() || null;
  if (!goalId || !isRegisteredAdaptiveLearningPathGoal(goalId)) {
    return NextResponse.json({ error: '学习路径目标未注册' }, { status: 400 });
  }
  if (graphNodeId && !isGraphNodeInLearningGoalSubgraph(goalId, graphNodeId)) {
    return NextResponse.json({ error: '图谱节点不属于当前学习路径目标' }, { status: 400 });
  }

  const session = await getServerAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: '请先登录后再生成学习路径' }, { status: 401 });
  }
  if (session.user.role !== 'STUDENT') {
    return readinessError('当前入口仅支持学生生成个人学习路径', 403, buildAdaptiveGenerationReadiness({
      reason: 'advisor-forbidden',
      source: 'path-advisor',
    }));
  }

  const classId = readOptionalClassId(session.user.profile?.classId);
  const goalContext = getAdaptivePathAdvisorGoalContext(goalId);
  if (!goalContext) {
    return NextResponse.json({ error: '学习路径目标暂不可用于路径顾问' }, { status: 400 });
  }
  const modeContextToken = createKonlingTeachingAssistantServerContextToken({
    mode: 'path-advisor',
    ...(classId ? { classId } : {}),
    courseId: goalId,
    pageId: 'adaptive-path-center',
    goalId,
    ...(graphNodeId ? { graphNodeId } : {}),
    context: {
      'student-path-center': true,
      'learner-state-summary': true,
      'evidence-citations': true,
      'path-execution-context': true,
      ...(graphNodeId ? { 'graph-node-context': true } : {}),
    },
  });
  if (!modeContextToken) {
    return readinessError('学习路径生成服务尚未配置', 503, buildAdaptiveGenerationReadiness({
      reason: 'service-unavailable',
      source: 'path-advisor',
    }));
  }

  const graphReadiness = adaptiveGenerationReadinessFromEngineeringGraphSelection(
    resolveEngineeringGraphProductionSelection(),
  );

  return NextResponse.json({
    goalId,
    classId,
    graphNodeId,
    modeContextToken,
    readiness: graphReadiness ?? buildAdaptiveGenerationReadiness({ reason: 'ready', source: 'path-advisor' }),
    ...goalContext,
  });
}

function readOptionalClassId(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isGraphNodeInLearningGoalSubgraph(goalId: string, graphNodeId: string): boolean {
  const expansion = expandLearningGoalSubgraph(goalId);
  return [
    ...expansion.graphNodeIds.knowledge,
    ...expansion.graphNodeIds.capability,
    ...expansion.graphNodeIds.quality,
  ].includes(graphNodeId);
}

function readinessError(error: string, status: 403 | 503, readiness: AdaptiveGenerationReadiness) {
  return NextResponse.json({ error, readiness }, { status });
}

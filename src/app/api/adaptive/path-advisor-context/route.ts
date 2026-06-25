import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import {
  createKonlingTeachingAssistantServerContextToken,
} from '@/lib/konling-teaching-assistant-server-context';
import { getAdaptivePathAdvisorGoalContext } from '@/lib/adaptive-path-goal-options';
import { isRegisteredAdaptiveLearningPathGoal } from '@/lib/adaptive-learning-path-planner';
import { expandLearningGoalSubgraph } from '@/lib/graphs/goal-subgraph-expansion-service';

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
    return NextResponse.json({ error: '当前入口仅支持学生生成个人学习路径' }, { status: 403 });
  }

  const classId = session.user.profile?.classId ?? null;
  if (!classId) {
    return NextResponse.json({ error: '当前账号缺少班级信息，暂不能生成学习路径' }, { status: 403 });
  }

  const goalContext = getAdaptivePathAdvisorGoalContext(goalId);
  if (!goalContext) {
    return NextResponse.json({ error: '学习路径目标暂不可用于路径顾问' }, { status: 400 });
  }
  const modeContextToken = createKonlingTeachingAssistantServerContextToken({
    mode: 'path-advisor',
    classId,
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
    return NextResponse.json({ error: '学习路径生成服务尚未配置' }, { status: 503 });
  }

  return NextResponse.json({
    goalId,
    classId,
    graphNodeId,
    modeContextToken,
    ...goalContext,
  });
}

function isGraphNodeInLearningGoalSubgraph(goalId: string, graphNodeId: string): boolean {
  const expansion = expandLearningGoalSubgraph(goalId);
  return [
    ...expansion.graphNodeIds.knowledge,
    ...expansion.graphNodeIds.capability,
    ...expansion.graphNodeIds.quality,
  ].includes(graphNodeId);
}

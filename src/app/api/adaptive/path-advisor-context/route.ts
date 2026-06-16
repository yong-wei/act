import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import {
  createKonlingTeachingAssistantServerContextToken,
} from '@/lib/konling-teaching-assistant-server-context';
import { isRegisteredAdaptiveLearningPathGoal } from '@/lib/adaptive-learning-path-planner';

export const dynamic = 'force-dynamic';

const PATH_ADVISOR_GOAL_CONTEXTS: Record<string, {
  courseTitle: string;
  topic: string;
  learningObjectives: string[];
}> = {
  'control-correction': {
    courseTitle: '控制系统校正设计',
    topic: '控制系统校正学习路径',
    learningObjectives: ['基于控制校正学习证据生成、比较和调整学习路径'],
  },
  'frequency-response-foundations': {
    courseTitle: '频率响应基础',
    topic: '频率响应基础学习路径',
    learningObjectives: ['基于频率响应学习证据生成、比较和调整学习路径'],
  },
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const goalId = url.searchParams.get('goal');
  if (!goalId || !isRegisteredAdaptiveLearningPathGoal(goalId)) {
    return NextResponse.json({ error: '学习路径目标未注册' }, { status: 400 });
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

  const goalContext = PATH_ADVISOR_GOAL_CONTEXTS[goalId] ?? {
    courseTitle: goalId,
    topic: '学习路径',
    learningObjectives: ['基于学习证据生成、比较和调整学习路径'],
  };
  const modeContextToken = createKonlingTeachingAssistantServerContextToken({
    mode: 'path-advisor',
    classId,
    courseId: goalId,
    pageId: 'adaptive-path-center',
    goalId,
    context: {
      'student-path-center': true,
      'learner-state-summary': true,
      'evidence-citations': true,
      'path-execution-context': true,
    },
  });
  if (!modeContextToken) {
    return NextResponse.json({ error: '学习路径生成服务尚未配置' }, { status: 503 });
  }

  return NextResponse.json({
    goalId,
    classId,
    modeContextToken,
    ...goalContext,
  });
}

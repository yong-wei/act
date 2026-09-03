import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { getConfiguredAIModel, isConfiguredAIServiceAvailable } from '@/lib/ai/provider-runtime';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface TeacherInsightPayload {
  mode: 'teacher';
  classGoalAttainment: number;
  joinedCount: number;
  submitCount: number;
  abilityStats: Array<{ abilityPoint: string; accuracy: number }>;
}

interface StudentInsightPayload {
  mode: 'student';
  studentName: string;
  precheckScore: number;
  consistencyScore: number;
  weakestAbility: string;
}

type InsightPayload = TeacherInsightPayload | StudentInsightPayload;

function buildFallback(payload: InsightPayload): string {
  if (payload.mode === 'teacher') {
    const weakest = [...payload.abilityStats].sort((a, b) => a.accuracy - b.accuracy)[0];
    return `本节课整体达成度 ${payload.classGoalAttainment}%。建议下一轮优先补强“${weakest?.abilityPoint ?? '工程约束表达'}”，并针对未提交学生安排一次补测。`;
  }
  return `${payload.studentName} 的一致性表现为 ${payload.consistencyScore}%。建议优先强化“${payload.weakestAbility}”，再进行一次小步迭代验证。`;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as InsightPayload;
    if (!payload?.mode) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    if (!(await isConfiguredAIServiceAvailable())) {
      return NextResponse.json({ text: buildFallback(payload), source: 'fallback' });
    }

    const prompt =
      payload.mode === 'teacher'
        ? `你是控制课程教研助教。基于以下课堂数据生成一段中文洞察（60字以内，务实）：
班级达成度=${payload.classGoalAttainment}%
已加入=${payload.joinedCount}，已提交前测=${payload.submitCount}
能力统计=${payload.abilityStats.map((item) => `${item.abilityPoint}:${item.accuracy.toFixed(1)}%`).join('；')}
要求：先指出最需要关注的一项能力，再给出一条可执行的下一步教学建议。`
        : `你是控制课程学习助教。基于以下数据给学生一句中文洞察（50字以内，务实）：
学生=${payload.studentName}
前测得分=${payload.precheckScore}%
一致性得分=${payload.consistencyScore}%
薄弱能力=${payload.weakestAbility}
要求：先评价当前状态，再给出一条下一步改进建议。`;

    const generated = await generateText({
      model: await getConfiguredAIModel(),
      prompt,
      temperature: 0.2,
      maxOutputTokens: 160,
    });

    return NextResponse.json({ text: generated.text.trim(), source: 'llm' });
  } catch (error) {
    console.error('Cruise summary insight generation failed', error);
    return NextResponse.json({ text: '课堂洞察暂不可用，请按薄弱能力点继续迭代。', source: 'fallback' }, { status: 200 });
  }
}

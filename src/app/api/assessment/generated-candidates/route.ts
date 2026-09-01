import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  createGeneratedCandidate,
  publicGeneratedCandidateSummary,
  type GeneratedCandidateContent,
  type GeneratedAssessmentKind,
} from '@/features/assessment/generated-candidate-governance';
import {
  loadGeneratedCandidateStore,
  persistGeneratedCandidateStore,
} from '@/features/assessment/generated-candidate-persistence';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '请先登录后再创建生成候选' }, { status: 401 });
    }
    if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '只有教师或管理员可以创建可发布候选' }, { status: 403 });
    }
    const body = await request.json() as {
      generationKind?: GeneratedAssessmentKind;
      content?: GeneratedCandidateContent;
      promptTemplateVersion?: string;
      provider?: string;
      model?: string;
      promptText?: string;
      modelResponseText?: string;
      knowledgeSourceRefs?: Array<{ ref: string; hash: string }>;
    };
    if (body.generationKind === 'template') {
      return NextResponse.json({ error: '模板练习不得作为发布候选' }, { status: 400 });
    }
    if (!body.content) {
      return NextResponse.json({ error: '缺少候选内容' }, { status: 400 });
    }
    const store = await loadGeneratedCandidateStore(prisma);
    const created = createGeneratedCandidate(store, {
      generationKind: body.generationKind === 'human' ? 'human' : 'ai',
      createdByUserId: session.user.id,
      generationServiceId: body.generationKind === 'ai' ? 'assessment-generation-service' : undefined,
      provider: body.provider ?? null,
      model: body.model ?? null,
      promptTemplateVersion: body.promptTemplateVersion ?? 'adaptive-question-template.v1',
      promptText: body.promptText,
      modelResponseText: body.modelResponseText,
      knowledgeSourceRefs: body.knowledgeSourceRefs ?? [],
      generationParams: {},
      content: body.content,
    });
    await persistGeneratedCandidateStore(prisma, store);
    return NextResponse.json({
      candidate: publicGeneratedCandidateSummary(created.record, created.revision),
      findings: created.findings,
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return NextResponse.json({
      error: '创建生成候选失败',
      message: error instanceof Error ? error.message : '未知错误',
    }, { status: 400 });
  }
}

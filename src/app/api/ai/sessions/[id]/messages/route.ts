/**
 * 控灵会话消息 API
 *
 * 管理会话消息的增删改查
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { StreamingTextResponse, streamText } from 'ai';
import { getAIModel } from '@/lib/ai-client';
import { buildKonlingSystemPrompt } from '@/lib/ai-prompt-builder';
import type { AIContext } from '@/types/ai-context';
import type { Message } from 'ai/react';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/ai/sessions/[id]/messages
 * 发送消息并获取AI回复
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: sessionId } = await context.params;
    const body = await request.json();
    const { content, pageContext, userProfile } = body;

    if (!content) {
      return NextResponse.json(
        { error: 'Missing content' },
        { status: 400 }
      );
    }

    // 获取会话
    const konlingSession = await prisma.konlingSession.findUnique({
      where: { id: sessionId },
    });

    if (!konlingSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (konlingSession.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // 获取现有消息
    const existingMessages = (konlingSession.messages as unknown as Message[]) || [];

    // 添加用户消息
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
    };

    const updatedMessages = [...existingMessages, userMessage];

    // 构建AI上下文
    const aiContext: AIContext = {
      page: pageContext || {
        courseId: konlingSession.courseId,
        courseTitle: konlingSession.courseId,
        pageType: 'theory',
        stepId: konlingSession.pageId,
        topic: konlingSession.title,
        learningObjectives: [],
        knowledgeType: 'C',
      },
      user: userProfile || {
        id: session.user.id,
        name: session.user.name || '同学',
        learningStyle: 'VISUAL',
        cognitiveLevel: 3,
        abilityVector: {
          computational: 0.5,
          crossDomain: 0.5,
          design: 0.5,
          analysis: 0.5,
          evaluation: 0.5,
        },
      },
      sessionHistory: existingMessages,
    };

    // 生成系统提示词
    const systemPrompt = buildKonlingSystemPrompt(aiContext);

    // 调用AI
    const result = await streamText({
      model: getAIModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        ...updatedMessages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
      maxTokens: 1000,
      temperature: 0.7,
    });

    // 收集完整回复
    let assistantContent = '';
    for await (const chunk of result.textStream) {
      assistantContent += chunk;
    }

    // 添加助手回复
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: assistantContent,
    };

    const finalMessages = [...updatedMessages, assistantMessage];

    // 更新会话
    await prisma.konlingSession.update({
      where: { id: sessionId },
      data: {
        messages: finalMessages as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      messages: finalMessages,
      assistantMessage,
    });
  } catch (error) {
    console.error('Error in POST /api/ai/sessions/[id]/messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/ai/sessions/[id]/messages
 * 更新会话消息（批量替换）
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: sessionId } = await context.params;
    const body = await request.json();
    const { messages } = body;

    // 验证会话所有权
    const konlingSession = await prisma.konlingSession.findUnique({
      where: { id: sessionId },
    });

    if (!konlingSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (konlingSession.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // 更新消息
    await prisma.konlingSession.update({
      where: { id: sessionId },
      data: {
        messages: messages as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PUT /api/ai/sessions/[id]/messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';

interface FeedbackRecord {
  userId: string;
  sessionId: string;
  interventionId: string;
  wasHelpful: boolean;
  studentResponse?: string;
  createdAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __aiInterventionFeedbackStore: FeedbackRecord[] | undefined;
}

function getStore(): FeedbackRecord[] {
  if (!globalThis.__aiInterventionFeedbackStore) {
    globalThis.__aiInterventionFeedbackStore = [];
  }
  return globalThis.__aiInterventionFeedbackStore;
}

interface FeedbackRequest {
  userId?: string;
  sessionId: string;
  interventionId: string;
  wasHelpful: boolean;
  studentResponse?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FeedbackRequest;
    const store = getStore();

    store.push({
      userId: body.userId ?? 'demo-user',
      sessionId: body.sessionId,
      interventionId: body.interventionId,
      wasHelpful: body.wasHelpful,
      studentResponse: body.studentResponse,
      createdAt: Date.now(),
    });

    return NextResponse.json({
      success: true,
      savedCount: store.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: '反馈记录失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 400 }
    );
  }
}

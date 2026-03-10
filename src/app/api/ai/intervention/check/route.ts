import { NextResponse } from 'next/server';
import {
  shouldIntervene,
  type InterventionRules,
  type StudentState,
} from '@/features/ai/companion/intervention-engine';

interface CheckRequest {
  studentState: StudentState;
  interventionRules?: Partial<InterventionRules>;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CheckRequest;
    const decision = shouldIntervene(body.studentState, body.interventionRules);
    return NextResponse.json(decision);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'AI介入判定失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 400 }
    );
  }
}

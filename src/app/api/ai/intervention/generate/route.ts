import { NextResponse } from 'next/server';
import {
  generateIntervention,
  shouldIntervene,
  type InterventionDecision,
  type StudentState,
} from '@/features/ai/companion/intervention-engine';

interface GenerateRequest {
  studentState: StudentState;
  decision?: InterventionDecision;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateRequest;
    const decision = body.decision ?? shouldIntervene(body.studentState);
    const intervention = generateIntervention(decision, body.studentState);

    return NextResponse.json({
      decision,
      intervention,
      interventionId: `intv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'AI介入生成失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 400 }
    );
  }
}

import { NextResponse } from 'next/server';
import { calculateTimeDomainResponse, type TimeDomainRequest } from '@/lib/control/linkage-engine';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TimeDomainRequest;
    const result = calculateTimeDomainResponse(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: '时域计算失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 400 }
    );
  }
}

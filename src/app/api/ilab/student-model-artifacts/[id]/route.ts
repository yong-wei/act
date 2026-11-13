/**
 * 学生辨识工件详情（issue-2152-p1）：仅本人可读。
 */
import { NextRequest, NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import { createDatabaseUnavailableResponse, isDatabaseConnectivityError } from '@/lib/service-availability';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '请先登录后再查看模型记录' }, { status: 401 });
    }
    const { id } = await params;
    const artifact = await prisma.studentModelArtifact.findFirst({
      where: { id, userId: session.user.id },
    });
    // 他人工件与不存在同样返回 404，不泄露存在性。
    if (!artifact) {
      return NextResponse.json({ error: '未找到该模型记录' }, { status: 404 });
    }
    return NextResponse.json({ artifact });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (isDatabaseConnectivityError(error)) {
      return createDatabaseUnavailableResponse();
    }
    return NextResponse.json({ error: '暂时无法读取模型记录' }, { status: 500 });
  }
}

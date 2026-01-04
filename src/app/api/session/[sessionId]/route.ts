import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SessionStatus, BopppsStage } from '@prisma/client';

export async function PATCH(request: Request, { params }: { params: { sessionId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = params;

    // 验证课堂存在且属于当前教师
    const existingSession = await prisma.classSession.findUnique({
      where: { id: sessionId },
      select: { teacherId: true, status: true }
    });

    if (!existingSession) {
      return NextResponse.json({ error: '课堂不存在' }, { status: 404 });
    }

    if (existingSession.teacherId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '无权限修改此课堂' }, { status: 403 });
    }

    const body = await request.json();
    const { currentItemId, currentStage, status } = body;

    // 构建更新数据
    const updateData: {
      currentItemId?: string;
      currentStage?: BopppsStage | null;
      status?: SessionStatus;
      endTime?: Date;
    } = {};

    if (currentItemId !== undefined) updateData.currentItemId = currentItemId;
    if (currentStage !== undefined) {
      // 验证阶段值是否有效
      if (currentStage !== null && !Object.values(BopppsStage).includes(currentStage as BopppsStage)) {
        return NextResponse.json({ error: 'Invalid stage value' }, { status: 400 });
      }
      updateData.currentStage = currentStage as BopppsStage | null;
    }
    if (status !== undefined) {
      // 验证状态值是否有效
      if (!Object.values(SessionStatus).includes(status as SessionStatus)) {
        return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
      }
      updateData.status = status as SessionStatus;
      // 当状态变为 FINISHED 时，自动设置结束时间
      if (status === 'FINISHED') {
        updateData.endTime = new Date();
      }
    }

    const updatedSession = await prisma.classSession.update({
      where: { id: sessionId },
      data: updateData
    });

    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error('Error updating session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request, { params }: { params: { sessionId: string } }) {
    try {
        const session = await prisma.classSession.findUnique({
            where: { id: params.sessionId },
            select: {
                id: true,
                joinCode: true,
                status: true,
                currentItemId: true,
                currentStage: true,
                // Include minimal plan info for student check
                plan: {
                    select: { title: true }
                }
            }
        });
        
        if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(session);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

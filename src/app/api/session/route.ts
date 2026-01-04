
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await request.json();
    const { planId, classId } = body;

    if (!planId) {
      return NextResponse.json({ error: '请选择教案' }, { status: 400 });
    }

    if (!classId) {
      return NextResponse.json({ error: '请选择班级' }, { status: 400 });
    }

    // 验证班级存在且属于当前教师
    const classData = await prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, teacherId: true, name: true }
    });

    if (!classData) {
      return NextResponse.json({ error: '班级不存在' }, { status: 404 });
    }

    if (classData.teacherId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: '无权在此班级开始课堂' }, { status: 403 });
    }

    // 检查该班级是否有进行中的课堂
    const activeSession = await prisma.classSession.findFirst({
      where: {
        classId,
        status: 'ACTIVE'
      }
    });

    if (activeSession) {
      return NextResponse.json({
        error: '该班级已有进行中的课堂，请先结束后再开始新课堂',
        existingSessionId: activeSession.id
      }, { status: 409 });
    }

    // Generate Join Code (simple 6 digits)
    const joinCode = Math.floor(100000 + Math.random() * 900000).toString();

    const newSession = await prisma.classSession.create({
      data: {
        joinCode,
        planId,
        teacherId: user.id,
        classId,
        status: 'ACTIVE',
        currentStage: 'BRIDGE_IN',
        currentItemId: undefined
      },
      include: {
        plan: { select: { title: true } },
        class: { select: { name: true } }
      }
    });

    return NextResponse.json(newSession);
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

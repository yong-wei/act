import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { teacherDefaultClassService } from '@/lib/teacher-default-class-service';
import { defaultClassServiceErrorResponse } from '../route';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  if (session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '权限不足' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const classId = typeof body?.classId === 'string' ? body.classId.trim() : '';
    if (!classId) {
      return NextResponse.json({ error: '请选择班级' }, { status: 400 });
    }

    const classData = await teacherDefaultClassService.setDefaultClass(session.user.id, classId);
    return NextResponse.json({
      defaultClassId: classData.id,
      class: classData,
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    const response = defaultClassServiceErrorResponse(error);
    if (response) return response;
    console.error('设置默认班级失败:', error);
    return NextResponse.json({ error: '设置默认班级失败' }, { status: 500 });
  }
}

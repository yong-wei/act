import { NextResponse } from 'next/server';

import { TeacherDefaultClassServiceError } from '@/lib/teacher-default-class-service';

export function defaultClassServiceErrorResponse(error: unknown) {
  if (!(error instanceof TeacherDefaultClassServiceError)) return null;
  if (error.code === 'class-not-found') {
    return NextResponse.json({ error: '班级不存在' }, { status: 404 });
  }
  if (error.code === 'class-not-active') {
    return NextResponse.json({ error: '班级未启用' }, { status: 409 });
  }
  if (error.code === 'class-has-sessions') {
    return NextResponse.json({ error: '已有课堂记录的班级不能删除，请改为停用。' }, { status: 409 });
  }
  if (error.code === 'transaction-conflict-retryable') {
    return NextResponse.json({ error: '班级状态正在更新，请稍后重试。' }, { status: 409 });
  }
  return NextResponse.json({ error: '班级教师不存在' }, { status: 404 });
}

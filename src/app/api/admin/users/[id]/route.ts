import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin';

export async function DELETE() {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }
  return NextResponse.json({ error: '认证账号由统一身份中心管理' }, { status: 410 });
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin';

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  if (session.user.id === params.id) {
    return NextResponse.json(
      { error: '不能删除当前登录账号' },
      { status: 400 }
    );
  }

  await prisma.user.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ success: true });
}

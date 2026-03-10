import { NextResponse } from 'next/server';
import { compare, hash } from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getServerAuthSession } from '@/lib/auth';

const passwordSchema = z.object({
  currentPassword: z.string().min(6, '当前密码不能为空'),
  newPassword: z.string().min(6, '新密码至少 6 位'),
});

export async function PATCH(request: Request) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const json = await request.json();
  const validation = passwordSchema.safeParse(json);

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { currentPassword, newPassword } = validation.data;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });

  if (!user?.passwordHash) {
    return NextResponse.json({ error: '账号未设置密码' }, { status: 400 });
  }

  const isValid = await compare(currentPassword, user.passwordHash);
  if (!isValid) {
    return NextResponse.json({ error: '当前密码不正确' }, { status: 400 });
  }

  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: '新密码不能与当前密码相同' },
      { status: 400 }
    );
  }

  const passwordHash = await hash(newPassword, 10);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash },
  });

  return NextResponse.json({ success: true });
}

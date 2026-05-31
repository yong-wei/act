import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin';

const passwordSchema = z.object({
  password: z.string().min(6, '密码至少 6 位').optional(),
  resetToDefault: z.boolean().optional(),
});

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requireAdminSession();

  if (!session) {
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

  const { password, resetToDefault } = validation.data;
  const nextPassword = resetToDefault ? '123456' : password;

  if (!nextPassword) {
    return NextResponse.json(
      { error: '请提供新密码' },
      { status: 400 }
    );
  }

  const passwordHash = await hash(nextPassword, 10);

  await prisma.user.update({
    where: { id: params.id },
    data: { passwordHash },
  });

  return NextResponse.json({ success: true });
}

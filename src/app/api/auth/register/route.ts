import { hash } from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  name: z.string().min(2).max(50).optional(),
});

export async function POST(request: Request) {
  const json = await request.json();
  const validation = registerSchema.safeParse(json);

  if (!validation.success) {
    return Response.json(
      { error: validation.error.flatten() },
      { status: 400 },
    );
  }

  const { email, password, name } = validation.data;
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    return Response.json({ error: 'Email already in use.' }, { status: 409 });
  }

  const passwordHash = await hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: UserRole.STUDENT,
    },
  });

  return Response.json(
    {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    { status: 201 },
  );
}

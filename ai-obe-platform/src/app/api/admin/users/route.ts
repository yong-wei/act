import { NextResponse, type NextRequest } from 'next/server';
import { UserRole, type Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin';
import { initializeUserProgress } from '@/lib/user-sync';

const createUserSchema = z.object({
  name: z.string().min(1, '姓名不能为空'),
  email: z.string().email('邮箱格式不正确').optional().or(z.literal('')),
  role: z.nativeEnum(UserRole).optional(),
  studentNumber: z.string().trim().optional().or(z.literal('')),
  className: z.string().trim().optional().or(z.literal('')),
  password: z.string().min(6, '密码至少 6 位').optional().or(z.literal('')),
});

export async function GET(request: NextRequest) {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.trim();
  const role = searchParams.get('role');
  const page = Math.max(Number(searchParams.get('page') || 1), 1);
  const pageSize = Math.min(Math.max(Number(searchParams.get('pageSize') || 12), 1), 50);

  const where: Prisma.UserWhereInput = {};
  if (role && Object.values(UserRole).includes(role as UserRole)) {
    const roleValue = role as UserRole;
    where.role = roleValue;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { profile: { is: { studentNumber: { contains: search } } } },
    ];
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        profile: {
          select: {
            studentNumber: true,
            className: true,
          },
        },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    total,
    page,
    pageSize,
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      profile: user.profile,
    })),
  });
}

export async function POST(request: Request) {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const json = await request.json();
  const validation = createUserSchema.safeParse(json);

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.flatten() },
      { status: 400 }
    );
  }

  const {
    name,
    email,
    role = UserRole.STUDENT,
    studentNumber,
    className,
    password,
  } = validation.data;

  if (email) {
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });
    if (existingEmail) {
      return NextResponse.json({ error: '邮箱已存在' }, { status: 409 });
    }
  }

  if (studentNumber) {
    const existingStudent = await prisma.studentProfile.findFirst({
      where: { studentNumber },
    });
    if (existingStudent) {
      return NextResponse.json({ error: '学号已存在' }, { status: 409 });
    }
  }

  const passwordHash = await hash(password || '123456', 10);

  const user = await prisma.user.create({
    data: {
      name,
      email: email || null,
      passwordHash,
      role,
      profile:
        role === UserRole.STUDENT
          ? {
              create: {
                studentNumber: studentNumber || null,
                className: className || null,
                techScore: 0,
                ethicsScore: 100,
              },
            }
          : undefined,
    },
    include: {
      profile: {
        select: {
          studentNumber: true,
          className: true,
        },
      },
    },
  });

  if (user.role === UserRole.STUDENT) {
    await initializeUserProgress(user.id);
  }

  return NextResponse.json(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      profile: user.profile,
    },
    { status: 201 }
  );
}

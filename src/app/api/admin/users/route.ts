import { NextResponse, type NextRequest } from 'next/server';
import { UserRole, type Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin';
import { initializeUserProgress } from '@/lib/user-sync';
import { normalizeAdminUsersQueryContract } from '@/lib/api-ui-contracts';

// 基础验证 schema
const baseUserSchema = z.object({
  name: z.string().min(1, '姓名不能为空'),
  email: z.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    z.string().email('邮箱格式不正确').optional()
  ),
  role: z.nativeEnum(UserRole).optional(),
  studentNumber: z.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    z.string().trim().optional()
  ),
  employeeNumber: z.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    z.string().trim().optional()
  ),
  className: z.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    z.string().trim().optional()
  ),
  password: z.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    z.string().min(6, '密码至少 6 位').optional()
  ),
});

// 根据角色验证必填字段
function validateByRole(data: z.infer<typeof baseUserSchema>) {
  const role = data.role || UserRole.STUDENT;

  if (role === UserRole.STUDENT && !data.studentNumber) {
    return { success: false, error: '学号不能为空' };
  }

  if (role === UserRole.TEACHER && !data.employeeNumber) {
    return { success: false, error: '工号不能为空' };
  }

  return { success: true };
}

export async function GET(request: NextRequest) {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = normalizeAdminUsersQueryContract({
    q: searchParams.get('q'),
    search: searchParams.get('search'),
    role: searchParams.get('role'),
    page: searchParams.get('page'),
    pageSize: searchParams.get('pageSize'),
    action: searchParams.get('action'),
    targetId: searchParams.get('targetId'),
    userId: searchParams.get('userId'),
  });

  const where: Prisma.UserWhereInput = {};
  if (query.role !== 'ALL') {
    where.role = query.role;
  }

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { employeeNumber: { contains: query.search, mode: 'insensitive' } },
      { profile: { is: { studentNumber: { contains: query.search } } } },
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
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return NextResponse.json({
    total,
    page: query.page,
    pageSize: query.pageSize,
    query: {
      search: query.search,
      role: query.role,
      action: query.action,
      targetId: query.targetId,
      source: query.source,
    },
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      employeeNumber: user.employeeNumber,
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
  const validation = baseUserSchema.safeParse(json);

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.flatten() },
      { status: 400 }
    );
  }

  // 根据角色验证必填字段
  const roleValidation = validateByRole(validation.data);
  if (!roleValidation.success) {
    return NextResponse.json({ error: roleValidation.error }, { status: 400 });
  }

  const {
    name,
    email,
    role = UserRole.STUDENT,
    studentNumber,
    employeeNumber,
    className,
    password,
  } = validation.data;

  // 检查邮箱是否已存在
  if (email) {
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });
    if (existingEmail) {
      return NextResponse.json({ error: '邮箱已存在' }, { status: 409 });
    }
  }

  // 检查学号是否已存在（学生）
  if (studentNumber) {
    const existingStudent = await prisma.studentProfile.findFirst({
      where: { studentNumber },
    });
    if (existingStudent) {
      return NextResponse.json({ error: '学号已存在' }, { status: 409 });
    }
  }

  // 检查工号是否已存在（教师/管理员）
  if (employeeNumber) {
    const existingEmployee = await prisma.user.findFirst({
      where: { employeeNumber },
    });
    if (existingEmployee) {
      return NextResponse.json({ error: '工号已存在' }, { status: 409 });
    }
  }

  const passwordHash = await hash(password || '123456', 10);

  const user = await prisma.user.create({
    data: {
      name,
      email: email || null,
      passwordHash,
      role,
      employeeNumber: role !== UserRole.STUDENT ? employeeNumber || null : null,
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

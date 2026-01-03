
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ResourceType, InteractiveCategory, Prisma } from '@prisma/client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const category = searchParams.get('category');
  const includeTeacherOnly = searchParams.get('includeTeacherOnly');

  const where: Prisma.TeachingResourceWhereInput = {};

  // 类型筛选
  if (type) {
    where.type = type as ResourceType;
  }

  // 分类筛选
  if (category) {
    where.category = category as InteractiveCategory;
  }

  // 权限筛选：默认不包含教师专用组件
  if (includeTeacherOnly !== 'true') {
    // 检查用户是否是教师
    const session = await getServerSession(authOptions);
    const isTeacher = session?.user?.role === 'TEACHER' || session?.user?.role === 'ADMIN';

    if (!isTeacher) {
      where.teacherOnly = false;
    }
  }

  try {
    const resources = await prisma.teachingResource.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { displayOrder: 'asc' },
        { updatedAt: 'desc' },
      ],
      select: {
        id: true,
        title: true,
        displayName: true,
        description: true,
        type: true,
        category: true,
        registryId: true,
        teacherOnly: true,
        displayOrder: true,
        config: true,
        updatedAt: true,
      },
    });
    return NextResponse.json(resources);
  } catch (error) {
    console.error('Error fetching resources:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await request.json();
    const { title, description, type, content, registryId, config } = body;

    const resource = await prisma.teachingResource.create({
      data: {
        title,
        description,
        type,
        content,
        registryId,
        config: config || {},
        authorId: user.id
      }
    });

    return NextResponse.json(resource);
  } catch (error) {
    console.error('Error creating resource:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

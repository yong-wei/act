import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { getRegisteredResourceMetadata, type RegisteredResourceMetadata } from '@/lib/resource-registry-metadata';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const resource = await prisma.teachingResource.findUnique({
      where: { id: params.id }
    });

    if (!resource) {
      const registeredResource = getRegisteredResourceMetadata(params.id);
      if (registeredResource && isRegisteredResourceStudentVisible(registeredResource)) {
        return NextResponse.json(toRegisteredTeachingResource(registeredResource));
      }
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    return NextResponse.json(resource);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Error fetching resource:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

function toRegisteredTeachingResource(resource: RegisteredResourceMetadata) {
  const now = new Date(0).toISOString();
  return {
    id: resource.id,
    title: resource.label,
    description: null,
    type: resource.type,
    content: null,
    registryId: resource.id,
    category: null,
    displayName: resource.label,
    displayOrder: 0,
    teacherOnly: false,
    config: resource.defaultConfig ?? {},
    aiHints: null,
    authorId: 'resource-registry',
    createdAt: now,
    updatedAt: now,
  };
}

function isRegisteredResourceStudentVisible(resource: RegisteredResourceMetadata): boolean {
  const planning = resource.planningOverride ?? {};
  return planning.teacherPolicy !== 'teacher-only' &&
    planning.teacherPolicy !== 'blocked' &&
    planning.teacherPolicy !== 'teacher-assigned' &&
    planning.privacyLevel !== 'teacher-scoped' &&
    planning.availability !== 'teacher_only' &&
    planning.availability !== 'archived';
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 检查权限：仅 TEACHER 或 ADMIN 可编辑
    if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { displayName, description } = body;

    const resource = await prisma.teachingResource.update({
      where: { id: params.id },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(description !== undefined && { description }),
      },
    });

    return NextResponse.json(resource);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Error updating resource:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

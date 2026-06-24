import 'server-only';

import type { InteractiveCategory, Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { InteractiveResource } from './learning-catalog';

export async function loadChapterComponentResources(category?: InteractiveCategory): Promise<InteractiveResource[]> {
  const session = await getServerSession(authOptions);
  const isTeacher = session?.user?.role === 'TEACHER' || session?.user?.role === 'ADMIN';
  const where: Prisma.TeachingResourceWhereInput = category ? { category } : {};

  if (!isTeacher) {
    where.teacherOnly = false;
  }

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
      displayOrder: true,
    },
  });

  return category ? resources : resources.filter((resource) => resource.category !== 'CLASSROOM');
}

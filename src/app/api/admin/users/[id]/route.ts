import { NextResponse } from 'next/server';
import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin';
import { SYSTEM_RESOURCE_REGISTRY_IDS } from '@/lib/system-resource-ids';
import { detachSmartLessonTasksForDeletedClass } from '@/lib/teacher-default-class-service';

export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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

  const targetUser = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, role: true },
  });

  if (!targetUser) {
    return NextResponse.json({ error: '账号不存在' }, { status: 404 });
  }

  try {
    if (targetUser.role === UserRole.TEACHER) {
      await prisma.$transaction(async (tx) => {
        await tx.classSession.deleteMany({
          where: { teacherId: targetUser.id },
        });

        const classes = await tx.class.findMany({
          where: { teacherId: targetUser.id },
          select: { id: true },
        });
        for (const ownedClass of classes) {
          await detachSmartLessonTasksForDeletedClass(tx, targetUser.id, ownedClass.id);
        }
        await tx.class.deleteMany({
          where: { teacherId: targetUser.id },
        });

        await tx.lessonPlan.deleteMany({
          where: { authorId: targetUser.id, isPreset: false },
        });

        const resourcesToDelete = await tx.teachingResource.findMany({
          where: {
            authorId: targetUser.id,
            OR: [
              { registryId: null },
              { registryId: { notIn: SYSTEM_RESOURCE_REGISTRY_IDS } },
            ],
          },
          select: { id: true },
        });

        const resourceIds = resourcesToDelete.map((resource) => resource.id);

        if (resourceIds.length > 0) {
          await tx.lessonItem.deleteMany({
            where: { resourceId: { in: resourceIds } },
          });
          await tx.teachingResource.deleteMany({
            where: { id: { in: resourceIds } },
          });
        }

        await tx.studentState.deleteMany({
          where: { userId: targetUser.id },
        });
      }, { isolationLevel: 'Serializable' });
    }

    await prisma.user.delete({
      where: { id: targetUser.id },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003') {
        return NextResponse.json(
          { error: '该账号存在关联数据，无法删除' },
          { status: 409 }
        );
      }
    }
    console.error('Failed to delete user:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

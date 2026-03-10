import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TeacherDashboard } from '@/features/teacher/teacher-dashboard';

export default async function TeacherPage() {
  const session = await getServerAuthSession();

  // 获取教师统计数据
  const [classes, lessonPlans, activeSessions] = await Promise.all([
    prisma.class.findMany({
      where: { teacherId: session!.user.id },
      include: {
        _count: { select: { students: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.lessonPlan.findMany({
      where: { authorId: session!.user.id },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    prisma.classSession.findMany({
      where: {
        teacherId: session!.user.id,
        status: 'ACTIVE',
      },
      include: {
        plan: { select: { title: true } },
        class: { select: { id: true, name: true } },
        _count: { select: { studentStates: true } },
      },
    }),
  ]);

  // 计算统计数据
  const totalClasses = await prisma.class.count({
    where: { teacherId: session!.user.id },
  });

  const totalStudents = await prisma.studentProfile.count({
    where: {
      class: { teacherId: session!.user.id },
    },
  });

  const totalPlans = await prisma.lessonPlan.count({
    where: { authorId: session!.user.id },
  });

  return (
    <TeacherDashboard
      user={session!.user}
      stats={{
        totalClasses,
        totalStudents,
        totalPlans,
        activeSessions: activeSessions.length,
      }}
      recentClasses={classes.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        studentCount: c._count.students,
        createdAt: c.createdAt.toISOString(),
      }))}
      recentPlans={lessonPlans.map((p) => ({
        id: p.id,
        title: p.title,
        updatedAt: p.updatedAt.toISOString(),
      }))}
      activeSessions={activeSessions.map((s) => ({
        id: s.id,
        planTitle: s.plan.title,
        joinCode: s.joinCode,
        studentCount: s._count.studentStates,
        className: s.class?.name,
        classId: s.class?.id,
      }))}
    />
  );
}

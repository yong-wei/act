import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Plus, BookOpen, ArrowLeft } from 'lucide-react';
import { getServerAuthSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { LessonPlanList } from '@/features/lesson-engine/lesson-plan-list';

export default async function TeacherLessonPlansPage() {
  const session = await getServerAuthSession();
  if (!session) redirect('/login');
  if (session.user.role !== 'TEACHER') redirect('/');

  // 获取当前教师教案（不包含预置教案）
  const plans = await prisma.lessonPlan.findMany({
    where: {
      authorId: session.user.id,
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      author: { select: { name: true } },
      _count: { select: { items: true } }
    }
  });

  return (
    <div
      className="surface-page p-8"
      data-commercial-operations-workspace="teacher-operations"
      data-commercial-workspace-zone="instrument-area"
      data-operations-status-semantics={plans.length === 0 ? 'empty' : 'updated'}
    >
      <div className="space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div>
            <Link
              href="/teacher"
              className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-cyan-400 transition-colors mb-3"
            >
              <ArrowLeft className="h-4 w-4" />
              返回教师工作台
            </Link>
            <h1 className="text-2xl font-bold flex items-center gap-3 text-white">
              <BookOpen className="h-8 w-8 text-cyan-400" />
              我的教案
            </h1>
            <p className="mt-2 text-slate-400">
              管理您的 BOPPPS 教学编排方案
            </p>
          </div>
          <Link href="/teacher/lesson-plans/new?returnTo=%2Fteacher%2Flesson-plans">
            <button type="button" className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-lg shadow-cyan-900/20">
              <Plus className="h-5 w-5" />
              新建教案
            </button>
          </Link>
        </div>

        {/* List Grid */}
        <LessonPlanList
          plans={plans}
          basePath="/teacher/lesson-plans"
          currentUserId={session.user.id}
          returnTo="/teacher/lesson-plans"
          launchActor="teacher"
        />

        {plans.length === 0 && (
            <div className="py-20 text-center border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/20">
              <div className="mx-auto h-12 w-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mb-4">
                <Plus className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-medium text-slate-300">暂无教案</h3>
              <p className="text-slate-500 mt-1 mb-6">创建一个新的 BOPPPS 教案开始教学设计</p>
              <Link href="/teacher/lesson-plans/new?returnTo=%2Fteacher%2Flesson-plans">
                <button type="button" className="text-cyan-400 hover:text-cyan-300 font-medium">
                   立即创建 &rarr;
                </button>
              </Link>
            </div>
        )}
      </div>
    </div>
  );
}

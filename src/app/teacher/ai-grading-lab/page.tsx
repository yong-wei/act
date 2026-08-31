import { redirect } from 'next/navigation';

import { getServerAuthSession } from '@/lib/auth';
import { readTeacherAiGradingLabConfig } from '@/lib/data-governance/teacher-ai-grading-lab-contracts';
import { TeacherAiGradingLabWorkspace } from '@/features/teacher/teacher-ai-grading-lab-workspace';

export const dynamic = 'force-dynamic';

export default async function TeacherAiGradingLabPage() {
  const session = await getServerAuthSession();
  let ownerTeacherUserId: string;
  try { ownerTeacherUserId = readTeacherAiGradingLabConfig(process.env).ownerTeacherUserId; } catch { redirect('/teacher'); }
  if (session?.user?.role !== 'TEACHER' || session.user.id !== ownerTeacherUserId) redirect('/teacher');
  return <main className="surface-page min-h-screen px-4 py-8 md:px-8"><div className="mx-auto max-w-6xl"><header className="border-b border-slate-200 pb-6"><p className="text-sm font-medium text-cyan-700">教师作业评测</p><h1 className="mt-2 text-3xl font-semibold text-slate-950">AI 批改评测工作台</h1></header><div className="mt-8"><TeacherAiGradingLabWorkspace /></div></div></main>;
}

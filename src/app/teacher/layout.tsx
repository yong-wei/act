import { redirect } from 'next/navigation';

import { getServerAuthSession } from '@/lib/auth';
import { RoleWorkspaceShell } from '@/components/platform/role-workspace-shell';
import { TeacherOperationsNav } from '@/features/teacher/teacher-operations-nav';

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== 'TEACHER') {
    if (session.user.role === 'ADMIN') {
      redirect('/admin');
    } else {
      redirect('/dashboard');
    }
  }

  return (
    <RoleWorkspaceShell
      workspaceRole="teacher"
      title="教师工作台"
      subtitle="课程编排、班级管理、证据审核与课堂报告"
      user={session.user}
      workspaceSlots={{
        commandBar: (
          <div data-commercial-operations-workspace="teacher-operations" data-commercial-workspace-zone="command-bar">
            <TeacherOperationsNav />
          </div>
        ),
      }}
    >
      {children}
    </RoleWorkspaceShell>
  );
}

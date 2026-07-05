import { AppShell } from '@/components/platform/app-shell';
import { PersonalLearningCenter } from '@/features/ai/personal-learning-center';
import { getServerAuthSession } from '@/lib/auth';
import { getPlatformCockpitHref } from '@/lib/platform-role-navigation';
import type { PlatformRole } from '@/components/platform/platform-ui-contracts';

export const dynamic = 'force-dynamic';

export default async function AiPage({
  searchParams,
}: {
  searchParams?: Promise<{
    task?: string;
    source?: string;
    assignment?: string;
    intent?: string;
  }>;
}) {
  const params = await searchParams;
  const session = await getServerAuthSession();
  const viewerRole = resolveAiViewerRole(session?.user?.role);
  const hasLocalTask = Boolean(params?.task);
  return (
    <AppShell
      viewerRole={viewerRole}
      activeHref="/ai"
      activeNavigationHref="/knowledge"
      accountHref={getPlatformCockpitHref(session?.user?.role)}
      title="AI工坊"
      subtitle="把学习证据、课程任务和智能助教放在同一个工作区。"
      breadcrumbs={[{ label: '首页', href: '/' }, { label: 'AI工坊' }]}
    >
      <div
        data-ai-local-task-surface={hasLocalTask ? 'ai-workshop' : undefined}
        data-ai-task-focus-mode={hasLocalTask ? 'local-first' : undefined}
        data-task-workspace-archetype={hasLocalTask ? 'ai-local-task' : undefined}
      >
        <PersonalLearningCenter
          taskIntent={params?.task}
          taskSource={params?.source}
          taskAssignment={params?.assignment}
          taskContextIntent={params?.intent}
        />
      </div>
    </AppShell>
  );
}

function resolveAiViewerRole(role?: string | null): PlatformRole {
  const normalizedRole = role?.toLowerCase();
  if (normalizedRole === 'admin') return 'admin';
  if (normalizedRole === 'teacher') return 'teacher';
  return 'student';
}

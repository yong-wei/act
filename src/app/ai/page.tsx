import { FeaturePageNav } from '@/components/shared/feature-page-nav';
import { PersonalLearningCenter } from '@/features/ai/personal-learning-center';

export const dynamic = 'force-dynamic';

export default async function AiPage({
  searchParams,
}: {
  searchParams?: Promise<{ task?: string; source?: string; assignment?: string; intent?: string }>;
}) {
  const params = await searchParams;
  const hasLocalTask = Boolean(params?.task);
  return (
    <main
      className="relative surface-page"
      data-ai-local-task-surface={hasLocalTask ? 'ai-workshop' : undefined}
      data-ai-task-focus-mode={hasLocalTask ? 'local-first' : undefined}
      data-task-workspace-archetype={hasLocalTask ? 'ai-local-task' : undefined}
    >
      <FeaturePageNav title="AI工坊" backHref="/" backLabel="返回首页" floating />
      <PersonalLearningCenter
        taskIntent={params?.task}
        taskSource={params?.source}
        taskAssignment={params?.assignment}
        taskContextIntent={params?.intent}
      />
    </main>
  );
}

import { FeaturePageNav } from '@/components/shared/feature-page-nav';
import { PersonalLearningCenter } from '@/features/ai/personal-learning-center';

export const dynamic = 'force-dynamic';

export default async function AiPage({
  searchParams,
}: {
  searchParams?: Promise<{ task?: string; source?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="relative surface-page">
      <FeaturePageNav title="AI工坊" backHref="/" backLabel="返回首页" floating />
      <PersonalLearningCenter taskIntent={params?.task} taskSource={params?.source} />
    </main>
  );
}

import { FeaturePageNav } from '@/components/shared/feature-page-nav';
import { PersonalLearningCenter } from '@/features/ai/personal-learning-center';

export const dynamic = 'force-dynamic';

export default function AiPage() {
  return (
    <main className="relative surface-page">
      <FeaturePageNav title="AI工坊" backHref="/" backLabel="返回首页" floating />
      <PersonalLearningCenter />
    </main>
  );
}

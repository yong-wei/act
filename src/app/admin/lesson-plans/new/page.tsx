import { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';
import { OrchestratorBuilder } from '@/features/lesson-engine/orchestrator-builder';
import { PresetTemplateCloneRedirect } from '@/features/lesson-engine/preset-template-clone-redirect';
import { getServerAuthSession } from '@/lib/auth';
import { buildLoginRedirectForPath } from '@/lib/auth-redirect';
import { resolveScopedReturnTarget, type ReturnTargetParam } from '@/lib/navigation-return-target';
import { ALL_PRESETS } from '@/features/teacher/preset-lessons/presets';

interface PageProps {
  searchParams?: Promise<{ returnTo?: ReturnTargetParam; templateId?: string }>;
}

export default async function NewLessonPlanPage({ searchParams }: PageProps) {
  const session = await getServerAuthSession();
  if (!session?.user) redirect(buildLoginRedirectForPath('/admin/lesson-plans/new'));
  if (session.user.role !== UserRole.ADMIN) redirect('/');

  const query = await searchParams;
  const returnTarget = resolveScopedReturnTarget(query?.returnTo, '/admin/lesson-plans', ['/admin']);
  const requestedTemplateId = typeof query?.templateId === 'string' ? query.templateId.trim() || null : null;
  const sourceTemplate = requestedTemplateId
    ? ALL_PRESETS.find((preset) => preset.key === requestedTemplateId) ?? null
    : null;
  const templateId = sourceTemplate ? requestedTemplateId : null;
  const missingTemplateId = requestedTemplateId && !sourceTemplate ? requestedTemplateId : null;

  if (templateId && sourceTemplate) {
    return (
      <PresetTemplateCloneRedirect
        presetKey={templateId}
        presetTitle={sourceTemplate.title}
        editBaseHref="/admin/lesson-plans"
        recoveryHref="/admin/lesson-plans"
        returnTo={returnTarget}
      />
    );
  }

  return (
    <OrchestratorBuilder
      returnPath={returnTarget}
      workbenchReturnUrl={returnTarget}
      workbenchReturnLabel="返回教案管理"
      missingTemplateId={missingTemplateId}
      templateRecoveryHref="/admin/lesson-plans"
    />
  );
}

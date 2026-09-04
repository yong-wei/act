import { getServerAuthSession } from '@/lib/auth';
import { buildLoginRedirectForPath } from '@/lib/auth-redirect';
import { redirect } from 'next/navigation';
import { OrchestratorBuilder } from '@/features/lesson-engine/orchestrator-builder';
import { PresetTemplateCloneRedirect } from '@/features/lesson-engine/preset-template-clone-redirect';
import { resolveScopedReturnTarget, type ReturnTargetParam } from '@/lib/navigation-return-target';
import { ALL_PRESETS } from '@/features/teacher/preset-lessons/presets';

interface PageProps {
  searchParams?: Promise<{ returnTo?: ReturnTargetParam; templateId?: string }>;
}

function getTeacherReturnLabel(returnTarget: string) {
  if (returnTarget === '/teacher') return '返回教师工作台';
  if (returnTarget.startsWith('/teacher/classes/')) return '返回班级详情';
  return '返回教案列表';
}

export default async function TeacherNewLessonPlanPage({ searchParams }: PageProps) {
  const session = await getServerAuthSession();
  if (!session) redirect(buildLoginRedirectForPath('/teacher/lesson-plans/new'));
  if (session.user.role !== 'TEACHER') redirect('/');

  const query = await searchParams;
  const returnTarget = resolveScopedReturnTarget(query?.returnTo, '/teacher/lesson-plans', ['/teacher']);
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
        editBaseHref="/teacher/lesson-plans"
        recoveryHref="/teacher/preset-lessons"
        returnTo={returnTarget}
      />
    );
  }

  return (
    <OrchestratorBuilder
      returnPath={returnTarget}
      workbenchReturnUrl={returnTarget}
      workbenchReturnLabel={getTeacherReturnLabel(returnTarget)}
      missingTemplateId={missingTemplateId}
      templateRecoveryHref="/teacher/preset-lessons"
    />
  );
}

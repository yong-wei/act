import type { ReactNode } from 'react';

import { PathAdvisorEntryPointBridge } from '@/features/adaptive/path-advisor-entrypoint-bridge';
import { getAdaptivePracticeGoalOptions } from '@/lib/adaptive-path-goal-options';
import { getServerAuthSession } from '@/lib/auth';
import { createKonlingTeachingAssistantServerContextToken } from '@/lib/konling-teaching-assistant-server-context';

export const dynamic = 'force-dynamic';

export default async function AdaptivePracticeLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerAuthSession();
  const classId = session?.user?.role === 'STUDENT'
    ? session.user.profile?.classId ?? null
    : null;
  const goalOptions = getAdaptivePracticeGoalOptions();
  const goalContexts = Object.fromEntries(goalOptions.map((goal) => [goal.id, goal.konlingContext]));
  const modeContextTokens = classId
    ? Object.fromEntries(goalOptions.map((goal) => [
        goal.id,
        createKonlingTeachingAssistantServerContextToken({
          mode: 'path-advisor',
          classId,
          courseId: goal.id,
          pageId: 'adaptive-path-center',
          goalId: goal.id,
          context: {
            'student-path-center': true,
            'learner-state-summary': true,
            'evidence-citations': true,
            'path-execution-context': true,
          },
        }),
      ]))
    : {};

  return (
    <>
      <PathAdvisorEntryPointBridge
        classId={classId}
        goalContexts={goalContexts}
        modeContextTokens={modeContextTokens}
      />
      {children}
    </>
  );
}

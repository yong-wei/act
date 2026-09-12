import type { ReactNode } from 'react';

import { PathAdvisorEntryPointBridge } from '@/features/personalization/experience/path-advisor-entrypoint-bridge';
import { getAdaptivePracticeGoalOptions } from '@/features/personalization/path-planning/public-api';
import { getServerAuthSession } from '@/lib/auth';
import { createKonlingTeachingAssistantServerContextToken } from '@/lib/konling-teaching-assistant-server-context';

export const dynamic = 'force-dynamic';

export default async function AdaptivePracticeLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerAuthSession();
  const isStudent = session?.user?.role === 'STUDENT';
  const classId = isStudent
    ? (typeof session.user.profile?.classId === 'string' && session.user.profile.classId.trim()
      ? session.user.profile.classId.trim()
      : null)
    : null;
  const goalOptions = getAdaptivePracticeGoalOptions();
  const goalContexts = Object.fromEntries(goalOptions.map((goal) => [goal.id, goal.konlingContext]));
  const modeContextTokens = isStudent
    ? Object.fromEntries(goalOptions.map((goal) => [
        goal.id,
        createKonlingTeachingAssistantServerContextToken({
          mode: 'path-advisor',
          ...(classId ? { classId } : {}),
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

import type { ReactNode } from 'react';

import { PathAdvisorEntryPointBridge } from '@/features/adaptive/path-advisor-entrypoint-bridge';
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
  const modeContextTokens = classId
    ? {
        'control-correction': createKonlingTeachingAssistantServerContextToken({
          mode: 'path-advisor',
          classId,
          courseId: 'control-correction',
          pageId: 'adaptive-path-center',
          goalId: 'control-correction',
          context: {
            'student-path-center': true,
            'learner-state-summary': true,
            'evidence-citations': true,
            'path-execution-context': true,
          },
        }),
        'frequency-response-foundations': createKonlingTeachingAssistantServerContextToken({
          mode: 'path-advisor',
          classId,
          courseId: 'frequency-response-foundations',
          pageId: 'adaptive-path-center',
          goalId: 'frequency-response-foundations',
          context: {
            'student-path-center': true,
            'learner-state-summary': true,
            'evidence-citations': true,
            'path-execution-context': true,
          },
        }),
      }
    : {};

  return (
    <>
      <PathAdvisorEntryPointBridge
        classId={classId}
        modeContextTokens={modeContextTokens}
      />
      {children}
    </>
  );
}

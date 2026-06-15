import type { ReactNode } from 'react';

import { PathAdvisorEntryPointBridge } from '@/features/adaptive/path-advisor-entrypoint-bridge';
import { getServerAuthSession } from '@/lib/auth';
import { createKonlingTeachingAssistantServerContextToken } from '@/lib/konling-teaching-assistant-server-context';

export default async function AdaptivePracticeLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerAuthSession();
  const classId = session?.user?.role === 'STUDENT'
    ? session.user.profile?.classId ?? null
    : null;
  const modeContextToken = classId
    ? createKonlingTeachingAssistantServerContextToken({
        mode: 'path-advisor',
        classId,
        courseId: 'control-correction',
        pageId: 'adaptive-path-center',
        context: {
          'student-path-center': true,
          'learner-state-summary': true,
          'evidence-citations': true,
          'path-execution-context': true,
        },
      })
    : null;

  return (
    <>
      <PathAdvisorEntryPointBridge
        classId={classId}
        modeContextToken={modeContextToken}
      />
      {children}
    </>
  );
}

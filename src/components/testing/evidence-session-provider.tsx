'use client';

import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

const evidenceSession = {
  user: {
    id: 'evidence-student-1042',
    name: 'UI Evidence Student',
    email: 'evidence-student@example.test',
    role: 'STUDENT' as const,
  },
  expires: '2099-01-01T00:00:00.000Z',
};

export function EvidenceSessionProvider({ children }: { children: ReactNode }) {
  return <SessionProvider session={evidenceSession}>{children}</SessionProvider>;
}

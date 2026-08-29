import type { ProjectionViewer } from '@/features/learning-record/projections/types';
import type { PortraitV2Consumer } from '@/lib/data-governance/portrait-v2-model';

export function viewerFromSession(
  session: { user: { id: string; role?: string | null } },
  classIds: string[] = [],
): ProjectionViewer {
  const role = session.user.role?.toUpperCase();
  if (role === 'ADMIN') {
    return { role: 'admin', subjectUserId: session.user.id, classIds };
  }
  if (role === 'TEACHER') {
    return { role: 'teacher', subjectUserId: session.user.id, classIds };
  }
  return { role: 'student', subjectUserId: session.user.id, classIds };
}

export function viewerForPortraitConsumer(
  consumer: PortraitV2Consumer,
  subjectUserId: string,
): ProjectionViewer {
  if (consumer === 'student') {
    return { role: 'student', subjectUserId };
  }
  if (consumer === 'admin') {
    return { role: 'admin', subjectUserId };
  }
  return { role: 'personalization', subjectUserId };
}

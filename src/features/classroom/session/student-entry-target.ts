// Only the interactive student route can take part in entry-page waiting.
// Fragments survive reloads and history navigation, but never grant access.
const studentRoute = /^\/interactive-learning\/courses\/([a-z0-9-]+)\/student\/([A-Za-z0-9_-]+)$/;
export const classroomWaitFragment = '#classroom-wait=';

export function studentEntryTarget(href: string) {
  const match = studentRoute.exec(href);
  if (!match || match[2] === 'demo') return null;
  return { href, sessionId: match[2], entryHref: `/interactive-learning/courses/${match[1]}` };
}

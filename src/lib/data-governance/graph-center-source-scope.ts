export type GraphCenterViewerRole = 'STUDENT' | 'TEACHER' | 'ADMIN' | null | undefined;

export function teachingResourceWhereForGraphCenter(
  viewerRole: GraphCenterViewerRole,
  viewerUserId?: string | null,
): { authorId?: string } | null {
  if (viewerRole === 'ADMIN') return {};
  if (viewerRole === 'TEACHER' && viewerUserId) return { authorId: viewerUserId };
  return null;
}

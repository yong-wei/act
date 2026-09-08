/**
 * Pure client-safe helper: which internal path targets students may navigate to.
 *
 * No server persistence, Prisma, or path-round modules. Client adaptive-path
 * modules must import this helper from this module only.
 */

const STUDENT_VISIBLE_PATH_TARGET_PREFIXES = [
  '/adaptive-learning/',
  '/arena/',
  '/assessment/',
  '/classroom/student/',
  '/course-runtime/',
  '/dashboard/',
  '/interactive-learning/',
  '/knowledge/',
  '/learning-resources/',
  '/playlists/',
  '/profile/',
  '/simulations/',
  '/textbooks/',
] as const;

export function isStudentVisiblePathTarget(target: string): boolean {
  const normalized = target.trim();
  if (normalized.length === 0 || normalized !== target) return false;
  if (/^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(normalized)) return false;
  const pathname = normalized.split(/[?#]/, 1)[0] ?? normalized;
  const segments = pathname.split('/').filter(Boolean);
  if (segments.some((segment) => ['admin', 'api', 'teacher', '_next', 'data-center'].includes(segment))) {
    return false;
  }
  if (!pathname.startsWith('/')) {
    return pathname.startsWith('course-content/runtime/');
  }
  return STUDENT_VISIBLE_PATH_TARGET_PREFIXES.some((prefix) => (
    pathname === prefix.slice(0, -1) || pathname.startsWith(prefix)
  ));
}

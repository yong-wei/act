'use client';

/**
 * Strip transient iLab arrival query parameters (`ticket` and deprecated `token`)
 * while preserving unrelated parameters such as `compat` or `mission`.
 */
export function stripIlabUrlParams(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.delete('ticket');
  params.delete('token');
  const nextQuery = params.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

/**
 * Clear per-experiment origin IDs cached in browser sessionStorage when a new
 * iLab grant is established or the user disconnects the current iLab session.
 */
export function clearIlabOriginSessionStorage(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem('act-destroyer-origin');
  const keysToRemove: string[] = [];
  for (let i = 0; i < window.sessionStorage.length; i += 1) {
    const key = window.sessionStorage.key(i);
    if (key && key.startsWith('act-vessel-origin:')) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    window.sessionStorage.removeItem(key);
  }
}

export function extractVersionBoundHandle(href: string | null | undefined): string | null {
  if (!href) return null;
  try {
    const url = new URL(href, 'https://act.local');
    if (url.origin !== 'https://act.local') return null;
    if (!url.pathname.startsWith('/textbooks/')) return null;
    const handle = url.searchParams.get('vbh');
    return handle && handle.trim() ? handle.trim() : null;
  } catch {
    return null;
  }
}

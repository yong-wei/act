export function canEmbedResourceHref(href: string | null | undefined): boolean {
  if (!href || !href.startsWith('/') || href.startsWith('//')) return false;
  const pathname = href.split(/[?#]/, 1)[0] ?? href;
  if (pathname.startsWith('/course-runtime/')) return false;
  return !/\.(?:md|markdown|pdf|json|txt|csv)$/i.test(pathname);
}

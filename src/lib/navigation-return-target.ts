export type ReturnTargetParam = string | string[] | undefined;

export function resolveScopedReturnTarget(
  value: ReturnTargetParam,
  fallback: string,
  allowedPrefixes: readonly string[],
) {
  const target = Array.isArray(value) ? value[0] : value;
  if (!target || !target.startsWith('/') || target.startsWith('//')) {
    return fallback;
  }

  let normalized: URL;
  try {
    normalized = new URL(target, 'http://local.return');
  } catch {
    return fallback;
  }

  const isAllowed = allowedPrefixes.some((prefix) => (
    normalized.pathname === prefix || normalized.pathname.startsWith(`${prefix}/`)
  ));
  return isAllowed ? `${normalized.pathname}${normalized.search}${normalized.hash}` : fallback;
}

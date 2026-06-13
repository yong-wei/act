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

  const pathname = target.split(/[?#]/, 1)[0] ?? target;
  const isAllowed = allowedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return isAllowed ? target : fallback;
}

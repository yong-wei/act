import { getPlatformCockpitHref } from '@/lib/platform-role-navigation';

export function getDefaultPostLoginRedirect(role?: string | null) {
  return getPlatformCockpitHref(role);
}

export function normalizeSafeCallbackPath(callbackUrl?: string | null, origin?: string) {
  if (!callbackUrl) return null;

  if (callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')) {
    return callbackUrl;
  }

  if (!origin) return null;

  try {
    const parsed = new URL(callbackUrl);
    if (parsed.origin !== origin) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function resolvePostLoginRedirect({
  callbackUrl,
  origin,
  role,
}: {
  callbackUrl?: string | null;
  origin?: string;
  role?: string | null;
}) {
  return normalizeSafeCallbackPath(callbackUrl, origin) ?? getDefaultPostLoginRedirect(role);
}

export function appendLoginPageHashToRedirectPath(
  redirectPath: string,
  loginPageHash: string,
) {
  if (
    !loginPageHash
    || loginPageHash === '#'
    || !loginPageHash.startsWith('#')
    || /[\s\p{Cc}]/u.test(loginPageHash)
    || redirectPath.includes('#')
  ) {
    return redirectPath;
  }
  return `${redirectPath}${loginPageHash}`;
}

export function buildLoginRedirectForPath(path: string) {
  return `/login?callbackUrl=${encodeURIComponent(path)}`;
}

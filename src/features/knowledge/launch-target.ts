const UNSAFE_LAUNCH_TARGET_REASON = '资源启动地址未通过安全校验，当前不可启动。';
const AMBIGUOUS_CHARACTER_PATTERN = /[\p{Cc}\p{Cf}\p{Z}\\]/u;
const ENCODED_CONTROL_OR_SPACE_PATTERN = /%(?:0[0-9a-f]|1[0-9a-f]|20|7f)/iu;
const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/iu;

export interface SafeLaunchTargetResolution {
  href: string | null;
  reason: string | null;
}

export interface LaunchTargetSecurityContext {
  mode?: 'development' | 'production';
  allowLoopbackHttp?: boolean;
  applicationOrigin?: string | null;
}

export interface LaunchTargetSelection extends SafeLaunchTargetResolution {
  candidatePresent: boolean;
  source: 'authoritative' | 'fallback' | null;
}

function isLoopbackUrl(target: string): boolean {
  try {
    const url = new URL(target);
    return !url.username
      && !url.password
      && (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]');
  } catch {
    return false;
  }
}

function isAllowedLocalHttpUrl(target: string, context: LaunchTargetSecurityContext): boolean {
  return context.mode === 'development'
    && context.allowLoopbackHttp === true
    && typeof context.applicationOrigin === 'string'
    && isLoopbackUrl(context.applicationOrigin)
    && new URL(context.applicationOrigin).protocol === 'http:'
    && isLoopbackUrl(target)
    && new URL(target).protocol === 'http:';
}

function isAllowedHttpsUrl(target: string): boolean {
  try {
    const url = new URL(target);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function resolveSafeLaunchTarget(
  target: unknown,
  context: LaunchTargetSecurityContext = {},
): SafeLaunchTargetResolution {
  if (target === null || target === undefined) {
    return { href: null, reason: null };
  }
  if (typeof target !== 'string' || target.length === 0) {
    return { href: null, reason: UNSAFE_LAUNCH_TARGET_REASON };
  }
  if (
    target.startsWith('//')
    || AMBIGUOUS_CHARACTER_PATTERN.test(target)
    || ENCODED_CONTROL_OR_SPACE_PATTERN.test(target)
  ) {
    return { href: null, reason: UNSAFE_LAUNCH_TARGET_REASON };
  }
  if (SCHEME_PATTERN.test(target)) {
    if (isAllowedHttpsUrl(target) || isAllowedLocalHttpUrl(target, context)) {
      return { href: target, reason: null };
    }
    return { href: null, reason: UNSAFE_LAUNCH_TARGET_REASON };
  }
  return { href: target, reason: null };
}

function isPresent(value: unknown): boolean {
  return value !== null && value !== undefined;
}

export function resolveLaunchTargetSelection({
  authoritativeTarget,
  fallbackTargets = [],
  context,
}: {
  authoritativeTarget: unknown;
  fallbackTargets?: readonly unknown[];
  context?: LaunchTargetSecurityContext;
}): LaunchTargetSelection {
  if (isPresent(authoritativeTarget)) {
    return {
      ...resolveSafeLaunchTarget(authoritativeTarget, context),
      candidatePresent: true,
      source: 'authoritative',
    };
  }
  const fallbackTarget = fallbackTargets.find(isPresent);
  if (fallbackTarget !== undefined) {
    return {
      ...resolveSafeLaunchTarget(fallbackTarget, context),
      candidatePresent: true,
      source: 'fallback',
    };
  }
  return { href: null, reason: null, candidatePresent: false, source: null };
}

export function configuredLaunchTargetSecurityContext(
  applicationOrigin?: string | null,
): LaunchTargetSecurityContext {
  return {
    mode: process.env.NODE_ENV === 'development' ? 'development' : 'production',
    allowLoopbackHttp: process.env.NEXT_PUBLIC_KNOWLEDGE_ALLOW_LOOPBACK_HTTP === '1',
    applicationOrigin: applicationOrigin ?? process.env.NEXT_PUBLIC_APP_ORIGIN ?? null,
  };
}

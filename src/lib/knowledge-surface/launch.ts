import { resolveSafeLaunchTarget } from '@/features/knowledge/launch-target';

export interface SourceOwnedLaunchInput {
  title: string;
  type: string;
  availability?: 'available' | 'unavailable';
  href?: string | null;
  kind?: string | null;
  canonicalId?: string | null;
  resourceNodeId?: string | null;
  launcher?: {
    contractClass: string;
    contractVersion: string;
    launcherRef?: string;
  } | null;
}

export interface SourceOwnedLaunchDescriptor {
  title: string;
  type: string;
  availability: 'available' | 'unavailable';
  launch: {
    kind: 'source-owned';
    href: string | null;
    contractClass?: string;
    contractVersion?: string;
  };
}

export type SourceOwnedLaunchProjection =
  | { status: 'available'; descriptor: SourceOwnedLaunchDescriptor }
  | { status: 'unavailable' | 'omitted'; reason: string };

const HIDDEN_PAYLOAD = /(?:review|evaluation|hidden|rawBody|objectKey)/i;
const SIGNED_URL = /(?:X-Amz-Signature|X-Amz-Credential|signature=|token=)/i;
const INTERNAL_PATH = /(?:^file:|[\\/](?:course-content|\.next|src)[\\/]|\.tsx?(?:$|\?)|s3:\/\/|component[:/])/i;

function disclosesIdentity(href: string, input: SourceOwnedLaunchInput): boolean {
  if (input.canonicalId && href.includes(input.canonicalId)) return true;
  if (input.resourceNodeId && href.includes(input.resourceNodeId)) return true;
  return false;
}

function isUnsafeHref(href: string, input: SourceOwnedLaunchInput): boolean {
  if (!href) return true;
  if (href.includes('\\') || /(?:^|\/)\.+\//.test(href)) return true;
  if (INTERNAL_PATH.test(href) || SIGNED_URL.test(href) || HIDDEN_PAYLOAD.test(href)) return true;
  if (disclosesIdentity(href, input)) return true;
  const resolved = resolveSafeLaunchTarget(href);
  return resolved.href == null;
}

export function projectSourceOwnedLaunchDescriptor(
  input: SourceOwnedLaunchInput,
): SourceOwnedLaunchProjection {
  const title = input.title.trim();
  if (!title) {
    return { status: 'omitted', reason: 'launch-title-missing' };
  }

  const launcher = input.launcher;
  const hasSourceOwnedLauncher = Boolean(
    launcher?.contractClass
    && launcher.contractVersion
    && !INTERNAL_PATH.test(launcher.contractClass)
    && !INTERNAL_PATH.test(launcher.launcherRef ?? ''),
  );

  const candidateHref = typeof input.href === 'string' && input.href.length > 0 ? input.href : null;
  if (candidateHref && isUnsafeHref(candidateHref, input)) {
    if (!hasSourceOwnedLauncher) {
      return { status: 'omitted', reason: 'unsafe-or-constructed-target' };
    }
    return {
      status: 'available',
      descriptor: {
        title,
        type: input.type,
        availability: 'unavailable',
        launch: {
          kind: 'source-owned',
          href: null,
          contractClass: launcher!.contractClass,
          contractVersion: launcher!.contractVersion,
        },
      },
    };
  }
  if (candidateHref && !hasSourceOwnedLauncher && (input.kind === 'direct-route' || !input.kind)) {
    const resolved = resolveSafeLaunchTarget(candidateHref);
    if (!resolved.href) {
      return { status: 'omitted', reason: 'unsafe-or-constructed-target' };
    }
  }

  if (!hasSourceOwnedLauncher && !candidateHref) {
    return { status: 'unavailable', reason: 'source-owned-launcher-missing' };
  }

  const href = candidateHref && !isUnsafeHref(candidateHref, input)
    ? resolveSafeLaunchTarget(candidateHref).href
    : null;
  const descriptor: SourceOwnedLaunchDescriptor = {
    title,
    type: input.type,
    availability: href ? 'available' : 'unavailable',
    launch: {
      kind: 'source-owned',
      href,
      ...(hasSourceOwnedLauncher
        ? {
            contractClass: launcher!.contractClass,
            contractVersion: launcher!.contractVersion,
          }
        : {}),
    },
  };
  if (href || hasSourceOwnedLauncher) {
    return { status: 'available', descriptor };
  }
  return { status: 'unavailable', reason: 'source-owned-launcher-unresolved' };
}

export function sanitizePublicLaunchHref(
  href: string | null,
  nodeId?: string | null,
): string | null {
  if (!href) return null;
  const projected = projectSourceOwnedLaunchDescriptor({
    title: 'resource',
    type: 'resource',
    href,
    canonicalId: nodeId,
  });
  return projected.status === 'available' ? projected.descriptor.launch.href : null;
}

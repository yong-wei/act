import type {
  ActiveNodeResourceBindings,
  ActiveResourceBinding,
} from '@/features/knowledge/active-authority-graph-contracts';
import {
  getLiveResourceRegistryIndex,
} from '@/features/knowledge/resource-index/public-api';
import type { RegistryIndex } from '@/features/knowledge/resource-index/types';

import { sanitizePublicLaunchHref } from './launch';
import type { KnowledgeSurfaceRegistryIndexIdentity } from './types';

const GIT_SHA = /^[a-f0-9]{40}$/i;
const IDENTITY_MISMATCH_MESSAGE = '当前系统资源与所选对象身份不一致。';
const UNAVAILABLE_MESSAGE = '当前系统资源暂时不可用。';

export function registryIndexIdentityOf(
  index: RegistryIndex,
): KnowledgeSurfaceRegistryIndexIdentity | null {
  const captureRevision = uniqueCaptureRevision(index);
  if (!captureRevision) return null;
  const dirty = index.captures.some((capture) => (capture.sharedRevision ?? '').toLowerCase().endsWith('-dirty'));
  return {
    contract: index.contract,
    identity: index.identity,
    digest: index.digest,
    captureRevision,
    ...(dirty ? { dirty: true } : {}),
  };
}

export function tryLiveRegistryIndex(): RegistryIndex | null {
  try {
    return getLiveResourceRegistryIndex();
  } catch {
    return null;
  }
}

export function tryLiveRegistryIndexIdentity(): KnowledgeSurfaceRegistryIndexIdentity | null {
  const index = tryLiveRegistryIndex();
  return index ? registryIndexIdentityOf(index) : null;
}

export function uniqueCaptureRevision(
  index: RegistryIndex,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const revisions = index.captures
    .map((capture) => capture.sharedRevision?.trim() ?? '')
    .filter((revision) => revision.length > 0);
  if (revisions.length === 0 || revisions.length !== index.captures.length) return null;
  const unique = new Set(revisions);
  if (unique.size !== 1) return null;
  const revision = [...unique][0];
  const sha = revision.toLowerCase().replace(/-dirty$/u, '');
  if (!GIT_SHA.test(sha)) return null;
  if (revision.toLowerCase().endsWith('-dirty')) {
    const pin = env.APP_REVISION?.trim().toLowerCase() ?? '';
    return pin && pin === sha && env.APP_REVISION_FILE?.trim() ? sha : null;
  }
  return sha;
}

export function capturesMatch(
  expectedCaptureRevision: string | null | undefined,
  indexCaptureRevision: string | null,
): boolean {
  if (!expectedCaptureRevision || !indexCaptureRevision) return false;
  return expectedCaptureRevision.trim().toLowerCase() === indexCaptureRevision;
}

export function sanitizePublicResourceBindingLaunches(
  bindings: ActiveNodeResourceBindings,
  nodeId: string,
): ActiveNodeResourceBindings {
  if (bindings.state !== 'available') return bindings;
  const items = bindings.items.map((item): ActiveResourceBinding => {
    if (item.launch.kind === 'viewer-shell') {
      const keep = item.availability === 'available' && item.viewer != null;
      const next: ActiveResourceBinding = {
        title: item.title,
        bindingRole: item.bindingRole,
        resourceKind: item.resourceKind,
        availability: keep ? 'available' : 'unavailable',
        launch: { kind: keep ? 'viewer-shell' : 'unavailable', href: null },
      };
      if (keep && item.viewer) next.viewer = item.viewer;
      return next;
    }
    const href = sanitizePublicLaunchHref(item.launch.href, nodeId);
    return {
      ...item,
      availability: href ? 'available' : 'unavailable',
      launch: {
        kind: href ? item.launch.kind : 'unavailable',
        href,
      },
    };
  });
  return { state: 'available', items };
}

export function indexOwnsLaunchHref(index: RegistryIndex, href: string): boolean {
  return index.entries.some((entry) => {
    const launcherRef = entry.descriptor.launcher?.launcherRef;
    const registryId = entry.descriptor.foreignRefs.registryId;
    const sourceRef = entry.descriptor.identity.sourceRef;
    return launcherRef === href
      || registryId === href
      || sourceRef === href;
  });
}

export function closeResourceBlockWithRegistryIndex(input: {
  bindings: ActiveNodeResourceBindings;
  index: RegistryIndex | null;
  expectedCaptureRevision: string | null;
}): {
  bindings: ActiveNodeResourceBindings;
  registryIndex: KnowledgeSurfaceRegistryIndexIdentity | null;
} {
  if (input.bindings.state !== 'available') {
    return { bindings: input.bindings, registryIndex: null };
  }
  const identity = input.index ? registryIndexIdentityOf(input.index) : null;
  if (!input.index || !identity) {
    return {
      bindings: { state: 'unavailable', message: UNAVAILABLE_MESSAGE },
      registryIndex: null,
    };
  }
  if (!capturesMatch(input.expectedCaptureRevision, identity.captureRevision ?? null)) {
    return {
      bindings: { state: 'unavailable', message: IDENTITY_MISMATCH_MESSAGE },
      registryIndex: null,
    };
  }

  const items = input.bindings.items.map((item) => {
    if (item.availability !== 'available' || !item.launch.href) return item;
    if (indexOwnsLaunchHref(input.index!, item.launch.href)) return item;
    return {
      ...item,
      availability: 'unavailable' as const,
      launch: { ...item.launch, kind: 'unavailable' as const, href: null },
    };
  });
  const ownedAvailable = items.some((item) => item.availability === 'available');
  if (!ownedAvailable) {
    return {
      bindings: { state: 'unavailable', message: IDENTITY_MISMATCH_MESSAGE },
      registryIndex: null,
    };
  }
  return {
    bindings: { state: 'available', items },
    registryIndex: identity,
  };
}

export function closeResourceBlockWithLiveRegistryIndex(input: {
  bindings: ActiveNodeResourceBindings;
  expectedCaptureRevision: string | null;
}): {
  bindings: ActiveNodeResourceBindings;
  registryIndex: KnowledgeSurfaceRegistryIndexIdentity | null;
} {
  return closeResourceBlockWithRegistryIndex({
    bindings: input.bindings,
    index: tryLiveRegistryIndex(),
    expectedCaptureRevision: input.expectedCaptureRevision,
  });
}

import type { ActiveNodeResourceBindings } from '@/features/knowledge/active-authority-graph-contracts';
import {
  getLiveResourceRegistryIndex,
} from '@/features/knowledge/resource-index/public-api';
import type { RegistryIndex } from '@/features/knowledge/resource-index/types';

import type { KnowledgeSurfaceRegistryIndexIdentity } from './types';
import { isGovernedTextbookReaderHref } from './launch';

const GIT_SHA = /^[a-f0-9]{40}$/i;
const IDENTITY_MISMATCH_MESSAGE = '当前系统资源与所选对象身份不一致。';
const UNAVAILABLE_MESSAGE = '当前系统资源暂时不可用。';

export function registryIndexIdentityOf(
  index: RegistryIndex,
): KnowledgeSurfaceRegistryIndexIdentity | null {
  const captureRevision = uniqueCaptureRevision(index);
  if (!captureRevision) return null;
  return {
    contract: index.contract,
    identity: index.identity,
    digest: index.digest,
    captureRevision,
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

export function uniqueCaptureRevision(index: RegistryIndex): string | null {
  const revisions = index.captures
    .map((capture) => capture.sharedRevision?.trim() ?? '')
    .filter((revision) => revision.length > 0);
  if (revisions.length === 0 || revisions.length !== index.captures.length) return null;
  const unique = new Set(revisions);
  if (unique.size !== 1) return null;
  const revision = [...unique][0];
  if (revision.endsWith('-dirty')) return null;
  const sha = revision.toLowerCase();
  return GIT_SHA.test(sha) ? sha : null;
}

export function capturesMatch(
  expectedCaptureRevision: string | null | undefined,
  indexCaptureRevision: string | null,
): boolean {
  if (!expectedCaptureRevision || !indexCaptureRevision) return false;
  return expectedCaptureRevision.trim().toLowerCase() === indexCaptureRevision;
}

function indexOwnsLaunchHref(index: RegistryIndex, href: string): boolean {
  if (isGovernedTextbookReaderHref(href)) return true;
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

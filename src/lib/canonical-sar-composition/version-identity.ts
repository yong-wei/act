/**
 * Explicit version-context → adapter / hit identity mapping (#1114).
 *
 * Every adapter `versionIdentity` and every hit `versionRef` MUST equal the
 * closed mapping for its namespace derived from `SarCompositionVersionContext`.
 *
 * Mapping:
 * - repository  → `repo:${releaseId}@${projectionDigest}`
 *                 releaseSetId + releaseId required; overlayVersion = null
 * - kaq         → `kaq:${kaqBindingVersion}`
 *                 releaseSetId + releaseId required; overlayVersion = kaqBindingVersion
 * - resource    → `resource:${resourceBindingVersion}`
 *                 releaseSetId + releaseId required; overlayVersion = resourceBindingVersion
 * - path        → `path:${pathOverlayVersion}`
 *                 releaseSetId required; releaseId MUST be null;
 *                 overlayVersion = pathOverlayVersion
 * - learner-state → `learner:${learnerStateOverlayVersion}`
 *                 releaseSetId required; releaseId MUST be null;
 *                 overlayVersion = learnerStateOverlayVersion
 */

import {
  SAR_AUTHORITY_OWNERS,
  type SarAuthorityOwner,
  type SarCompositionVersionContext,
  type SarSourceNamespace,
} from './contracts';

export interface SarSourceVersionClosure {
  namespace: SarSourceNamespace;
  authorityOwner: SarAuthorityOwner;
  versionIdentity: string;
  versionRef: string;
  releaseSetId: string;
  /** null for path / learner-state public contract. */
  releaseId: string | null;
  /** null for repository; overlay field for the other four sources. */
  overlayVersion: string | null;
}

export function expectedSourceVersionClosure(
  namespace: SarSourceNamespace,
  version: SarCompositionVersionContext,
): SarSourceVersionClosure {
  const releaseSetId = version.releaseSetId;
  switch (namespace) {
    case 'repository': {
      const versionIdentity = `repo:${version.releaseId}@${version.projectionDigest}`;
      return {
        namespace,
        authorityOwner: SAR_AUTHORITY_OWNERS.repository,
        versionIdentity,
        versionRef: versionIdentity,
        releaseSetId,
        releaseId: version.releaseId,
        overlayVersion: null,
      };
    }
    case 'kaq': {
      const versionIdentity = `kaq:${version.kaqBindingVersion}`;
      return {
        namespace,
        authorityOwner: SAR_AUTHORITY_OWNERS.kaq,
        versionIdentity,
        versionRef: versionIdentity,
        releaseSetId,
        releaseId: version.releaseId,
        overlayVersion: version.kaqBindingVersion,
      };
    }
    case 'resource': {
      const versionIdentity = `resource:${version.resourceBindingVersion}`;
      return {
        namespace,
        authorityOwner: SAR_AUTHORITY_OWNERS.resource,
        versionIdentity,
        versionRef: versionIdentity,
        releaseSetId,
        releaseId: version.releaseId,
        overlayVersion: version.resourceBindingVersion,
      };
    }
    case 'path': {
      const versionIdentity = `path:${version.pathOverlayVersion}`;
      return {
        namespace,
        authorityOwner: SAR_AUTHORITY_OWNERS.path,
        versionIdentity,
        versionRef: versionIdentity,
        releaseSetId,
        releaseId: null,
        overlayVersion: version.pathOverlayVersion,
      };
    }
    case 'learner-state': {
      const versionIdentity = `learner:${version.learnerStateOverlayVersion}`;
      return {
        namespace,
        authorityOwner: SAR_AUTHORITY_OWNERS['learner-state'],
        versionIdentity,
        versionRef: versionIdentity,
        releaseSetId,
        releaseId: null,
        overlayVersion: version.learnerStateOverlayVersion,
      };
    }
    default: {
      const _exhaustive: never = namespace;
      throw new Error(`Unknown SAR namespace: ${_exhaustive}`);
    }
  }
}

export function expectedAdapterVersionIdentity(
  namespace: SarSourceNamespace,
  version: SarCompositionVersionContext,
): string {
  return expectedSourceVersionClosure(namespace, version).versionIdentity;
}

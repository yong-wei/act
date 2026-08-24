import 'server-only';

import {
  ACT_RUNTIME_BLOB_RELEASE_SCHEMA_VERSION,
  type ActRuntimeBlobReleaseManifest,
} from '@/lib/runtime-release';
import { readActiveRuntimeReleaseManifest, RuntimeActiveReleaseError } from '@/lib/runtime-active-release';

export const RUNTIME_READINESS_BLOB_VIEW_MODE = 'ossfs-blob-view';

export type RuntimeReadinessIdentity = {
  schemaVersion: typeof ACT_RUNTIME_BLOB_RELEASE_SCHEMA_VERSION;
  releaseId: string;
  manifestSha256: string;
  treeSha256: string;
};

export type RuntimeReadinessProjection = {
  required: boolean;
  ready: boolean;
  identity: RuntimeReadinessIdentity | null;
};

export function isBlobViewRuntimeRequired(
  deliveryMode = process.env.RUNTIME_DELIVERY_MODE,
): boolean {
  return deliveryMode?.trim() === RUNTIME_READINESS_BLOB_VIEW_MODE;
}

export function projectRuntimeIdentity(
  manifest: ActRuntimeBlobReleaseManifest,
): RuntimeReadinessIdentity {
  return {
    schemaVersion: ACT_RUNTIME_BLOB_RELEASE_SCHEMA_VERSION,
    releaseId: manifest.releaseId,
    manifestSha256: manifest.manifestSha256,
    treeSha256: manifest.treeSha256,
  };
}

export async function projectRuntimeReadiness(
  runtimeRoot?: string,
  activeReceiptPath?: string,
): Promise<RuntimeReadinessProjection> {
  const required = isBlobViewRuntimeRequired();
  if (!required) {
    return { required: false, ready: true, identity: null };
  }

  try {
    const manifest = await readActiveRuntimeReleaseManifest(runtimeRoot, activeReceiptPath);
    if (!manifest || manifest.schemaVersion !== ACT_RUNTIME_BLOB_RELEASE_SCHEMA_VERSION) {
      return { required: true, ready: false, identity: null };
    }
    return {
      required: true,
      ready: true,
      identity: projectRuntimeIdentity(manifest),
    };
  } catch (error) {
    if (error instanceof RuntimeActiveReleaseError) {
      return { required: true, ready: false, identity: null };
    }
    throw error;
  }
}

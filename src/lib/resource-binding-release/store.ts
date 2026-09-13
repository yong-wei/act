import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { projectionDigest, projectionSha256 } from '@/lib/teaching-projection/hash';

import type { BuiltResourceBindingRelease } from './builder';
import {
  DEFAULT_RESOURCE_BINDING_RUNTIME_RELATIVE,
  RESOURCE_BINDING_RELEASE_CURRENT_CONTRACT,
  RESOURCE_BINDING_RELEASE_FILES,
  ResourceBindingReleaseError,
  type AnchoredBindingRuntime,
  type AnchoredResourceRuntime,
  type ResourceBindingAuditReport,
  type ResourceBindingGateResult,
  type ResourceBindingReleaseCurrentPointer,
  type ResourceBindingReleaseManifest,
} from './contracts';

export interface LoadedResourceBindingRelease {
  manifest: ResourceBindingReleaseManifest;
  resources: AnchoredResourceRuntime[];
  bindings: AnchoredBindingRuntime[];
  gate: ResourceBindingGateResult;
  releaseDir: string;
}

export function resourceBindingRuntimeDir(repoRoot: string): string {
  return path.join(repoRoot, DEFAULT_RESOURCE_BINDING_RUNTIME_RELATIVE);
}

export function resourceBindingReleaseDir(repoRoot: string, bindingReleaseId: string): string {
  return path.join(resourceBindingRuntimeDir(repoRoot), 'releases', bindingReleaseId);
}

function toJsonl(rows: readonly unknown[]): string {
  return rows.map((row) => JSON.stringify(row)).join('\n');
}

function parseJsonl<T>(text: string): T[] {
  return text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as T);
}

/** Write an immutable release directory. Refuses to overwrite a different release with the same id. */
export function writeResourceBindingRelease(repoRoot: string, built: BuiltResourceBindingRelease): string {
  const releaseDir = resourceBindingReleaseDir(repoRoot, built.manifest.bindingReleaseId);
  if (existsSync(releaseDir)) {
    const existing = JSON.parse(
      readFileSync(path.join(releaseDir, RESOURCE_BINDING_RELEASE_FILES.manifest), 'utf8'),
    ) as ResourceBindingReleaseManifest;
    if (existing.bindingHash !== built.manifest.bindingHash) {
      throw new ResourceBindingReleaseError(
        'release-immutable',
        `${built.manifest.bindingReleaseId} already exists with a different bindingHash; bump the binding revision`,
      );
    }
    return releaseDir;
  }
  const staging = `${releaseDir}.staging-${process.pid}`;
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  writeFileSync(path.join(staging, RESOURCE_BINDING_RELEASE_FILES.manifest), `${JSON.stringify(built.manifest, null, 2)}\n`);
  writeFileSync(path.join(staging, RESOURCE_BINDING_RELEASE_FILES.resources), `${toJsonl(built.resources)}\n`);
  writeFileSync(path.join(staging, RESOURCE_BINDING_RELEASE_FILES.bindings), `${toJsonl(built.bindings)}\n`);
  writeFileSync(path.join(staging, RESOURCE_BINDING_RELEASE_FILES.gate), `${JSON.stringify(built.gate, null, 2)}\n`);
  writeFileSync(path.join(staging, RESOURCE_BINDING_RELEASE_FILES.audit), `${JSON.stringify(built.audit, null, 2)}\n`);
  mkdirSync(path.dirname(releaseDir), { recursive: true });
  renameSync(staging, releaseDir);
  return releaseDir;
}

export function writeResourceBindingCurrentPointer(
  repoRoot: string,
  manifest: ResourceBindingReleaseManifest,
  activatedAt = new Date().toISOString(),
): ResourceBindingReleaseCurrentPointer {
  if (!manifest.gatePassed) {
    throw new ResourceBindingReleaseError('gate-failed', `${manifest.bindingReleaseId} did not pass its gate; refusing to point current at it`);
  }
  const pointer: ResourceBindingReleaseCurrentPointer = {
    contract: RESOURCE_BINDING_RELEASE_CURRENT_CONTRACT,
    bindingReleaseId: manifest.bindingReleaseId,
    bindingHash: manifest.bindingHash,
    authorityReleaseId: manifest.authorityReleaseId,
    activatedAt,
  };
  const dir = resourceBindingRuntimeDir(repoRoot);
  mkdirSync(dir, { recursive: true });
  const target = path.join(dir, 'current.json');
  const tmp = `${target}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(pointer, null, 2)}\n`);
  renameSync(tmp, target);
  return pointer;
}

export function readResourceBindingCurrentPointer(repoRoot: string): ResourceBindingReleaseCurrentPointer | null {
  const file = path.join(resourceBindingRuntimeDir(repoRoot), 'current.json');
  if (!existsSync(file)) return null;
  const pointer = JSON.parse(readFileSync(file, 'utf8')) as ResourceBindingReleaseCurrentPointer;
  if (pointer.contract !== RESOURCE_BINDING_RELEASE_CURRENT_CONTRACT) {
    throw new ResourceBindingReleaseError('pointer-invalid', `unexpected contract in ${file}`);
  }
  return pointer;
}

/** Load and verify one release: file digests must match the manifest and the manifest its hash. */
export function loadResourceBindingRelease(repoRoot: string, bindingReleaseId: string): LoadedResourceBindingRelease {
  const releaseDir = resourceBindingReleaseDir(repoRoot, bindingReleaseId);
  const manifestPath = path.join(releaseDir, RESOURCE_BINDING_RELEASE_FILES.manifest);
  if (!existsSync(manifestPath)) {
    throw new ResourceBindingReleaseError('release-missing', `binding release ${bindingReleaseId} is not staged`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ResourceBindingReleaseManifest;
  const { bindingReleaseId: id, bindingHash, ...body } = manifest;
  if (id !== bindingReleaseId) {
    throw new ResourceBindingReleaseError('release-id-mismatch', `manifest names ${id}, directory is ${bindingReleaseId}`);
  }
  if (projectionDigest(body) !== bindingHash) {
    throw new ResourceBindingReleaseError('release-hash-mismatch', `${bindingReleaseId} manifest body does not match bindingHash`);
  }
  const resourcesText = readFileSync(path.join(releaseDir, RESOURCE_BINDING_RELEASE_FILES.resources), 'utf8');
  const bindingsText = readFileSync(path.join(releaseDir, RESOURCE_BINDING_RELEASE_FILES.bindings), 'utf8');
  const gate = JSON.parse(readFileSync(path.join(releaseDir, RESOURCE_BINDING_RELEASE_FILES.gate), 'utf8')) as ResourceBindingGateResult;
  if (projectionSha256(resourcesText.replace(/\n$/u, '')) !== manifest.sourceHashes.resources) {
    throw new ResourceBindingReleaseError('resources-hash-mismatch', `${bindingReleaseId} resources.jsonl drifted`);
  }
  if (projectionSha256(bindingsText.replace(/\n$/u, '')) !== manifest.sourceHashes.bindings) {
    throw new ResourceBindingReleaseError('bindings-hash-mismatch', `${bindingReleaseId} bindings.jsonl drifted`);
  }
  if (projectionDigest(gate) !== manifest.sourceHashes.gate) {
    throw new ResourceBindingReleaseError('gate-hash-mismatch', `${bindingReleaseId} gate.json drifted`);
  }
  return {
    manifest,
    resources: parseJsonl<AnchoredResourceRuntime>(resourcesText),
    bindings: parseJsonl<AnchoredBindingRuntime>(bindingsText),
    gate,
    releaseDir,
  };
}

export function readResourceBindingAudit(repoRoot: string, bindingReleaseId: string): ResourceBindingAuditReport {
  return JSON.parse(
    readFileSync(path.join(resourceBindingReleaseDir(repoRoot, bindingReleaseId), RESOURCE_BINDING_RELEASE_FILES.audit), 'utf8'),
  ) as ResourceBindingAuditReport;
}

/** Load the release named by current.json, verifying pointer and manifest agree. */
export function loadCurrentResourceBindingRelease(repoRoot: string): LoadedResourceBindingRelease | null {
  const pointer = readResourceBindingCurrentPointer(repoRoot);
  if (!pointer) return null;
  const loaded = loadResourceBindingRelease(repoRoot, pointer.bindingReleaseId);
  if (loaded.manifest.bindingHash !== pointer.bindingHash) {
    throw new ResourceBindingReleaseError('pointer-hash-mismatch', 'resource-bindings/current.json hash does not match the staged release');
  }
  if (!loaded.manifest.gatePassed) {
    throw new ResourceBindingReleaseError('gate-failed', `${pointer.bindingReleaseId} is current but its gate did not pass`);
  }
  return loaded;
}

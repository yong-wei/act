/** File and map backends for the v0.22 production cutover protocol. */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { envelopeByName } from '../../../src/lib/actkg-envelope/composite-envelope-registry';
import { atomicWriteFile } from '../../../src/lib/versioned-knowledge-activation/store';
import {
  pointerIdentityFromBytes,
  V022_CUTOVER_COMPONENTS,
  V022_CUTOVER_POINTER_PATHS,
  V022_TARGET_IDENTITIES,
  type CutoverPointerBackend,
  type PointerIdentity,
  type V022CutoverComponent,
} from './v022-production-cutover';

const V022_ENVELOPE = envelopeByName('control-theory-engineering-v0.22');

function pointerJson(component: V022CutoverComponent, id: string, hash: string): Buffer {
  const body = component === 'authority'
    ? {
      contract: 'actkg-engineering-authority-current/v1',
      snapshotId: id,
      snapshotHash: hash,
      releaseId: V022_ENVELOPE.authorityReleaseId,
    }
    : component === 'projection'
      ? {
        contract: 'act-teaching-projection-current/v1',
        projectionId: id,
        projectionHash: hash,
        authorityReleaseId: V022_ENVELOPE.authorityReleaseId,
      }
      : component === 'prerequisite'
        ? {
          contract: 'act-teaching-prerequisite-current/v1',
          publicationId: id,
          publicationHash: hash,
        }
        : component === 'authority-domain-shards'
          ? {
            contract: 'act-authority-domain-shard-current/v1',
            shardSetId: id,
            shardSetHash: hash,
            snapshotId: V022_TARGET_IDENTITIES.authority.id,
            snapshotHash: V022_TARGET_IDENTITIES.authority.hash,
            releaseId: V022_ENVELOPE.authorityReleaseId,
            catalogId: V022_ENVELOPE.catalogId,
            catalogHash: V022_ENVELOPE.catalogHash,
          }
          : {
            contract: 'act-versioned-knowledge-consumer-activation-current/v1',
            activationId: id,
            activationHash: hash,
          };
  return Buffer.from(`${JSON.stringify(body)}\n`, 'utf8');
}

export function createV022MapPointerBackend(
  initial: Partial<Record<V022CutoverComponent, Buffer>> = {},
): CutoverPointerBackend & { dump(): Record<V022CutoverComponent, Buffer | null> } {
  const files = new Map<V022CutoverComponent, Buffer>();
  for (const component of V022_CUTOVER_COMPONENTS) {
    if (initial[component]) files.set(component, initial[component]!);
  }
  return {
    read(component) {
      const bytes = files.get(component);
      return bytes ? pointerIdentityFromBytes(component, bytes) : null;
    },
    apply(component, targetId) {
      const hash = component === 'consumer-activation'
        ? (V022_TARGET_IDENTITIES[component].hash ?? 'c'.repeat(64))
        : V022_TARGET_IDENTITIES[component].hash!;
      const id = targetId;
      const bytes = pointerJson(component, id, hash);
      files.set(component, bytes);
      return pointerIdentityFromBytes(component, bytes);
    },
    restore(component, predecessor) {
      files.set(component, predecessor.bytes);
      return pointerIdentityFromBytes(component, predecessor.bytes);
    },
    dump() {
      return Object.fromEntries(
        V022_CUTOVER_COMPONENTS.map((component) => [component, files.get(component) ?? null]),
      ) as Record<V022CutoverComponent, Buffer | null>;
    },
  };
}

export function createV022FilePointerBackend(root: string): CutoverPointerBackend {
  const fileFor = (component: V022CutoverComponent): string => (
    path.join(root, V022_CUTOVER_POINTER_PATHS[component])
  );
  return {
    read(component) {
      const filePath = fileFor(component);
      try {
        return pointerIdentityFromBytes(component, readFileSync(filePath));
      } catch {
        return null;
      }
    },
    apply(component, targetId) {
      const hash = component === 'consumer-activation'
        ? (V022_TARGET_IDENTITIES[component].hash ?? 'c'.repeat(64))
        : V022_TARGET_IDENTITIES[component].hash!;
      const bytes = pointerJson(component, targetId, hash);
      const filePath = fileFor(component);
      mkdirSync(path.dirname(filePath), { recursive: true });
      atomicWriteFile(filePath, bytes.toString('utf8'));
      return pointerIdentityFromBytes(component, readFileSync(filePath));
    },
    restore(component, predecessor) {
      const filePath = fileFor(component);
      mkdirSync(path.dirname(filePath), { recursive: true });
      const tmp = `${filePath}.${process.pid}.tmp`;
      writeFileSync(tmp, predecessor.bytes);
      renameSync(tmp, filePath);
      return pointerIdentityFromBytes(component, predecessor.bytes);
    },
  };
}

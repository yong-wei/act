/** File and map backends for the v0.18 production cutover protocol. */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { atomicWriteFile } from '../../../src/lib/versioned-knowledge-activation/store';
import {
  pointerIdentityFromBytes,
  V018_CUTOVER_COMPONENTS,
  V018_CUTOVER_POINTER_PATHS,
  V018_TARGET_IDENTITIES,
  type CutoverPointerBackend,
  type PointerIdentity,
  type V018CutoverComponent,
} from './v018-production-cutover';

function pointerJson(component: V018CutoverComponent, id: string, hash: string): Buffer {
  const body = component === 'authority'
    ? {
      contract: 'actkg-engineering-authority-current/v1',
      snapshotId: id,
      snapshotHash: hash,
      releaseId: 'ctr:release:control-theory-engineering-v0.18',
    }
    : component === 'projection'
      ? {
        contract: 'act-teaching-projection-current/v1',
        projectionId: id,
        projectionHash: hash,
        authorityReleaseId: 'ctr:release:control-theory-engineering-v0.18',
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
            snapshotId: V018_TARGET_IDENTITIES.authority.id,
            snapshotHash: V018_TARGET_IDENTITIES.authority.hash,
            releaseId: 'ctr:release:control-theory-engineering-v0.18',
          }
          : {
            contract: 'act-versioned-knowledge-consumer-activation-current/v1',
            activationId: id,
            activationHash: hash,
          };
  return Buffer.from(`${JSON.stringify(body)}\n`, 'utf8');
}

export function createMapPointerBackend(
  initial: Partial<Record<V018CutoverComponent, Buffer>>,
): CutoverPointerBackend & { dump(): Record<V018CutoverComponent, Buffer | null> } {
  const files = new Map<V018CutoverComponent, Buffer>();
  for (const component of V018_CUTOVER_COMPONENTS) {
    if (initial[component]) files.set(component, initial[component]!);
  }
  return {
    read(component) {
      const bytes = files.get(component);
      return bytes ? pointerIdentityFromBytes(component, bytes) : null;
    },
    apply(component, targetId) {
      const hash = component === 'consumer-activation'
        ? (V018_TARGET_IDENTITIES[component].hash ?? 'c'.repeat(64))
        : V018_TARGET_IDENTITIES[component].hash!;
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
        V018_CUTOVER_COMPONENTS.map((component) => [component, files.get(component) ?? null]),
      ) as Record<V018CutoverComponent, Buffer | null>;
    },
  };
}

export function createFilePointerBackend(root: string): CutoverPointerBackend {
  const fileFor = (component: V018CutoverComponent): string => (
    path.join(root, V018_CUTOVER_POINTER_PATHS[component])
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
        ? (V018_TARGET_IDENTITIES[component].hash ?? 'c'.repeat(64))
        : V018_TARGET_IDENTITIES[component].hash!;
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

import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { projectionSha256 } from '@/lib/teaching-projection/hash';

import { ResourceBindingReleaseError } from './contracts';

/** `ctr:release:control-theory-engineering-v0.37` + `…-r6` -> `control-theory-engineering-v0.37-r6`. */
export function authorityRevisionLabel(authorityReleaseId: string, authorityReleaseSetId: string | null): string {
  const label = authorityReleaseId.replace(/^ctr:release:/u, '').trim();
  if (!label) {
    throw new ResourceBindingReleaseError('authority-release-id-invalid', `cannot derive a label from ${authorityReleaseId}`);
  }
  const revision = authorityReleaseSetId?.match(/-(r\d+)$/u)?.[1] ?? null;
  return revision ? `${label}-${revision}` : label;
}

export function bindingReleaseIdFor(label: string, bindingRevision: number): string {
  if (!Number.isInteger(bindingRevision) || bindingRevision < 1) {
    throw new ResourceBindingReleaseError('binding-revision-invalid', `binding revision must be a positive integer, got ${bindingRevision}`);
  }
  return `${label}-b${bindingRevision}`;
}

export function parseBindingRevision(bindingReleaseId: string, label: string): number | null {
  const match = bindingReleaseId.match(new RegExp(`^${escapeRegExp(label)}-b(\\d+)$`, 'u'));
  return match ? Number(match[1]) : null;
}

/** Next `b<n>` for the given authority label by scanning existing release directories. */
export function nextBindingRevision(runtimeDir: string, label: string): number {
  const releasesDir = path.join(runtimeDir, 'releases');
  if (!existsSync(releasesDir)) return 1;
  let max = 0;
  for (const name of readdirSync(releasesDir)) {
    const revision = parseBindingRevision(name, label);
    if (revision !== null && revision > max) max = revision;
  }
  return max + 1;
}

export function bindingIdFor(input: {
  resourceId: string;
  anchorKey: string;
  canonicalId: string;
  role: string;
  scopeId: string;
}): string {
  const digest = projectionSha256(
    [input.resourceId, input.anchorKey, input.canonicalId, input.role, input.scopeId].join('|'),
  );
  return `bind-${digest.slice(0, 32)}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

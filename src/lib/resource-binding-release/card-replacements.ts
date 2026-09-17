import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectionSha256 } from '@/lib/teaching-projection/hash';
import type { TeachingBindingRuntime } from '@/lib/teaching-projection/contracts';
import { ResourceBindingReleaseError } from './contracts';

export const CARD_REPLACEMENTS_PATH = 'course-content/authoring/knowledge/resource-bindings/card-replacements.json';

export interface CardReplacement {
  canonicalId: string;
  cardId: string;
  title: string;
  sha256: string;
  retiredResourceIds: string[];
}

export interface CardReplacements {
  digest: string;
  rows: CardReplacement[];
}

export function loadCardReplacements(
  repoRoot: string,
  authority: { releaseId: string; releaseSetId?: string | null; snapshotId?: string | null; snapshotHash?: string | null },
  existingBindings: readonly TeachingBindingRuntime[],
): CardReplacements | undefined {
  const file = join(repoRoot, CARD_REPLACEMENTS_PATH);
  if (!existsSync(file)) return undefined;
  const raw = readFileSync(file, 'utf8');
  const data = JSON.parse(raw);
  const reject = (reason: string): never => { throw new ResourceBindingReleaseError('card-replacement-invalid', reason); };
  if (data.contract !== 'act-reviewed-card-replacements/v1' || data.status !== 'accepted' || !Array.isArray(data.rows)) reject('Invalid replacement record');
  for (const key of ['releaseId', 'releaseSetId', 'snapshotId', 'snapshotHash'] as const) {
    if (!authority[key] || data.authority?.[key] !== authority[key]) reject(`Authority drift: ${key}`);
  }
  const engineering = JSON.parse(readFileSync(join(repoRoot, 'course-content/authoring/knowledge/authority/releases', authority.snapshotId!, 'engineering.json'), 'utf8'));
  const endpoints = new Map<string, { canonicalType: string; reviewStatus: string; publicationStatus: string; lifecycleStatus: string | null }>(engineering.objects.map((row: { canonicalId: string }) => [row.canonicalId, row]));
  const seen = new Set<string>();
  const retired = new Set<string>();
  for (const row of data.rows as CardReplacement[]) {
    if (typeof row.canonicalId !== 'string' || typeof row.cardId !== 'string'
      || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/u.test(row.cardId)
      || row.cardId !== row.canonicalId.replace(/:/gu, '_')
      || typeof row.title !== 'string' || !row.title.trim()
      || typeof row.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(row.sha256)
      || !Array.isArray(row.retiredResourceIds) || seen.has(row.canonicalId)) reject('Malformed or duplicate replacement');
    seen.add(row.canonicalId);
    const endpoint = endpoints.get(row.canonicalId);
    if (!endpoint || endpoint.canonicalType !== 'DomainConcept' || endpoint.reviewStatus !== 'approved'
      || endpoint.publicationStatus !== 'published' || ['draft', 'retired'].includes(endpoint.lifecycleStatus ?? '')) reject(`Unavailable endpoint: ${row.canonicalId}`);
    for (const kind of ['authoring', 'runtime']) {
      const card = readFileSync(join(repoRoot, 'course-content', kind, 'knowledge/cards/authority/nodes', `${row.cardId}.md`), 'utf8');
      if (projectionSha256(card) !== row.sha256
        || !card.includes(`authority_entity_id: "${row.canonicalId}"`)
        || !/^status:\s*ready\s*$/mu.test(card)) reject(`Card identity or hash drift: ${row.cardId}`);
    }
    for (const id of row.retiredResourceIds) {
      if (typeof id !== 'string' || !id.startsWith('act:card:') || id === `act:card:${row.cardId}` || retired.has(id)) reject('Invalid retirement identity');
      if (existingBindings.some((binding) => binding.resourceId === id && binding.canonicalId !== row.canonicalId)) reject(`Retirement crosses Canonical targets: ${id}`);
      retired.add(id);
    }
    if (existingBindings.some((binding) => binding.canonicalId === row.canonicalId
      && binding.resourceId.startsWith('act:card:') && binding.resourceId !== `act:card:${row.cardId}`
      && !row.retiredResourceIds.includes(binding.resourceId))) reject(`Undeclared old card: ${row.canonicalId}`);
  }
  if ((data.rows as CardReplacement[]).some((row) => retired.has(`act:card:${row.cardId}`))) reject('Replacement is also retired');
  return { digest: projectionSha256(raw), rows: data.rows };
}

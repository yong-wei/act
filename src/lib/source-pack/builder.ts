import { createHash } from 'node:crypto';

import { validateSourcePack } from './schema';
import {
  SOURCE_PACK_SCHEMA_VERSION,
  type SourcePack,
  type SourcePackIndexRefs,
  type SourcePackItem,
  type SourcePackLimitation,
  type SourcePackProfile,
  type SourcePackQuery,
} from './types';

export type BuildSourcePackCoverageInput = Pick<SourcePack['coverage'], 'eligibleItems' | 'omittedItems' | 'coverageRatio' | 'notes'>;

export interface BuildSourcePackInput {
  query: string | SourcePackQuery;
  profile?: SourcePackProfile;
  caller?: string;
  topK?: number;
  items?: SourcePackItem[];
  limitations?: SourcePackLimitation[];
  indexRefs?: Partial<SourcePackIndexRefs>;
  coverage?: Partial<BuildSourcePackCoverageInput>;
  now?: Date;
}

export function buildSourcePack(input: BuildSourcePackInput): SourcePack {
  const now = input.now ?? new Date();
  const profile = typeof input.query === 'string'
    ? input.profile ?? 'generic'
    : input.query.profile;
  const topK = input.topK ?? (typeof input.query === 'string' ? undefined : input.query.topK) ?? 5;
  const query: SourcePackQuery = typeof input.query === 'string'
    ? {
      queryId: stableId('query', [profile, input.query]),
      text: input.query,
      profile,
      caller: input.caller,
      topK,
    }
    : {
      ...input.query,
      topK,
    };
  const items = input.items ?? [];
  const limitations = input.limitations ?? (
    items.length === 0
      ? [buildUnavailableLimitation()]
      : []
  );
  const generatedAt = now.toISOString();
  const indexRefs: SourcePackIndexRefs = {
    generatedAt,
    ...input.indexRefs,
  };
  if (!indexRefs.corpusVersion && !indexRefs.graphVersion && !indexRefs.projectionVersion) {
    indexRefs.projectionVersion = 'source-pack.builder.shell:no-adapter';
  }
  const queryHash = stableHash([query.profile, query.text, query.filters ?? {}, topK]);
  const citationTargetIds = unique(items.flatMap((item) => [
    item.citationTargetId,
    item.citation?.citationTargetId,
  ].filter((value): value is string => Boolean(value))));
  const retrievalChunkIds = unique(items.map((item) => item.retrievalChunkId).filter((value): value is string => Boolean(value)));
  const pack: SourcePack = {
    packId: stableId('source-pack', [queryHash, items.map((item) => item.id), limitations.map((limitation) => limitation.code)]),
    profile,
    query,
    indexRefs,
    coverage: {
      requestedTopK: topK,
      eligibleItems: items.length,
      omittedItems: Math.max(0, topK - items.length),
      coverageRatio: topK > 0 ? Math.min(1, items.length / topK) : 0,
      notes: items.length === 0 ? ['No governed adapter output was available for this Source Pack shell.'] : undefined,
      ...input.coverage,
      returnedItems: items.length,
    },
    items,
    limitations,
    audit: {
      schemaVersion: SOURCE_PACK_SCHEMA_VERSION,
      createdAt: generatedAt,
      builderId: 'source-pack.builder.shell',
      profile,
      queryHash,
      itemCount: items.length,
      limitationCount: limitations.length,
      citationTargetIds,
      retrievalChunkIds,
    },
  };
  return validateSourcePack(pack);
}

export function buildUnavailableLimitation(source = 'source-pack.builder.shell'): SourcePackLimitation {
  return {
    code: 'adapter-unavailable',
    severity: 'warning',
    message: 'No governed Source Pack adapter is available in this contract-shell change.',
    source,
    recoverable: true,
  };
}

function stableId(prefix: string, parts: unknown[]): string {
  return `${prefix}:${stableHash(parts).slice(0, 16)}`;
}

function stableHash(parts: unknown[]): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

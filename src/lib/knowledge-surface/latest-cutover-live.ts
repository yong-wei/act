import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  parseRuntimeActiveReceipt,
  unavailableLatestKnowledgeCutover,
  verifyLatestKnowledgeCutover,
  type KnowledgeSurfaceLatestCutover,
  type LatestCutoverArtifactPointer,
} from './latest-cutover';

const CANDIDATE_RELATIVE =
  'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c5';
const MISSING_SHA = '0'.repeat(64);

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readBytes(filePath: string): Buffer | null {
  try {
    if (!existsSync(filePath)) return null;
    return readFileSync(filePath);
  } catch {
    return null;
  }
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function parseJson(bytes: Buffer | null): JsonRecord | null {
  if (!bytes) return null;
  try {
    const parsed = JSON.parse(bytes.toString('utf8')) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function identityPointer(
  id: string,
  parsed: JsonRecord | null,
  keys: readonly string[],
  fallback?: Buffer | null,
): LatestCutoverArtifactPointer {
  if (parsed) {
    for (const key of keys) {
      const value = parsed[key];
      if (typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value)) {
        return { id, sha256: value };
      }
    }
  }
  if (fallback) return { id, sha256: sha256(fallback) };
  return { id, sha256: MISSING_SHA };
}

function resolveAuthorityCurrentPath(repoRoot: string, override?: string): string {
  if (override) return override;
  const configured = process.env.ACT_AUTHORITY_STORE_ROOT?.trim()
    || process.env.AUTHORITY_STORE_ROOT?.trim();
  if (configured) return path.join(configured, 'current.json');
  return path.join(repoRoot, 'course-content/authoring/knowledge/authority/current.json');
}

function resolveCandidateRoot(repoRoot: string, override?: string): string {
  if (override) return override;
  const configured = process.env.ACT_LATEST_CUTOVER_CANDIDATE_ROOT?.trim();
  if (configured) return configured;
  return path.join(repoRoot, CANDIDATE_RELATIVE);
}

export function resolveLiveLatestKnowledgeCutover(options: {
  repoRoot?: string;
  receiptPath?: string;
  runtimeReceiptPath?: string;
  authorityCurrentPath?: string;
  candidateRoot?: string;
} = {}): KnowledgeSurfaceLatestCutover {
  const repoRoot = options.repoRoot ?? process.cwd();
  const knowledgeRoot = path.join(repoRoot, 'course-content/runtime/knowledge');
  const candidateRoot = resolveCandidateRoot(repoRoot, options.candidateRoot);
  const values = new Map<string, unknown>();

  const put = (id: string, filePath: string): Buffer | null => {
    if (!filePath) return null;
    const bytes = readBytes(filePath);
    if (bytes) values.set(id, bytes);
    return bytes;
  };

  const receiptPath = options.receiptPath
    ?? process.env.ACT_COORDINATED_ACTIVE_RECEIPT_PATH
    ?? path.join(repoRoot, 'data/runtime/knowledge-cutover/coordinated-active-receipt.json');
  const receiptBytes = put('active-receipt', receiptPath);
  if (!receiptBytes) return unavailableLatestKnowledgeCutover();

  const runtimeReceiptPath = options.runtimeReceiptPath
    ?? process.env.ACT_RUNTIME_ACTIVE_RECEIPT_PATH
    ?? path.join(repoRoot, 'data/runtime/act-runtime-active-receipt.json');
  const runtimeIdentity = parseRuntimeActiveReceipt(parseJson(readBytes(runtimeReceiptPath)));
  if (!runtimeIdentity) return unavailableLatestKnowledgeCutover();

  const authorityBytes = put('authority-current', resolveAuthorityCurrentPath(repoRoot, options.authorityCurrentPath));
  const catalogBytes = put(
    'domain-catalog',
    path.join(knowledgeRoot, 'authority-domain-catalog/catalog.json'),
  );
  const shardPointer = parseJson(readBytes(path.join(knowledgeRoot, 'authority-domain-shards/current.json')));
  const shardSetId = typeof shardPointer?.shardSetId === 'string' ? shardPointer.shardSetId : null;
  const shardBytes = put(
    'domain-shard-set',
    shardSetId
      ? path.join(knowledgeRoot, 'authority-domain-shards/sets', shardSetId, 'manifest.json')
      : '',
  );
  const projectionPointer = parseJson(readBytes(path.join(knowledgeRoot, 'projection/current.json')));
  const projectionHash = typeof projectionPointer?.projectionHash === 'string' ? projectionPointer.projectionHash : null;
  const projectionBytes = put(
    'teaching-projection',
    projectionHash
      ? path.join(knowledgeRoot, 'projection/releases', `proj-${projectionHash}`, 'projection-manifest.json')
      : '',
  );
  const prerequisitePointer = parseJson(readBytes(path.join(knowledgeRoot, 'prerequisites/current.json')));
  const publicationHash = typeof prerequisitePointer?.publicationHash === 'string'
    ? prerequisitePointer.publicationHash
    : null;
  const prerequisiteBytes = put(
    'prerequisites',
    publicationHash
      ? path.join(knowledgeRoot, 'prerequisites/releases', `proj-${publicationHash}`, 'publication-manifest.json')
      : '',
  );
  const activationPointer = parseJson(readBytes(path.join(knowledgeRoot, 'consumer-activation/current.json')));
  const activationId = typeof activationPointer?.activationId === 'string' ? activationPointer.activationId : null;
  const activationBytes = put(
    'consumer-activation',
    activationId
      ? path.join(knowledgeRoot, 'consumer-activation/releases', activationId, 'activation.json')
      : '',
  );
  const extensionBytes = put(
    'extension',
    path.join(candidateRoot, 'successor-runtime-manifest-extension.json'),
  );
  const candidateBytes = put(
    'candidate-receipt',
    path.join(candidateRoot, 'candidate-receipt.json'),
  );
  const closureBytes = put(
    'teaching-closure',
    path.join(candidateRoot, 'teaching-closure-receipt.json'),
  );
  const composedBytes = put(
    'composed-fragments',
    path.join(candidateRoot, 'composed-domain-fragment-manifest.json'),
  );
  const formalBytes = put(
    'formal-resource',
    path.join(candidateRoot, 'formal-resource-envelope.json'),
  );

  const receipt = identityPointer('active-receipt', parseJson(receiptBytes), ['receiptHash'], receiptBytes);
  const authority = authorityBytes
    ? { id: 'authority-current', sha256: sha256(authorityBytes) }
    : identityPointer('authority-current', null, [], null);
  const catalog = identityPointer('domain-catalog', parseJson(catalogBytes), ['catalogHash'], catalogBytes);
  const shards = identityPointer('domain-shard-set', parseJson(shardBytes), ['shardSetHash'], shardBytes);
  // A resealed active set (#1738) stays qualified while the sealed
  // predecessor set remains present in the immutable runtime closure.
  const candidateJson = parseJson(candidateBytes);
  const sealedShardSetHash = typeof candidateJson?.domainShardSetHash === 'string'
    ? candidateJson.domainShardSetHash
    : null;
  const domainShards: LatestCutoverArtifactPointer[] = [shards];
  if (
    sealedShardSetHash
    && shards.sha256 !== sealedShardSetHash
    && sealedShardSetHash.startsWith('ads-') === false
  ) {
    const legacyBytes = put(
      'domain-shard-set-sealed',
      path.join(knowledgeRoot, 'authority-domain-shards/sets', `ads-${sealedShardSetHash}`, 'manifest.json'),
    );
    const legacy = identityPointer(
      'domain-shard-set-sealed',
      parseJson(legacyBytes),
      ['shardSetHash'],
      legacyBytes,
    );
    if (legacy.sha256 === sealedShardSetHash) {
      domainShards.push(legacy);
    }
  }
  const teachingProjection = identityPointer(
    'teaching-projection',
    parseJson(projectionBytes),
    ['projectionHash'],
    projectionBytes,
  );
  const prerequisites = identityPointer(
    'prerequisites',
    parseJson(prerequisiteBytes),
    ['publicationHash'],
    prerequisiteBytes,
  );
  const consumerActivation = identityPointer(
    'consumer-activation',
    parseJson(activationBytes),
    ['activationHash'],
    activationBytes,
  );
  const extension = identityPointer('extension', parseJson(extensionBytes), [], extensionBytes);
  const candidateReceipt = identityPointer(
    'candidate-receipt',
    parseJson(candidateBytes),
    ['receiptHash'],
    candidateBytes,
  );
  const teachingClosure = identityPointer(
    'teaching-closure',
    parseJson(closureBytes),
    ['receiptHash'],
    closureBytes,
  );
  const composed = identityPointer(
    'composed-fragments',
    parseJson(composedBytes),
    ['projectionHash'],
    composedBytes,
  );
  const formalResource = identityPointer(
    'formal-resource',
    parseJson(formalBytes),
    ['envelopeHash'],
    formalBytes,
  );

  const composedJson = parseJson(composedBytes);
  const fragmentPointers: LatestCutoverArtifactPointer[] = [];
  const fragmentList = isRecord(composedJson) && Array.isArray(composedJson.fragments)
    ? composedJson.fragments
    : [];
  for (const row of fragmentList) {
    if (!isRecord(row) || typeof row.fragmentId !== 'string' || typeof row.fragmentDigest !== 'string') {
      continue;
    }
    put(row.fragmentId, path.join(candidateRoot, 'domain-fragments', `${row.fragmentId}.json`));
    fragmentPointers.push({ id: row.fragmentId, sha256: row.fragmentDigest });
  }

  return verifyLatestKnowledgeCutover({
    io: {
      read: (id) => values.get(id) ?? null,
    },
    receipt,
    candidateReceipt,
    authorityCurrent: authority,
    runtimeIdentity,
    extension,
    domainCatalog: catalog,
    domainShards,
    teachingProjection,
    teachingClosure,
    composedDomainFragments: composed,
    domainFragments: fragmentPointers,
    prerequisites,
    consumerActivation,
    formalResource,
  });
}

export function readLiveLatestKnowledgeCutover(): KnowledgeSurfaceLatestCutover {
  return resolveLiveLatestKnowledgeCutover();
}

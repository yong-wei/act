/**
 * Selection-bound Authority learning-content resolver.
 *
 * The composite shard envelope is the cross-domain authorization boundary:
 * it binds a passed Teaching Projection that selects the published card
 * identities and seals its Authority identity. This module only reads
 * exported runtime copies, never authoring sources.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type {
  AuthorityNodeDetailShard,
  AuthorityNodeLearningContent,
} from './contracts';

const LEARNING_CONTENT_MANIFEST_CONTRACT =
  'act-authority-learning-content-manifest/v2' as const;

const CARD_ROOT_RELATIVE =
  'course-content/runtime/knowledge/cards/authority/nodes' as const;
const INFOGRAPH_ROOT_RELATIVE =
  'course-content/runtime/knowledge/infographs/authority/nodes' as const;
const MANIFEST_RELATIVE =
  'course-content/runtime/knowledge/authority-learning-content-manifest.json' as const;
type ManifestCardState = 'available' | 'blocked' | 'missing';
type ManifestInfographState = 'available' | 'missing';

interface AuthorityLearningContentManifest {
  contract: typeof LEARNING_CONTENT_MANIFEST_CONTRACT;
  authorityReleaseId: string;
  authorityReleaseSetId: string;
  authoritySnapshotId: string;
  authoritySnapshotHash: string;
  teachingProjectionId?: string;
  teachingProjectionHash?: string;
  nodes: Array<{
    canonicalId: string;
    safeId: string;
    card: { state: ManifestCardState; sha256: string | null };
    infograph: { state: ManifestInfographState; sha256: string | null };
  }>;
}

interface RuntimePaths {
  cardRoot: string;
  infographRoot: string;
  manifestPath: string;
}

interface ResolvedLearningContent {
  content: AuthorityNodeLearningContent;
  infograph: { path: string; sha256: string } | null;
}

function runtimePaths(repoRoot = process.cwd()): RuntimePaths {
  return {
    cardRoot: join(/*turbopackIgnore: true*/ repoRoot, CARD_ROOT_RELATIVE),
    infographRoot: join(/*turbopackIgnore: true*/ repoRoot, INFOGRAPH_ROOT_RELATIVE),
    manifestPath: join(/*turbopackIgnore: true*/ repoRoot, MANIFEST_RELATIVE),
  };
}

function unavailableContent(): AuthorityNodeLearningContent {
  return {
    card: { state: 'unavailable', message: '当前学习卡片暂时不可用。' },
    infograph: { state: 'unavailable', message: '当前信息图暂时不可用。' },
  };
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function readManifest(paths: RuntimePaths): AuthorityLearningContentManifest | null {
  if (!existsSync(/*turbopackIgnore: true*/ paths.manifestPath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(/*turbopackIgnore: true*/ paths.manifestPath, 'utf8')) as Partial<AuthorityLearningContentManifest>;
    if (
      parsed.contract !== LEARNING_CONTENT_MANIFEST_CONTRACT
      || !isNonEmptyString(parsed.authorityReleaseId)
      || !isNonEmptyString(parsed.authorityReleaseSetId)
      || !isNonEmptyString(parsed.authoritySnapshotId)
      || !isSha256(parsed.authoritySnapshotHash)
      || !Array.isArray(parsed.nodes)
    ) return null;
    const nodes = parsed.nodes.filter((node): node is AuthorityLearningContentManifest['nodes'][number] => (
      Boolean(node)
      && typeof node.canonicalId === 'string'
      && isSafeId(node.safeId)
      && (node.card?.state === 'available' || node.card?.state === 'blocked' || node.card?.state === 'missing')
      && (node.card.sha256 === null || isSha256(node.card.sha256))
      && (node.infograph?.state === 'available' || node.infograph?.state === 'missing')
      && (node.infograph.sha256 === null || isSha256(node.infograph.sha256))
    ));
    if (
      nodes.length !== parsed.nodes.length
      || new Set(nodes.map((node) => node.canonicalId)).size !== nodes.length
      || new Set(nodes.map((node) => node.safeId)).size !== nodes.length
    ) return null;
    return {
      contract: LEARNING_CONTENT_MANIFEST_CONTRACT,
      authorityReleaseId: parsed.authorityReleaseId,
      authorityReleaseSetId: parsed.authorityReleaseSetId,
      authoritySnapshotId: parsed.authoritySnapshotId,
      authoritySnapshotHash: parsed.authoritySnapshotHash,
      teachingProjectionId: isNonEmptyString(parsed.teachingProjectionId) ? parsed.teachingProjectionId : undefined,
      teachingProjectionHash: isSha256(parsed.teachingProjectionHash) ? parsed.teachingProjectionHash : undefined,
      nodes,
    };
  } catch {
    return null;
  }
}

function stripCardFrontmatter(value: string): string | null {
  const match = value.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
  return match?.[1] ?? null;
}

function frontmatterCanonicalId(value: string): string | null {
  const match = value.match(/^authority_entity_id:\s*["']?([^"'\r\n]+)["']?\s*$/m);
  return match?.[1]?.trim() || null;
}

function section(value: string, heading: string, next: string | null): string | null {
  const start = value.indexOf(heading);
  if (start < 0) return null;
  const bodyStart = start + heading.length;
  const end = next ? value.indexOf(next, bodyStart) : value.length;
  return value.slice(bodyStart, end < 0 ? value.length : end).trim();
}

function cleanLearningText(value: string): string | null {
  const normalized = value
    .replace(/<!--[^]*?-->/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/\[(.*?)\]\([^)]*\)/g, '$1')
    .replace(/[*_#>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return null;
  if (
    /(?:\b(?:ctc|ctkg|ctr):|[a-f0-9]{64}|course-content\/|authority_source_sha|control-theory-engineering-v\d+)/i.test(normalized)
  ) return null;
  return normalized;
}

function parseLearnerVisibleCardFields(value: string): {
  summary: string;
  insight: string | null;
  explanation: string;
} | null {
  if (/^status:\s*draft-blocked\s*$/m.test(value)) return null;
  const body = stripCardFrontmatter(value);
  if (!body) return null;
  const front = section(body, '## 首页', '## 详情');
  const detail = section(body, '### 完整解释', '### 关联节点');
  if (!front || !detail) return null;
  const summaryMatch = front.match(/\*\*一句话定义\*\*：\s*([^\n]+)/);
  const insightMatch = front.match(/\*\*核心直觉\*\*：\s*([^\n]+)/);
  const summary = cleanLearningText(summaryMatch?.[1] ?? '');
  const explanation = cleanLearningText(detail);
  if (!summary || !explanation) return null;
  return {
    summary,
    insight: cleanLearningText(insightMatch?.[1] ?? ''),
    explanation,
  };
}

function cardContent(value: string, canonicalId: string): Extract<AuthorityNodeLearningContent['card'], { state: 'available' }> | null {
  if (frontmatterCanonicalId(value) !== canonicalId) return null;
  const parsed = parseLearnerVisibleCardFields(value);
  return parsed ? { state: 'available', ...parsed } : null;
}

const BINDING_CONTENT_TOKEN = /^[\p{L}\p{N}][\p{L}\p{N}._-]{0,199}$/u;
const CARD_NODES_RELATIVE = 'course-content/runtime/knowledge/cards/nodes' as const;
const CARD_AUTHORITY_NODES_RELATIVE = 'course-content/runtime/knowledge/cards/authority/nodes' as const;
const INFOGRAPH_NODES_RELATIVE = 'course-content/runtime/knowledge/infographs/nodes' as const;
const INFOGRAPH_AUTHORITY_NODES_RELATIVE =
  'course-content/runtime/knowledge/infographs/authority/nodes' as const;

export function isBindingContentToken(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 200
    && !value.includes('/')
    && !value.includes('\\')
    && !value.includes('\0')
    && !value.includes('..')
    && BINDING_CONTENT_TOKEN.test(value);
}

function contentHashFromSourcePath(sourcePath: string | null | undefined): string | null {
  const match = sourcePath?.trim().match(/^content:([a-f0-9]{64})$/i);
  return match ? match[1].toLowerCase() : null;
}

function firstExistingFile(candidates: readonly string[]): string | null {
  for (const candidate of candidates) {
    if (existsSync(/*turbopackIgnore: true*/ candidate)) return candidate;
  }
  return null;
}

function envelopeTeachingAvailable(shard: AuthorityNodeDetailShard): boolean {
  const teaching = shard.envelope.teaching;
  return (
    shard.envelope.match.teaching === true
    && teaching.status === 'available'
    && Boolean(teaching.projectionId)
    && Boolean(teaching.projectionHash)
  );
}

function matchesShardAuthority(
  manifest: AuthorityLearningContentManifest,
  shard: AuthorityNodeDetailShard,
): boolean {
  const authority = shard.envelope.authority;
  return (
    manifest.authorityReleaseId === authority.releaseId
    && manifest.authorityReleaseSetId === authority.releaseSetId
    && manifest.authoritySnapshotId === authority.snapshotId
    && manifest.authoritySnapshotHash === authority.snapshotHash
  );
}

function resolveNodeLearningContent(
  shard: AuthorityNodeDetailShard,
  paths = runtimePaths(),
): ResolvedLearningContent {
  if (!envelopeTeachingAvailable(shard)) {
    return { content: unavailableContent(), infograph: null };
  }
  const manifest = readManifest(paths);
  if (!manifest || !matchesShardAuthority(manifest, shard)) {
    return { content: unavailableContent(), infograph: null };
  }
  if (
    manifest.teachingProjectionId
    && manifest.teachingProjectionHash
    && (
      manifest.teachingProjectionId !== shard.envelope.teaching.projectionId
      || manifest.teachingProjectionHash !== shard.envelope.teaching.projectionHash
    )
  ) {
    return { content: unavailableContent(), infograph: null };
  }
  const entry = manifest.nodes.find((node) => node.canonicalId === shard.node.id);
  if (!entry) {
    return {
      content: {
        card: { state: 'missing', message: '当前节点暂无已发布学习卡片。' },
        infograph: { state: 'missing', message: '当前节点暂无可用信息图。' },
      },
      infograph: null,
    };
  }

  const card = (() => {
    if (entry.card.state === 'blocked') {
      return { state: 'blocked' as const, message: '该学习卡片仍在完善中。' };
    }
    if (entry.card.state !== 'available' || !entry.card.sha256) {
      return { state: 'missing' as const, message: '当前节点暂无已发布学习卡片。' };
    }
    const path = join(/*turbopackIgnore: true*/ paths.cardRoot, `${entry.safeId}.md`);
    if (!existsSync(/*turbopackIgnore: true*/ path)) return { state: 'unavailable' as const, message: '当前学习卡片暂时不可用。' };
    const raw = readFileSync(/*turbopackIgnore: true*/ path, 'utf8');
    if (sha256(raw) !== entry.card.sha256) {
      return { state: 'unavailable' as const, message: '当前学习卡片暂时不可用。' };
    }
    return cardContent(raw, shard.node.id)
      ?? { state: 'unavailable' as const, message: '当前学习卡片暂时不可用。' };
  })();

  const infograph = (() => {
    if (entry.infograph.state !== 'available' || !entry.infograph.sha256) {
      return { state: 'missing' as const, message: '当前节点暂无可用信息图。' };
    }
    const path = join(/*turbopackIgnore: true*/ paths.infographRoot, `${entry.safeId}.png`);
    if (!existsSync(/*turbopackIgnore: true*/ path)) return { state: 'unavailable' as const, message: '当前信息图暂时不可用。' };
    return {
      state: 'available' as const,
      alternativeText: `${shard.node.label} 信息图`,
    };
  })();

  return {
    content: { card, infograph },
    infograph: infograph.state === 'available' && entry.infograph.sha256
      ? { path: join(/*turbopackIgnore: true*/ paths.infographRoot, `${entry.safeId}.png`), sha256: entry.infograph.sha256 }
      : null,
  };
}

export function attachActiveAuthorityLearningContent(
  shard: AuthorityNodeDetailShard,
): AuthorityNodeDetailShard {
  const { content } = resolveNodeLearningContent(shard);
  return {
    ...shard,
    node: { ...shard.node, learningContent: content },
  };
}

export function readActiveAuthorityInfograph(
  shard: AuthorityNodeDetailShard,
): Buffer | null {
  const resolved = resolveNodeLearningContent(shard);
  if (!resolved.infograph) return null;
  try {
    const content = readFileSync(/*turbopackIgnore: true*/ resolved.infograph.path);
    return sha256(content) === resolved.infograph.sha256 ? content : null;
  } catch {
    return null;
  }
}

export function readPublishedLearnerCardByToken(
  token: string,
  sourcePath?: string | null,
): {
  summary: string;
  insight: string | null;
  explanation: string;
} | null {
  if (!isBindingContentToken(token)) return null;
  const repoRoot = process.cwd();
  const cardPath = firstExistingFile([
    join(/*turbopackIgnore: true*/ repoRoot, CARD_NODES_RELATIVE, `${token}.md`),
    join(/*turbopackIgnore: true*/ repoRoot, CARD_AUTHORITY_NODES_RELATIVE, `${token}.md`),
  ]);
  if (!cardPath) return null;
  const raw = readFileSync(/*turbopackIgnore: true*/ cardPath, 'utf8');
  const expectedHash = contentHashFromSourcePath(sourcePath);
  if (expectedHash && sha256(raw) !== expectedHash) return null;
  return parseLearnerVisibleCardFields(raw);
}

export function publishedInfographSafeIdForToken(token: string): string | null {
  if (!isBindingContentToken(token)) return null;
  const repoRoot = process.cwd();
  const infographPath = firstExistingFile([
    join(/*turbopackIgnore: true*/ repoRoot, INFOGRAPH_NODES_RELATIVE, `${token}.png`),
    join(/*turbopackIgnore: true*/ repoRoot, INFOGRAPH_AUTHORITY_NODES_RELATIVE, `${token}.png`),
  ]);
  return infographPath ? token : null;
}

export function readPublishedAuthorityInfographBySafeId(safeId: string): Buffer | null {
  if (!isBindingContentToken(safeId)) return null;
  const repoRoot = process.cwd();
  const infographPath = firstExistingFile([
    join(/*turbopackIgnore: true*/ repoRoot, INFOGRAPH_NODES_RELATIVE, `${safeId}.png`),
    join(/*turbopackIgnore: true*/ repoRoot, INFOGRAPH_AUTHORITY_NODES_RELATIVE, `${safeId}.png`),
  ]);
  if (!infographPath) return null;
  try {
    return readFileSync(/*turbopackIgnore: true*/ infographPath);
  } catch {
    return null;
  }
}

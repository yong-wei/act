/**
 * Knowledge card inventory (#1271).
 *
 * Enumerates active and legacy card files with card IDs, old graph IDs,
 * source hashes, review status, and usage references.
 */

import { createHash } from 'node:crypto';
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { join, relative } from 'node:path';

import { projectionDigest } from '../hash';
import {
  CARD_INVENTORY_CONTRACT,
  DEFAULT_CARD_AUTHORING_NODES_RELATIVE,
  DEFAULT_CARD_RUNTIME_NODES_RELATIVE,
  type CardReviewStatus,
  type KnowledgeCardInventory,
  type KnowledgeCardInventoryEntry,
} from './contracts';

export class CardInventoryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'CardInventoryError';
    this.code = code;
  }
}

export interface CardInventoryBuildOptions {
  repoRoot: string;
  authoringRevision: string;
  capturedAt?: string | null;
  authoringCardsRelative?: string;
  runtimeCardsRelative?: string;
  /**
   * Optional usage index: legacyNodeId / cardId → usage ref strings
   * (lesson sequences, steps, path readiness).
   */
  usageByCardId?: ReadonlyMap<string, readonly string[]>;
  /**
   * Optional review status map from semantic-shard / coverage reports.
   */
  reviewByCardId?: ReadonlyMap<string, CardReviewStatus>;
  /**
   * Synthetic entries for tests (skips filesystem scan when provided).
   */
  syntheticEntries?: readonly KnowledgeCardInventoryEntry[];
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function compareCodePoint(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function sortBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  return [...items].sort((a, b) => compareCodePoint(keyFn(a), keyFn(b)));
}

function listMarkdownFiles(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.md')) continue;
    const full = join(dir, name);
    if (statSync(full).isFile()) out.push(full);
  }
  return out.sort(compareCodePoint);
}

/**
 * Minimal YAML frontmatter parser for card files (key: value / lists).
 * Avoids a hard dependency on yaml for the migration inventory path.
 */
export function parseCardFrontmatter(text: string): Record<string, unknown> {
  if (!text.startsWith('---\n') && !text.startsWith('---\r\n')) {
    return {};
  }
  const end = text.indexOf('\n---', 4);
  if (end < 0) return {};
  const block = text.slice(4, end).replace(/\r\n/g, '\n');
  const result: Record<string, unknown> = {};
  let currentListKey: string | null = null;
  const listBuf: string[] = [];

  const flushList = () => {
    if (currentListKey) {
      result[currentListKey] = [...listBuf];
      listBuf.length = 0;
      currentListKey = null;
    }
  };

  for (const rawLine of block.split('\n')) {
    const line = rawLine.replace(/\t/g, '  ');
    const listMatch = line.match(/^\s*-\s+(.*)$/u);
    if (listMatch && currentListKey) {
      listBuf.push(listMatch[1]!.trim().replace(/^['"]|['"]$/g, ''));
      continue;
    }
    flushList();
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/u);
    if (!kv) continue;
    const key = kv[1]!;
    const value = kv[2]!.trim();
    if (value === '' || value === '|' || value === '>') {
      currentListKey = key;
      continue;
    }
    if (
      (value.startsWith('[') && value.endsWith(']'))
      || (value.startsWith('{') && value.endsWith('}'))
    ) {
      try {
        result[key] = JSON.parse(value.replace(/'/g, '"'));
      } catch {
        result[key] = value;
      }
      continue;
    }
    if (value === 'true') result[key] = true;
    else if (value === 'false') result[key] = false;
    else if (/^-?\d+$/u.test(value)) result[key] = Number(value);
    else result[key] = value.replace(/^['"]|['"]$/g, '');
  }
  flushList();
  return result;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => String(v ?? '').trim())
    .filter((v) => v.length > 0);
}

function resolveReviewStatus(
  cardId: string,
  reviewByCardId: ReadonlyMap<string, CardReviewStatus> | undefined,
  frontmatter: Record<string, unknown>,
): CardReviewStatus {
  const fromMap = reviewByCardId?.get(cardId);
  if (fromMap) return fromMap;
  const raw = String(frontmatter.review_status ?? frontmatter.reviewStatus ?? '')
    .trim()
    .toLowerCase();
  if (raw === 'reviewed' || raw === 'approved') return 'reviewed';
  if (raw === 'pending' || raw === 'draft') return 'pending';
  if (raw === 'excluded') return 'excluded';
  return 'unknown';
}

function entryFromFile(input: {
  absolutePath: string;
  repoRoot: string;
  isAuthoring: boolean;
  usageByCardId?: ReadonlyMap<string, readonly string[]>;
  reviewByCardId?: ReadonlyMap<string, CardReviewStatus>;
}): KnowledgeCardInventoryEntry {
  const raw = readFileSync(input.absolutePath, 'utf8');
  const frontmatter = parseCardFrontmatter(raw);
  const fileBase = input.absolutePath.split(/[/\\]/u).pop()?.replace(/\.md$/u, '') ?? '';
  const legacyNodeId = String(frontmatter.node_id ?? frontmatter.nodeId ?? fileBase).trim()
    || fileBase;
  const cardId = String(frontmatter.card_id ?? frontmatter.cardId ?? legacyNodeId).trim()
    || legacyNodeId;
  const title = String(frontmatter.name ?? frontmatter.title ?? '').trim() || null;
  const sourceHash = sha256(raw);
  const rel = relative(input.repoRoot, input.absolutePath).split('\\').join('/');
  const declaredCanonical = String(
    frontmatter.canonical_id ?? frontmatter.canonicalId ?? '',
  ).trim() || null;
  const cardVersionRaw = frontmatter.card_version ?? frontmatter.cardVersion;
  const cardVersion =
    typeof cardVersionRaw === 'number'
      ? cardVersionRaw
      : cardVersionRaw != null && String(cardVersionRaw).trim() !== ''
        ? Number(cardVersionRaw)
        : null;

  const usageRefs = [
    ...(input.usageByCardId?.get(cardId) ?? []),
    ...(input.usageByCardId?.get(legacyNodeId) ?? []),
  ];

  return {
    cardId,
    legacyNodeId,
    title,
    authoringPath: input.isAuthoring ? rel : null,
    runtimePath: input.isAuthoring ? null : rel,
    sourceHash,
    reviewStatus: resolveReviewStatus(cardId, input.reviewByCardId, frontmatter),
    cardVersion: Number.isFinite(cardVersion) ? (cardVersion as number) : null,
    lessonUnits: stringList(frontmatter.lesson_units ?? frontmatter.lessonUnits),
    tags: stringList(frontmatter.tags),
    declaredCanonicalId: declaredCanonical,
    usageRefs: [...new Set(usageRefs)].sort(compareCodePoint),
    legacyOnly: !input.isAuthoring,
  };
}

function mergeEntries(
  a: KnowledgeCardInventoryEntry,
  b: KnowledgeCardInventoryEntry,
): KnowledgeCardInventoryEntry {
  return {
    cardId: a.cardId || b.cardId,
    legacyNodeId: a.legacyNodeId || b.legacyNodeId,
    title: a.title ?? b.title,
    authoringPath: a.authoringPath ?? b.authoringPath,
    runtimePath: a.runtimePath ?? b.runtimePath,
    // Prefer authoring body hash when both exist.
    sourceHash: a.authoringPath ? a.sourceHash : b.sourceHash,
    reviewStatus:
      a.reviewStatus !== 'unknown' ? a.reviewStatus : b.reviewStatus,
    cardVersion: a.cardVersion ?? b.cardVersion,
    lessonUnits: [...new Set([...a.lessonUnits, ...b.lessonUnits])].sort(
      compareCodePoint,
    ),
    tags: [...new Set([...a.tags, ...b.tags])].sort(compareCodePoint),
    declaredCanonicalId: a.declaredCanonicalId ?? b.declaredCanonicalId,
    usageRefs: [...new Set([...a.usageRefs, ...b.usageRefs])].sort(
      compareCodePoint,
    ),
    legacyOnly: Boolean(a.legacyOnly && b.legacyOnly),
  };
}

/**
 * Build a deterministic inventory of knowledge card files.
 */
export function buildKnowledgeCardInventory(
  options: CardInventoryBuildOptions,
): KnowledgeCardInventory {
  if (!options.authoringRevision || !/^[0-9a-f]{40}$/u.test(options.authoringRevision)) {
    // Allow non-git fixture revisions that are non-empty (tests).
    if (!options.authoringRevision || options.authoringRevision.trim().length === 0) {
      throw new CardInventoryError(
        'schema-invalid',
        'authoringRevision is required',
      );
    }
  }

  let entries: KnowledgeCardInventoryEntry[];

  if (options.syntheticEntries) {
    entries = sortBy([...options.syntheticEntries], (e) => e.cardId);
  } else {
    const authoringDir = join(
      options.repoRoot,
      options.authoringCardsRelative ?? DEFAULT_CARD_AUTHORING_NODES_RELATIVE,
    );
    const runtimeDir = join(
      options.repoRoot,
      options.runtimeCardsRelative ?? DEFAULT_CARD_RUNTIME_NODES_RELATIVE,
    );

    const byKey = new Map<string, KnowledgeCardInventoryEntry>();

    for (const path of listMarkdownFiles(authoringDir)) {
      const entry = entryFromFile({
        absolutePath: path,
        repoRoot: options.repoRoot,
        isAuthoring: true,
        usageByCardId: options.usageByCardId,
        reviewByCardId: options.reviewByCardId,
      });
      const key = entry.cardId;
      const prev = byKey.get(key);
      byKey.set(key, prev ? mergeEntries(prev, entry) : entry);
    }

    for (const path of listMarkdownFiles(runtimeDir)) {
      const entry = entryFromFile({
        absolutePath: path,
        repoRoot: options.repoRoot,
        isAuthoring: false,
        usageByCardId: options.usageByCardId,
        reviewByCardId: options.reviewByCardId,
      });
      const key = entry.cardId;
      const prev = byKey.get(key);
      byKey.set(key, prev ? mergeEntries(prev, entry) : entry);
    }

    entries = sortBy([...byKey.values()], (e) => e.cardId);
  }

  const body = {
    contract: CARD_INVENTORY_CONTRACT,
    authoringRevision: options.authoringRevision,
    capturedAt: options.capturedAt ?? null,
    entryCount: entries.length,
    entries,
  };

  return {
    ...body,
    inventoryDigest: projectionDigest(body),
  };
}

/** Collect usage refs from lesson sequence card_order arrays. */
export function collectCardUsageFromSequence(
  sequence: unknown,
  lessonKey: string,
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (!sequence || typeof sequence !== 'object') return map;
  const rec = sequence as Record<string, unknown>;
  const order = Array.isArray(rec.card_order) ? rec.card_order : [];
  for (const id of order) {
    if (typeof id !== 'string' || !id.trim()) continue;
    const list = map.get(id) ?? [];
    list.push(`lesson-sequence:${lessonKey}:card_order`);
    map.set(id, list);
  }
  const groups = Array.isArray(rec.groups) ? rec.groups : [];
  for (const group of groups) {
    if (!group || typeof group !== 'object') continue;
    const g = group as Record<string, unknown>;
    const nodeIds = Array.isArray(g.node_ids) ? g.node_ids : [];
    const stepIds = Array.isArray(g.step_ids) ? g.step_ids : [];
    for (const id of nodeIds) {
      if (typeof id !== 'string' || !id.trim()) continue;
      const list = map.get(id) ?? [];
      for (const stepId of stepIds) {
        if (typeof stepId === 'string' && stepId.trim()) {
          list.push(`lesson-sequence:${lessonKey}:step:${stepId}`);
        }
      }
      list.push(`lesson-sequence:${lessonKey}:group`);
      map.set(id, list);
    }
  }
  return map;
}

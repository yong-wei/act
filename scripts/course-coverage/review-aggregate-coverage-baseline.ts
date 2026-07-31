#!/usr/bin/env tsx
/**
 * Issue #1126 — CourseCoverage generator / assembler (NOT a reviewer).
 *
 * Modes:
 *   --worklist-only
 *     Build a deterministic worklist for every current Projection member with
 *     exact Canonical profile fields + bounded repository evidence candidates.
 *     Retrieval ranks may order evidence; they NEVER choose a role.
 *
 *   --assemble --review-file <path>
 *     Validate a separately authored Grok review decision file against the
 *     worklist and write aggregate/active/automatic-control.json.
 *
 * No production path manufactures final roles and labels them agent-review.
 */
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  assembleCoverageFromReview,
  assertLatestAggregateAuthority,
  assertLatestAggregateProjectionIdentity,
  boundExcerpt,
  contentSha256,
  finalizeCoverageWorklist,
  selectCanonicalObjectMembership,
  type CoverageEvidenceCandidate,
  type CoverageReviewDecisionsDocument,
  type CoverageWorklistItem,
} from '../../src/lib/aggregate-governance';
import { createPrismaClient } from '../../src/lib/prisma-client';
import {
  includesTermBounded,
  normalizeEvidenceText,
  sortNames,
} from '../../src/lib/aggregate-governance/term-match';
import {
  AGGREGATE_COVERAGE_ACTIVE_PATH,
  AGGREGATE_COVERAGE_WORKLIST_PATH,
  loadProjectionNodes,
  type ProjectionNodeLike,
} from './aggregate-coverage';
import { loadAndValidatePublicBundleV1 } from '../actkg-release/public-bundle-v1';
import { resolveTrustedCaptureRevision } from '../actkg-release/capture-revision';

const DELTA_DEFAULT =
  'delta-receipt:340280e950af341d3c402c01f783d0ed1735335eb1b1da019002b9bf460214ef';
const RELEASE_SET_ID = 'actkg-authoritative-candidate-v3-r2';
const LEGACY_PROJECTION_PATH =
  'course-content/authoring/knowledge/releases/control-theory-engineering-v0.3-r2/control-theory-engineering-v0.3.act-projection.json';
const LEGACY_RELEASE_PATH =
  'course-content/authoring/knowledge/releases/control-theory-engineering-v0.3-r2/control-theory-engineering-v0.3.release.json';
const R3_AUTHORITY_SCHEMA = 'issue1117_v08r3_23b7e94';
const COURSE_COVERAGE_EVIDENCE_CAPTURE_PATHS = [
  'scripts/course-coverage/review-aggregate-coverage-baseline.ts',
  'course-content/authoring/knowledge/canonical-nodes.json',
  'course-content/syllabus-refactor/blueprint.md',
  'course-content/syllabus-refactor/main.md',
  'course-content/authoring/lessons',
  'course-content/authoring/knowledge/cards',
] as const;

interface CoverageReleaseIdentity {
  releaseSetId: string;
  releaseId: string;
  releaseHash: string;
  sourceDatasetHash: string | null;
}

interface CoverageInputConfig extends CoverageReleaseIdentity {
  projectionPath: string;
  releasePath: string;
}

interface CoverageArtifactMetadata {
  projection: {
    source_release?: string;
    source_release_hash?: string;
    source_dataset_hash?: string | null;
  };
  release: {
    id?: string;
    release_version?: string;
    release_hash?: string;
    source_dataset_hash?: string | null;
  };
}

const EXCERPT_LIMIT = 480;
const MAX_EVIDENCE_PER_ITEM = 12;

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

interface RepoEvidenceSource {
  path: string;
  selector: string;
  kind: CoverageEvidenceCandidate['kind'];
  weight: number;
  term: string;
  sourceHash: string;
  excerpt: string;
}

async function collectMarkdownSnippets(
  root: string,
  relativeDir: string,
  authoringRevision: string,
  limitFiles = 200,
): Promise<Array<{ ref: string; text: string; sourceHash: string }>> {
  const collected: Array<{ ref: string; text: string; sourceHash: string }> = [];
  for (const ref of trackedFilesUnder(root, relativeDir, authoringRevision)) {
    if (!/\.(md|mdx)$/iu.test(ref)) continue;
    try {
      const text = readGitFile(root, authoringRevision, ref);
      collected.push({
        ref,
        text: text.slice(0, 8000),
        sourceHash: contentSha256(text),
      });
    } catch {
      // skip unreadable
    }
  }
  collected.sort((a, b) => a.ref.localeCompare(b.ref, 'en'));
  return collected.slice(0, limitFiles);
}

function trackedFilesUnder(root: string, relativePath: string, revision: string): string[] {
  const result = spawnSync(
    'git',
    ['ls-tree', '-r', '-z', '--name-only', revision, '--', relativePath],
    { cwd: root, encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(`Aggregate coverage evidence capture rejected: cannot enumerate ${relativePath}`);
  }
  return (result.stdout ?? '')
    .split('\u0000')
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'en'));
}

function readGitFile(root: string, revision: string, relativePath: string): string {
  const result = spawnSync(
    'git',
    ['show', `${revision}:${relativePath}`],
    { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    throw new Error(`Aggregate coverage evidence capture rejected: cannot read ${relativePath} from ${revision}`);
  }
  return result.stdout ?? '';
}

function extractChineseTerms(text: string, minLen = 2, maxLen = 12): string[] {
  const matches = text.match(/[\u4e00-\u9fff]{2,12}/gu) ?? [];
  const stop = new Set([
    '我们', '可以', '一个', '这个', '那个', '以及', '或者', '因为', '所以',
    '通过', '进行', '关于', '如果', '但是', '不是', '已经', '之后', '之前',
    '课程', '学生', '教师', '本节', '本节课', '目标', '内容', '总结',
    '如下', '如图', '例如', '其中', '同时', '因此', '然后', '需要',
  ]);
  return sortNames([...new Set(
    matches
      .map((term) => term.trim())
      .filter((term) => term.length >= minLen && term.length <= maxLen && !stop.has(term)),
  )]);
}

async function buildRepoEvidenceSources(
  root: string,
  authoringRevision: string,
): Promise<RepoEvidenceSource[]> {
  const sources: RepoEvidenceSource[] = [];

  try {
    const nodesPath = 'course-content/authoring/knowledge/canonical-nodes.json';
    const raw = readGitFile(root, authoringRevision, nodesPath);
    const sourceHash = contentSha256(raw);
    const nodesDoc = JSON.parse(raw) as {
      nodes?: Array<{
        canonical_node_id?: string;
        canonical_name?: string;
        aliases?: string[];
        owner_lesson?: string;
      }>;
    };
    const nodes = [...(nodesDoc.nodes ?? [])].sort((a, b) => (
      String(a.canonical_node_id ?? a.canonical_name ?? '')
        .localeCompare(String(b.canonical_node_id ?? b.canonical_name ?? ''), 'en')
    ));
    for (const node of nodes) {
      const name = node.canonical_name?.trim();
      if (name) {
        const excerpt = boundExcerpt(
          [
            name,
            node.canonical_node_id ? `id=${node.canonical_node_id}` : '',
            node.owner_lesson ? `lesson=${node.owner_lesson}` : '',
            ...(node.aliases ?? []).slice(0, 6),
          ].filter(Boolean).join(' | '),
          EXCERPT_LIMIT,
        );
        sources.push({
          path: nodesPath,
          selector: `node:${node.canonical_node_id ?? name}`,
          kind: 'canonical_node',
          weight: 3,
          term: name,
          sourceHash,
          excerpt,
        });
      }
      for (const alias of sortNames(node.aliases ?? [])) {
        const a = alias.trim();
        if (!a) continue;
        sources.push({
          path: nodesPath,
          selector: `alias:${node.canonical_node_id ?? name}:${a}`,
          kind: 'canonical_node',
          weight: 2.5,
          term: a,
          sourceHash,
          excerpt: boundExcerpt(a, EXCERPT_LIMIT),
        });
      }
    }
  } catch {
    // optional
  }

  for (const rel of sortNames([
    'course-content/syllabus-refactor/blueprint.md',
    'course-content/syllabus-refactor/main.md',
  ])) {
    try {
      const text = readGitFile(root, authoringRevision, rel);
      const sourceHash = contentSha256(text);
      for (const term of extractChineseTerms(text)) {
        if (term.length < 3) continue;
        const idx = text.indexOf(term);
        const start = Math.max(0, idx - 40);
        const excerpt = boundExcerpt(text.slice(start, start + EXCERPT_LIMIT), EXCERPT_LIMIT);
        sources.push({
          path: rel,
          selector: `cjk-term:${term}`,
          kind: 'syllabus',
          weight: 1.2,
          term,
          sourceHash,
          excerpt,
        });
      }
      for (const term of sortNames([
        'bode', 'nyquist', 'root locus', 'transfer function', 'pid',
        'stability', 'feedback', 'state space', 'frequency response',
      ])) {
        const lower = text.toLowerCase();
        const idx = lower.indexOf(term);
        if (idx < 0) continue;
        const start = Math.max(0, idx - 40);
        sources.push({
          path: rel,
          selector: `en-term:${term}`,
          kind: 'syllabus',
          weight: 1.5,
          term,
          sourceHash,
          excerpt: boundExcerpt(text.slice(start, start + EXCERPT_LIMIT), EXCERPT_LIMIT),
        });
      }
    } catch {
      // optional
    }
  }

  const lessonFiles = await collectMarkdownSnippets(
    root,
    'course-content/authoring/lessons',
    authoringRevision,
    120,
  );
  for (const file of lessonFiles) {
    const titleMatch = file.text.match(/^#\s+(.+)$/mu);
    if (titleMatch?.[1]) {
      for (const term of extractChineseTerms(titleMatch[1].trim())) {
        sources.push({
          path: file.ref,
          selector: `title:${term}`,
          kind: 'lesson',
          weight: 2,
          term,
          sourceHash: file.sourceHash,
          excerpt: boundExcerpt(titleMatch[1].trim(), EXCERPT_LIMIT),
        });
      }
    }
    const headings = file.text.match(/^#{1,3}\s+.+$/gmu) ?? [];
    for (const heading of headings.slice(0, 12)) {
      for (const term of extractChineseTerms(heading)) {
        if (term.length < 3) continue;
        sources.push({
          path: file.ref,
          selector: `heading:${term}`,
          kind: 'lesson',
          weight: 1.4,
          term,
          sourceHash: file.sourceHash,
          excerpt: boundExcerpt(heading, EXCERPT_LIMIT),
        });
      }
    }
  }

  try {
    const cardRoot = 'course-content/authoring/knowledge/cards';
    const orderedCards = trackedFilesUnder(root, cardRoot, authoringRevision)
      .filter((ref) => path.posix.dirname(ref) === cardRoot)
      .slice(0, 400);
    for (const rel of orderedCards) {
      const fileName = path.posix.basename(rel);
      let text = fileName;
      let sourceHash = contentSha256(fileName);
      try {
        text = readGitFile(root, authoringRevision, rel);
        sourceHash = contentSha256(text);
      } catch {
        // name-only fallback
      }
      const base = fileName.replace(/\.(md|mdx|json)$/iu, '');
      for (const term of extractChineseTerms(base)) {
        sources.push({
          path: rel,
          selector: `name:${term}`,
          kind: 'card',
          weight: 1.6,
          term,
          sourceHash,
          excerpt: boundExcerpt(text, EXCERPT_LIMIT),
        });
      }
    }
  } catch {
    // optional
  }

  // Topic lexicon: retrieval aid only. rank/weight never becomes a role.
  for (const term of sortNames([
    '根轨迹', '劳斯', '奈奎斯特', '伯德', 'bode', 'nyquist',
    '稳定性', '传递函数', 'transfer function', '反馈', 'pid',
    '频域', '时域', '状态空间', 'state space', 'state variable', '状态变量',
    '开环', '闭环', '相位裕度', '幅值裕度', 'phase margin', 'gain margin',
    '稳态误差', '超调', '阻尼', '自然频率', '极点', '零点',
    '控制系统', '动态系统', '建模', '频率响应', '根轨迹法', 'root locus',
    'stability', 'feedback', '前向通路', '微分方程', '方框图', '信号流图',
    '校正', '超前', '滞后', '主导极点', '一阶系统', '二阶系统',
    'block diagram', 'signal flow', 'steady state', 'overshoot', 'damping',
    'open loop', 'closed loop', 'routh', 'hurwitz', 'compensator', 'lead lag',
  ])) {
    sources.push({
      path: 'topic-lexicon',
      selector: `topic:${term}`,
      kind: 'topic_retrieval',
      weight: 1.5,
      term,
      sourceHash: contentSha256(`topic-lexicon:${term}`),
      excerpt: term,
    });
  }

  // Deterministic unique by path+selector+term.
  const seen = new Set<string>();
  const unique: RepoEvidenceSource[] = [];
  for (const row of sources.sort((a, b) => (
    a.path.localeCompare(b.path, 'en')
    || a.selector.localeCompare(b.selector, 'en')
    || a.term.localeCompare(b.term, 'en')
  ))) {
    const key = `${row.path}\u001f${row.selector}\u001f${row.term}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  return unique;
}

function buildWorklistItem(input: {
  canonicalId: string;
  node: ProjectionNodeLike | undefined;
  sources: readonly RepoEvidenceSource[];
}): CoverageWorklistItem {
  const description = input.node?.description == null ? null : String(input.node.description);
  const displayName = input.node?.display_name ?? input.node?.displayName ?? null;
  const semanticName = input.node?.semantic_name ?? input.node?.semanticName ?? null;
  const conceptKind = input.node?.concept_kind ?? input.node?.conceptKind ?? null;
  const entityType = input.node?.entity_type ?? input.node?.entityType ?? null;

  const profile = {
    entityType: entityType == null ? null : String(entityType),
    conceptKind: conceptKind == null ? null : String(conceptKind),
    semanticName: semanticName == null ? null : String(semanticName),
    displayName: displayName == null ? null : String(displayName),
    description,
  };

  const fields = [
    normalizeEvidenceText(description ?? ''),
    normalizeEvidenceText(String(displayName ?? '')),
    normalizeEvidenceText(String(semanticName ?? '')),
  ].filter(Boolean);
  const profileBlob = fields.join(' ');

  const profileExcerpt = boundExcerpt(
    [
      `canonicalId=${input.canonicalId}`,
      profile.entityType ? `type=${profile.entityType}` : '',
      profile.conceptKind ? `kind=${profile.conceptKind}` : '',
      profile.semanticName ? `semantic=${profile.semanticName}` : '',
      profile.displayName ? `display=${profile.displayName}` : '',
      profile.description ? `description=${profile.description}` : '',
    ].filter(Boolean).join('\n'),
    EXCERPT_LIMIT,
  );
  const profileHash = contentSha256(profileExcerpt);

  const evidenceCandidates: CoverageEvidenceCandidate[] = [{
    evidenceId: contentSha256(`profile:${input.canonicalId}`).slice(0, 32),
    path: 'canonical-profile',
    selector: `canonicalId:${input.canonicalId}`,
    sourceHash: profileHash,
    kind: 'profile',
    rank: 0,
    weight: 0,
    excerpt: profileExcerpt,
    excerptHash: contentSha256(profileExcerpt),
  }];

  const hits: Array<RepoEvidenceSource & { fieldBoost: number }> = [];
  for (const source of input.sources) {
    const termNorm = normalizeEvidenceText(source.term);
    if (!termNorm || termNorm.length < 2) continue;
    if (!profileBlob || !includesTermBounded(profileBlob, termNorm)) continue;
    // Prefer description matches for ranking only.
    const inDescription = description
      ? includesTermBounded(normalizeEvidenceText(description), termNorm)
      : false;
    hits.push({
      ...source,
      fieldBoost: inDescription ? 1.4 : 1,
    });
  }

  hits.sort((a, b) => (
    (b.weight * b.fieldBoost) - (a.weight * a.fieldBoost)
    || a.path.localeCompare(b.path, 'en')
    || a.selector.localeCompare(b.selector, 'en')
  ));

  let rank = 1;
  for (const hit of hits.slice(0, MAX_EVIDENCE_PER_ITEM - 1)) {
    const evidenceId = contentSha256(
      `${input.canonicalId}|${hit.path}|${hit.selector}|${hit.sourceHash}`,
    ).slice(0, 32);
    evidenceCandidates.push({
      evidenceId,
      path: hit.path,
      selector: hit.selector,
      sourceHash: hit.sourceHash,
      kind: hit.kind,
      rank,
      weight: hit.weight * hit.fieldBoost,
      excerpt: hit.excerpt,
      excerptHash: contentSha256(hit.excerpt),
    });
    rank += 1;
  }

  const retrievalHints = hits
    .filter((hit) => hit.kind === 'topic_retrieval')
    .slice(0, 8)
    .map((hit, index) => ({ term: hit.term, rank: index }));

  // itemInputDigest filled by finalizeCoverageWorklist
  return {
    canonicalId: input.canonicalId,
    profile,
    evidenceCandidates,
    retrievalHints,
    itemInputDigest: '',
  };
}

async function writeJson(root: string, relative: string, value: unknown): Promise<void> {
  const abs = path.join(root, relative);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function requireSha256(value: string, field: string): string {
  if (!/^[a-f0-9]{64}$/u.test(value)) {
    throw new Error(`${field} must be a 64-hex SHA-256`);
  }
  return value;
}

function requireNonEmpty(value: string | undefined, field: string): string {
  const normalized = value?.trim() ?? '';
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function isDynamicRequest(): boolean {
  return [
    '--lock',
    '--projection',
    '--release',
    '--release-set-id',
    '--release-id',
    '--release-hash',
    '--source-dataset-hash',
    '--delta-receipt-id',
    '--db-schema',
  ].some((flag) => hasFlag(flag));
}

function assertRelativeInputPath(value: string, field: string): string {
  if (
    path.isAbsolute(value)
    || value.includes('\\')
    || value.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    throw new Error(`${field} must be a confined repository-relative path`);
  }
  return value;
}

function assertRequestedPath(
  field: string,
  requested: string | undefined,
  expected: string,
): void {
  if (requested == null) return;
  if (assertRelativeInputPath(requested, field) !== expected) {
    throw new Error(
      `Aggregate coverage rejected: ${field} is not the lock-controlled path`,
    );
  }
}

async function readCoverageArtifactMetadata(
  root: string,
  projectionPath: string,
  releasePath: string,
): Promise<CoverageArtifactMetadata> {
  return {
    projection: JSON.parse(
      await readFile(path.join(root, projectionPath), 'utf8'),
    ) as CoverageArtifactMetadata['projection'],
    release: JSON.parse(
      await readFile(path.join(root, releasePath), 'utf8'),
    ) as CoverageArtifactMetadata['release'],
  };
}

function assertCoverageArtifactIdentity(
  metadata: CoverageArtifactMetadata,
  expected: CoverageReleaseIdentity,
): void {
  if (metadata.projection.source_release && metadata.projection.source_release !== expected.releaseId) {
    throw new Error(
      `Aggregate coverage rejected: projection source_release ${metadata.projection.source_release}`
      + ` does not match releaseId ${expected.releaseId}`,
    );
  }
  if (metadata.release.id && metadata.release.id !== expected.releaseId) {
    throw new Error(
      `Aggregate coverage rejected: release id ${metadata.release.id}`
      + ` does not match releaseId ${expected.releaseId}`,
    );
  }
  if (metadata.release.release_version && metadata.release.release_version !== expected.releaseVersion) {
    throw new Error(
      `Aggregate coverage rejected: release version ${metadata.release.release_version}`
      + ` does not match releaseVersion ${expected.releaseVersion}`,
    );
  }
  if (metadata.release.release_hash && metadata.release.release_hash !== expected.releaseHash) {
    throw new Error(
      'Aggregate coverage rejected: release.release_hash does not match releaseHash',
    );
  }
  if (metadata.projection.source_release_hash && metadata.projection.source_release_hash !== expected.releaseHash) {
    throw new Error(
      'Aggregate coverage rejected: projection source_release_hash does not match releaseHash',
    );
  }
  if (
    metadata.projection.source_dataset_hash
    && metadata.projection.source_dataset_hash !== expected.sourceDatasetHash
  ) {
    throw new Error(
      'Aggregate coverage rejected: projection source_dataset_hash does not match sourceDatasetHash',
    );
  }
  if (
    metadata.release.source_dataset_hash
    && metadata.release.source_dataset_hash !== expected.sourceDatasetHash
  ) {
    throw new Error(
      'Aggregate coverage rejected: release.source_dataset_hash does not match sourceDatasetHash',
    );
  }
}

function authorityDatabaseUrl(): string {
  const requestedSchema = argValue('--db-schema');
  if (requestedSchema != null && requestedSchema !== R3_AUTHORITY_SCHEMA) {
    throw new Error(
      `Latest Aggregate authority rejected: --db-schema must be ${R3_AUTHORITY_SCHEMA}`,
    );
  }
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    throw new Error('Latest Aggregate authority rejected: DATABASE_URL is required');
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Latest Aggregate authority rejected: DATABASE_URL is invalid');
  }
  parsed.searchParams.set('schema', R3_AUTHORITY_SCHEMA);
  parsed.searchParams.set('options', `-c search_path=${R3_AUTHORITY_SCHEMA},public`);
  return parsed.toString();
}

function requireDatabaseRow<T>(value: T | null, label: string): T {
  if (value == null) {
    throw new Error(`Latest Aggregate authority database lookup failed: ${label} is missing`);
  }
  return value;
}

async function loadDynamicDatabaseAuthority(
  lock: Parameters<typeof assertLatestAggregateAuthority>[0]['lock'],
  deltaReceiptId: string,
  expectedCaptureRevision: string,
): Promise<void> {
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = authorityDatabaseUrl();
  let db: ReturnType<typeof createPrismaClient> | null = null;
  try {
    db = createPrismaClient();
    await db.$transaction(async (tx) => {
      const releaseSet = await tx.actkgReleaseSet.findUnique({
        where: { id: lock.releaseSetId },
      });
      const release = await tx.actkgRelease.findUnique({
        where: { id: lock.releaseId },
      });
      const importReceipt = await tx.actkgImportReceipt.findUnique({
        where: { releaseId: lock.releaseId },
      });
      const bundleReceipt = await tx.actkgBundleReceipt.findUnique({
        where: { bundleDigest: lock.bundleDigest },
      });
      const projectionIdentity = await tx.actkgProjectionIdentity.findUnique({
        where: {
          releaseId_projectionId: {
            releaseId: lock.releaseId,
            projectionId: lock.projectionId,
          },
        },
      });
      const delta = await tx.actkgReleaseSetDeltaReceipt.findUnique({
        where: { id: deltaReceiptId },
      });

      const releaseSetRow = requireDatabaseRow(releaseSet, 'ReleaseSet');
      const releaseRow = requireDatabaseRow(release, 'Release');
      const importRow = requireDatabaseRow(importReceipt, 'ImportReceipt');
      const bundleRow = requireDatabaseRow(bundleReceipt, 'BundleReceipt');
      const projectionIdentityRow = requireDatabaseRow(
        projectionIdentity,
        'ProjectionIdentity',
      );
      const deltaRow = requireDatabaseRow(delta, 'Delta receipt');

      assertLatestAggregateProjectionIdentity(
        {
          releaseId: projectionIdentityRow.releaseId,
          projectionId: projectionIdentityRow.projectionId,
          versionDigest: projectionIdentityRow.versionDigest,
          sourceRelease: projectionIdentityRow.sourceRelease,
          sourceReleaseHash: projectionIdentityRow.sourceReleaseHash,
          sourceDatasetHash: projectionIdentityRow.sourceDatasetHash,
        },
        lock,
        bundleRow,
      );

      assertLatestAggregateAuthority({
        lock,
        expectedDeltaReceiptId: deltaReceiptId,
        expectedCaptureRevision,
        releaseSet: {
          id: releaseSetRow.id,
          controlledPath: releaseSetRow.controlledPath,
          lockVersion: releaseSetRow.lockVersion,
          candidateState: releaseSetRow.candidateState,
        },
        release: {
          id: releaseRow.id,
          releaseSetId: releaseRow.releaseSetId,
          releaseVersion: releaseRow.releaseVersion,
          releaseHash: releaseRow.releaseHash,
          sourceDatasetHash: releaseRow.sourceDatasetHash,
          captureRevision: releaseRow.captureRevision,
          lockRawHash: releaseRow.lockRawHash,
          projectionId: releaseRow.projectionId,
          projectionDigest: releaseRow.projectionDigest,
        },
        importReceipt: {
          id: importRow.id,
          releaseSetId: importRow.releaseSetId,
          releaseId: importRow.releaseId,
          candidateState: importRow.candidateState,
          captureRevision: importRow.captureRevision,
          lockRawHash: importRow.lockRawHash,
          bundleId: importRow.bundleId,
          bundleDigest: importRow.bundleDigest,
          projectionId: importRow.projectionId,
          projectionDigest: importRow.projectionDigest,
        },
        bundleReceipt: {
          id: bundleRow.id,
          bundleId: bundleRow.bundleId,
          bundleRevision: bundleRow.bundleRevision,
          bundleDigest: bundleRow.bundleDigest,
          runtimeProjectionId: bundleRow.runtimeProjectionId,
          runtimeProjectionDigest: bundleRow.runtimeProjectionDigest,
          candidateState: bundleRow.candidateState,
          releaseSetId: bundleRow.releaseSetId,
          releaseId: bundleRow.releaseId,
          releaseHash: bundleRow.releaseHash,
          sourceDatasetHash: bundleRow.sourceDatasetHash,
          controlledPath: bundleRow.controlledPath,
          lockVersion: bundleRow.lockVersion,
          lockPath: bundleRow.lockPath,
          lockRawSha256: bundleRow.lockRawSha256,
          captureRevision: bundleRow.captureRevision,
        },
        delta: {
          id: deltaRow.id,
          authorizationState: deltaRow.authorizationState,
          candidateEvidenceKind: deltaRow.candidateEvidenceKind,
          candidateReleaseSetId: deltaRow.candidateReleaseSetId,
          candidateReleaseId: deltaRow.candidateReleaseId,
          candidateReleaseVersion: deltaRow.candidateReleaseVersion,
          candidateReleaseHash: deltaRow.candidateReleaseHash,
          candidateSourceDatasetHash: deltaRow.candidateSourceDatasetHash,
          candidateImportReceiptId: deltaRow.candidateImportReceiptId,
          candidateBundleReceiptId: deltaRow.candidateBundleReceiptId,
          candidateBundleId: deltaRow.candidateBundleId,
          candidateBundleDigest: deltaRow.candidateBundleDigest,
          candidateEvidenceCaptureRevision: deltaRow.candidateEvidenceCaptureRevision,
          identityViolations: deltaRow.identityViolations,
        },
      });
    }, { isolationLevel: 'RepeatableRead' });
  } catch (error) {
    if (
      error instanceof Error
      && (
        error.message.startsWith('Latest Aggregate authority rejected:')
        || error.message.startsWith('Latest Aggregate authority database lookup failed:')
      )
    ) {
      throw error;
    }
    // Do not echo adapter errors: some drivers include the connection string.
    throw new Error('Latest Aggregate authority database lookup failed');
  } finally {
    await db?.$disconnect().catch(() => undefined);
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  }
}

async function resolveLegacyInputConfig(root: string): Promise<CoverageInputConfig> {
  const projectionPath = LEGACY_PROJECTION_PATH;
  const releasePath = LEGACY_RELEASE_PATH;
  const metadata = await readCoverageArtifactMetadata(root, projectionPath, releasePath);
  const releaseSetId = RELEASE_SET_ID;
  const releaseId = requireNonEmpty(metadata.release.id ?? metadata.projection.source_release, 'release.id');
  const releaseHash = requireSha256(
    requireNonEmpty(metadata.release.release_hash, 'release.release_hash'),
    'release.release_hash',
  );
  const sourceDatasetHash = metadata.release.source_dataset_hash
    ?? metadata.projection.source_dataset_hash
    ?? null;
  if (sourceDatasetHash != null) requireSha256(sourceDatasetHash, 'sourceDatasetHash');
  assertCoverageArtifactIdentity(metadata, {
    releaseSetId,
    releaseId,
    releaseVersion: metadata.release.release_version ?? '',
    releaseHash,
    sourceDatasetHash,
  });
  return {
    releaseSetId,
    releaseId,
    releaseHash,
    sourceDatasetHash,
    projectionPath,
    releasePath,
  };
}

async function resolveDynamicInputConfig(
  root: string,
  authoringRevision: string,
  deltaReceiptId: string,
): Promise<CoverageInputConfig> {
  const lockPath = assertRelativeInputPath(
    requireNonEmpty(argValue('--lock'), '--lock'),
    '--lock',
  );
  const validated = await loadAndValidatePublicBundleV1({
    root,
    gitRoot: root,
    lockPath,
    allowCandidateBundle: true,
    captureRevision: authoringRevision,
  });
  const expected: CoverageReleaseIdentity = {
    releaseSetId: validated.releaseSetIdentity.releaseSetId,
    releaseId: validated.releaseIdentity.releaseId,
    releaseVersion: validated.releaseIdentity.releaseVersion,
    releaseHash: validated.releaseIdentity.releaseHash,
    sourceDatasetHash: validated.releaseIdentity.sourceDatasetHash,
  };

  const lockedProjectionPath = path.join(
    validated.bundleIdentity.controlledPath,
    validated.selectedRuntimeProjection.identity.artifactPath,
  );
  const releaseArtifact = validated.rawArtifacts.find(
    (artifact) => artifact.descriptor.role === 'release',
  );
  if (!releaseArtifact) {
    throw new Error('Aggregate coverage rejected: lock-controlled Bundle has no release artifact');
  }
  const lockedReleasePath = path.join(
    validated.bundleIdentity.controlledPath,
    releaseArtifact.descriptor.path,
  );
  assertRequestedPath('--projection', argValue('--projection'), lockedProjectionPath);
  assertRequestedPath('--release', argValue('--release'), lockedReleasePath);
  for (const [flag, value, expectedValue] of [
    ['--release-set-id', argValue('--release-set-id'), expected.releaseSetId],
    ['--release-id', argValue('--release-id'), expected.releaseId],
    ['--release-hash', argValue('--release-hash'), expected.releaseHash],
    ['--source-dataset-hash', argValue('--source-dataset-hash'), expected.sourceDatasetHash],
  ] as const) {
    if (value != null && value !== expectedValue) {
      throw new Error(`Aggregate coverage rejected: ${flag} disagrees with the lock`);
    }
  }

  await loadDynamicDatabaseAuthority(
    {
      lockPath,
      lockRawSha256: validated.releaseSetIdentity.lockRawSha256,
      releaseSetId: expected.releaseSetId,
      releaseId: expected.releaseId,
      releaseVersion: expected.releaseVersion,
      releaseHash: expected.releaseHash,
      sourceDatasetHash: expected.sourceDatasetHash,
      bundleControlledPath: validated.bundleIdentity.controlledPath,
      bundleId: validated.bundleIdentity.bundleId,
      bundleRevision: validated.bundleIdentity.bundleRevision,
      bundleDigest: validated.bundleIdentity.bundleDigest,
      projectionId: validated.selectedRuntimeProjection.identity.projectionId,
      projectionDigest: validated.selectedRuntimeProjection.identity.versionDigest,
    },
    deltaReceiptId,
    authoringRevision,
  );

  const metadata = await readCoverageArtifactMetadata(root, lockedProjectionPath, lockedReleasePath);
  assertCoverageArtifactIdentity(metadata, expected);
  return {
    ...expected,
    projectionPath: lockedProjectionPath,
    releasePath: lockedReleasePath,
  };
}

async function resolveInputConfig(
  root: string,
  authoringRevision: string,
  deltaReceiptId: string,
): Promise<CoverageInputConfig> {
  return isDynamicRequest()
    ? resolveDynamicInputConfig(root, authoringRevision, deltaReceiptId)
    : resolveLegacyInputConfig(root);
}

async function generateWorklist(root: string, authoringRevision: string, deltaReceiptId: string) {
  resolveTrustedCaptureRevision({
    gitRoot: root,
    trackedPaths: [...COURSE_COVERAGE_EVIDENCE_CAPTURE_PATHS],
    expectedCaptureRevision: authoringRevision,
    fail(message): never {
      throw new Error(`Aggregate coverage evidence capture rejected: ${message}`);
    },
  });
  const input = await resolveInputConfig(root, authoringRevision, deltaReceiptId);
  const { projectionPath, releasePath } = input;

  const nodesRaw = await loadProjectionNodes(root, projectionPath);
  const byId = new Map<string, ProjectionNodeLike>();
  for (const node of nodesRaw) {
    const id = node.entity_id ?? node.entityId;
    if (id) byId.set(id, node);
  }
  const release = JSON.parse(await readFile(path.join(root, releasePath), 'utf8')) as {
    entries?: Array<{ entity?: string; entity_role?: string; entityRole?: string }>;
  };
  const membership = selectCanonicalObjectMembership({
    projectionNodes: nodesRaw.map((node) => ({
      entityId: String(node.entity_id ?? node.entityId ?? ''),
    })),
    releaseEntries: (release.entries ?? []).map((row) => ({
      entityId: String(row.entity ?? ''),
      entityRole: row.entity_role ?? row.entityRole ?? null,
    })),
  });

  const sources = await buildRepoEvidenceSources(root, authoringRevision);
  const items = membership.canonicalIds.map((canonicalId) => buildWorklistItem({
    canonicalId,
    node: byId.get(canonicalId),
    sources,
  }));

  const worklist = finalizeCoverageWorklist({
    schemaVersion: 'course-coverage-worklist/v1',
    generatorVersion: 'course-coverage-worklist-generator/v1',
    deltaReceiptId,
    authoringRevision,
    releaseSetId: input.releaseSetId,
    releaseId: input.releaseId,
    releaseHash: input.releaseHash,
    sourceDatasetHash: input.sourceDatasetHash,
    membershipCount: items.length,
    items,
  });

  const outRel = argValue('--worklist-out') ?? AGGREGATE_COVERAGE_WORKLIST_PATH;
  await writeJson(root, outRel, worklist);

  return {
    path: outRel,
    membership: membership.canonicalIds.length,
    itemCount: worklist.items.length,
    inputDigest: worklist.inputDigest,
    evidenceSourceCount: sources.length,
    releaseSetId: input.releaseSetId,
    releaseId: input.releaseId,
    releaseHash: input.releaseHash,
    sourceDatasetHash: input.sourceDatasetHash,
    projectionPath,
    releasePath,
    bytes: Buffer.byteLength(JSON.stringify(worklist, null, 2) + '\n', 'utf8'),
  };
}

async function assemble(
  root: string,
  reviewFile: string,
  worklistPath: string,
): Promise<{ activePath: string; entryCount: number; sourceHash: string }> {
  const worklist = JSON.parse(await readFile(path.join(root, worklistPath), 'utf8'));
  const review = JSON.parse(
    await readFile(path.isAbsolute(reviewFile) ? reviewFile : path.join(root, reviewFile), 'utf8'),
  ) as CoverageReviewDecisionsDocument;

  const overlay = assembleCoverageFromReview({ worklist, review });
  await writeJson(root, AGGREGATE_COVERAGE_ACTIVE_PATH, overlay);
  return {
    activePath: AGGREGATE_COVERAGE_ACTIVE_PATH,
    entryCount: overlay.entries.length,
    sourceHash: overlay.sourceHash,
  };
}

async function main(): Promise<void> {
  const root = process.cwd();
  const dynamicRequest = isDynamicRequest();
  const deltaReceiptId = dynamicRequest
    ? requireNonEmpty(argValue('--delta-receipt-id'), '--delta-receipt-id')
    : (argValue('--delta-receipt-id') ?? DELTA_DEFAULT);
  const authoringRevision = argValue('--authoring-revision');
  if (!authoringRevision || !/^[a-f0-9]{40}$/u.test(authoringRevision)) {
    throw new Error('--authoring-revision <40-hex> is required');
  }

  const worklistOnly = hasFlag('--worklist-only');
  const doAssemble = hasFlag('--assemble');
  const reviewFile = argValue('--review-file');
  const worklistPath = argValue('--worklist') ?? AGGREGATE_COVERAGE_WORKLIST_PATH;

  if (worklistOnly && doAssemble) {
    throw new Error('Use either --worklist-only or --assemble, not both');
  }
  if (!worklistOnly && !doAssemble) {
    throw new Error('Specify --worklist-only or --assemble --review-file <path>');
  }
  if (doAssemble && !reviewFile) {
    throw new Error('--assemble requires --review-file <path>');
  }

  if (worklistOnly) {
    const result = await generateWorklist(root, authoringRevision, deltaReceiptId);
    console.log(JSON.stringify({
      mode: 'worklist-only',
      generator: true,
      manufacturesRoles: false,
      ...result,
      authoringRevision,
      deltaReceiptId,
      pendingReviewPath:
        'course-content/authoring/knowledge/course-coverage/aggregate/reviews/pending/course-coverage-review-decisions.json',
    }, null, 2));
    return;
  }

  const result = await assemble(root, reviewFile!, worklistPath);
  console.log(JSON.stringify({
    mode: 'assemble',
    ...result,
    worklistPath,
    reviewFile,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

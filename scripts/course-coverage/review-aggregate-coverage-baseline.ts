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
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  assembleCoverageFromReview,
  boundExcerpt,
  contentSha256,
  finalizeCoverageWorklist,
  selectCanonicalObjectMembership,
  type CoverageEvidenceCandidate,
  type CoverageReviewDecisionsDocument,
  type CoverageWorklistItem,
} from '../../src/lib/aggregate-governance';
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

const DELTA_DEFAULT =
  'delta-receipt:340280e950af341d3c402c01f783d0ed1735335eb1b1da019002b9bf460214ef';
const RELEASE_SET_ID = 'actkg-authoritative-candidate-v3-r2';
const RELEASE_ID = 'ctr:release:control-theory-engineering-v0.3';
const RELEASE_HASH =
  '13fc60a0a4e1706095f4db89f0a0db4cba10525f4cd6e9ec08b7d44acd7a4ffc';
const SOURCE_DATASET_HASH =
  '7ada10dbb5862ea1fa0102453bceff31c7b62c9045b2f14a1aba29bf5762911c';

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
  limitFiles = 200,
): Promise<Array<{ ref: string; text: string; sourceHash: string }>> {
  const abs = path.join(root, relativeDir);
  const collected: Array<{ ref: string; text: string; sourceHash: string }> = [];
  async function walk(dir: string, rel: string): Promise<void> {
    let entries: Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }>;
    try {
      entries = await readdir(dir, { withFileTypes: true }) as never;
    } catch {
      return;
    }
    const ordered = [...entries].sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const entry of ordered) {
      if (entry.name.startsWith('.')) continue;
      const childAbs = path.join(dir, entry.name);
      const childRel = path.join(rel, entry.name);
      if (entry.isDirectory()) {
        await walk(childAbs, childRel);
      } else if (entry.isFile() && /\.(md|mdx)$/iu.test(entry.name)) {
        try {
          const text = await readFile(childAbs, 'utf8');
          collected.push({
            ref: childRel,
            text: text.slice(0, 8000),
            sourceHash: contentSha256(text),
          });
        } catch {
          // skip unreadable
        }
      }
    }
  }
  await walk(abs, relativeDir);
  collected.sort((a, b) => a.ref.localeCompare(b.ref, 'en'));
  return collected.slice(0, limitFiles);
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

async function buildRepoEvidenceSources(root: string): Promise<RepoEvidenceSource[]> {
  const sources: RepoEvidenceSource[] = [];

  try {
    const nodesPath = 'course-content/authoring/knowledge/canonical-nodes.json';
    const raw = await readFile(path.join(root, nodesPath), 'utf8');
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
      const text = await readFile(path.join(root, rel), 'utf8');
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

  const lessonFiles = await collectMarkdownSnippets(root, 'course-content/authoring/lessons', 120);
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
    const cardRoot = path.join(root, 'course-content/authoring/knowledge/cards');
    const cardEntries = await readdir(cardRoot, { withFileTypes: true });
    const orderedCards = [...cardEntries]
      .filter((e) => e.isFile())
      .sort((a, b) => a.name.localeCompare(b.name, 'en'))
      .slice(0, 400);
    for (const entry of orderedCards) {
      const rel = `course-content/authoring/knowledge/cards/${entry.name}`;
      let text = entry.name;
      let sourceHash = contentSha256(entry.name);
      try {
        text = await readFile(path.join(root, rel), 'utf8');
        sourceHash = contentSha256(text);
      } catch {
        // name-only fallback
      }
      const base = entry.name.replace(/\.(md|mdx|json)$/iu, '');
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

async function generateWorklist(root: string, authoringRevision: string, deltaReceiptId: string) {
  const projectionPath = argValue('--projection')
    ?? 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.3-r2/control-theory-engineering-v0.3.act-projection.json';
  const releasePath = argValue('--release')
    ?? 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.3-r2/control-theory-engineering-v0.3.release.json';

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

  const sources = await buildRepoEvidenceSources(root);
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
    releaseSetId: RELEASE_SET_ID,
    releaseId: RELEASE_ID,
    releaseHash: RELEASE_HASH,
    sourceDatasetHash: SOURCE_DATASET_HASH,
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
  const deltaReceiptId = argValue('--delta-receipt-id') ?? DELTA_DEFAULT;
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

#!/usr/bin/env tsx
/**
 * Compare three mastery admission bands on the same live goal slice.
 * Writes docs/reports/2026-09-13-anchored-binding-mastery-path-slices.md
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { assembleKnowledgePathPlan } from '@/features/personalization/path-planning/internal/knowledge-path-mount';
import { loadGoalPlanningRegistry } from '@/features/personalization/path-planning/planning-projection-index';
import { knowledgeResourceAdmission } from '@/features/personalization/path-planning/application/mastery-thresholds';

const GOAL_ID = 'root-locus-analysis-foundations';
const TAG = 'ctc:v11g-5845390ded447e37f06ea222';

const BANDS = [
  { id: 'zero', label: '零掌握', tags: {} },
  {
    id: 'partial',
    label: '部分掌握 ≥0.5',
    tags: { [TAG]: { posteriorMastery: 0.62, confidence: 0.5, evidenceCount: 3 } },
  },
  {
    id: 'mastered',
    label: '已掌握 ≥0.85 且 confidence ≥0.6',
    tags: { [TAG]: { posteriorMastery: 0.9, confidence: 0.7, evidenceCount: 8 } },
  },
] as const;

function summarize(plan: ReturnType<typeof assembleKnowledgePathPlan>) {
  const nodes = plan.mainPath;
  return {
    nodeCount: nodes.length,
    skipped: plan.explanations.fallbackReasons.filter((reason) => reason.includes('mastered-knowledge-skipped')),
    firstPreferred: plan.explanations.selectedReasons.includes('first-appearance-preferred'),
    appearances: Object.fromEntries(
      ['first', 'revisit', 'reference'].map((key) => [
        key,
        nodes.filter((node) => node.appearance === key).length,
      ]),
    ),
    titles: nodes.map((node) => ({
      title: node.title,
      appearance: node.appearance ?? null,
      anchorLabel: node.anchorLabel ?? null,
      target: node.target,
      type: node.type,
    })),
  };
}

function main() {
  const loaded = loadGoalPlanningRegistry(GOAL_ID);
  const rows = BANDS.map((band) => {
    const admission = knowledgeResourceAdmission(band.tags[TAG]);
    const plan = assembleKnowledgePathPlan({
      studentId: `path-mastery-${band.id}`,
      goal: { id: GOAL_ID, title: '根轨迹分析基础', knowledgeTargets: [] },
      learnerState: {
        knowledgeMastery: { coverage: Object.keys(band.tags).length ? 'available' : 'missing', tags: band.tags },
      } as never,
      registry: loaded.registry,
      planningScope: {
        knowledgeIds: loaded.universe.knowledgeIds,
        edges: loaded.universe.edges,
      },
      constraints: { timeBudgetMinutes: 90, privacyScopes: ['student-visible'], device: 'desktop' },
    }, {
      prerequisiteEdges: loaded.universe.edges,
      heuristicTimeoutMs: 80,
    });
    return { band, admission, summary: summarize(plan) };
  });

  const report = [
    '# 锚定绑定发布三档掌握度路径切片',
    '',
    `- 目标：\`${GOAL_ID}\``,
    `- 对照知识点：\`${TAG}\``,
    `- 绑定发布：\`${loaded.universe.index.bindingReleaseId ?? 'missing'}\``,
    `- 规划资源数：${loaded.universe.resources.length}`,
    `- 生成方式：与 path-advisor-tool 同一知识路径挂载器 \`assembleKnowledgePathPlan\``,
    '',
    '| 档位 | 准入 | 主路径节点 | 首次 | 复现 | 参考 | 跳过已掌握 |',
    '| --- | --- | ---: | ---: | ---: | ---: | --- |',
    ...rows.map((row) => `| ${row.band.label} | ${row.admission} | ${row.summary.nodeCount} | ${row.summary.appearances.first} | ${row.summary.appearances.revisit} | ${row.summary.appearances.reference} | ${row.summary.skipped.length > 0 ? '是' : '否'} |`),
    '',
    '## 主路径节点',
    '',
    ...rows.flatMap((row) => [
      `### ${row.band.label}`,
      '',
      ...row.summary.titles.map((node, index) =>
        `${index + 1}. ${node.title}（${node.type}${node.appearance ? ` / ${node.appearance}` : ''}${node.anchorLabel ? ` / ${node.anchorLabel}` : ''}）`),
      '',
    ]),
    '零掌握只挂首次资源；部分掌握允许复现但仍把首次排在前面；已掌握会从骨架去掉该知识点。',
    '',
  ].join('\n');

  const out = join(process.cwd(), 'docs/reports/2026-09-13-anchored-binding-mastery-path-slices.md');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, report);
  console.log(JSON.stringify({
    ok: true,
    out,
    bindingReleaseId: loaded.universe.index.bindingReleaseId ?? null,
    bands: rows.map((row) => ({
      id: row.band.id,
      admission: row.admission,
      nodeCount: row.summary.nodeCount,
      appearances: row.summary.appearances,
    })),
  }, null, 2));
}

main();

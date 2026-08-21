import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const CHANGES_DIR = path.join(ROOT, 'openspec/changes');
const ARCHIVE_DIR = path.join(CHANGES_DIR, 'archive');
const COVERAGE_SPEC = path.join(ROOT, 'openspec/specs/micro-tutoring-coverage-audit/spec.md');
const ATTRIBUTION_SPEC = path.join(ROOT, 'openspec/specs/wrong-answer-evidence-attribution/spec.md');
const LINEAGE_EVIDENCE = path.join(
  ROOT,
  'openspec/changes/consolidate-micro-tutoring-coverage-specs/evidence/issue-lineage.md',
);
const LINEAGE_ARCHIVE = path.join(
  ROOT,
  'openspec/changes/archive/2026-08-21-consolidate-micro-tutoring-coverage-specs/evidence/issue-lineage.md',
);

const REQUIRED_COVERAGE_HEADINGS = [
  '### Requirement: 定义稳定的合格常规练习分母',
  '### Requirement: 审计每个错误选项的微辅导链路',
  '### Requirement: 提供确定性的报告与严格门禁',
  '### Requirement: 将覆盖审计纳入可重复验证',
  '### Requirement: 覆盖审计仅接受精确的选项级归因目录',
  '### Requirement: 覆盖审计正式规范保持完整归档 lineage',
];

function read(filePath: string) {
  return readFileSync(filePath, 'utf8');
}

function purposeOf(spec: string) {
  const match = spec.match(/## Purpose\n([\s\S]*?)\n## /u);
  return (match?.[1] ?? '').trim();
}

describe('micro-tutoring coverage spec governance', () => {
  it('keeps completed #1391 change archived and canonical Purpose non-placeholder', () => {
    expect(existsSync(path.join(CHANGES_DIR, 'add-micro-tutoring-coverage-audit-gate'))).toBe(false);
    expect(existsSync(path.join(ARCHIVE_DIR, '2026-08-21-add-micro-tutoring-coverage-audit-gate'))).toBe(true);
    expect(existsSync(path.join(ARCHIVE_DIR, '2026-08-21-add-micro-tutoring-option-attribution'))).toBe(true);

    const coverage = read(COVERAGE_SPEC);
    const attribution = read(ATTRIBUTION_SPEC);
    const coveragePurpose = purposeOf(coverage);
    const attributionPurpose = purposeOf(attribution);

    expect(coveragePurpose.length).toBeGreaterThan(20);
    expect(coveragePurpose.startsWith('TBD')).toBe(false);
    expect(attributionPurpose.length).toBeGreaterThan(20);
    expect(attributionPurpose.startsWith('TBD')).toBe(false);
    expect(coveragePurpose).toContain('不表示 54/54 运行时已完成');
  });

  it('requires the archived #1391/#1392 contract plus lineage in canonical or this change', () => {
    const coverage = read(COVERAGE_SPEC);
    const activeDelta = path.join(
      CHANGES_DIR,
      'consolidate-micro-tutoring-coverage-specs/specs/micro-tutoring-coverage-audit/spec.md',
    );
    const archivedDelta = path.join(
      ARCHIVE_DIR,
      '2026-08-21-consolidate-micro-tutoring-coverage-specs/specs/micro-tutoring-coverage-audit/spec.md',
    );
    const combined = [
      coverage,
      existsSync(activeDelta) ? read(activeDelta) : '',
      existsSync(archivedDelta) ? read(archivedDelta) : '',
    ].join('\n');

    for (const heading of REQUIRED_COVERAGE_HEADINGS) {
      expect(combined).toContain(heading);
    }

    const lineage = existsSync(LINEAGE_EVIDENCE)
      ? read(LINEAGE_EVIDENCE)
      : read(LINEAGE_ARCHIVE);
    expect(lineage).toContain('#1391');
    expect(lineage).toContain('#1390');
    expect(lineage).toContain('不把规范整理描述为 54/54 运行时完成');
    expect(lineage).toContain('status:tracking');
  });

  it('does not leave a completed micro-tutoring coverage-audit change active', () => {
    const active = readdirSync(CHANGES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== 'archive')
      .map((entry) => entry.name);
    expect(active).not.toContain('add-micro-tutoring-coverage-audit-gate');
    expect(active.filter((name) => name.includes('micro-tutoring-coverage-audit-gate'))).toEqual([]);
  });
});

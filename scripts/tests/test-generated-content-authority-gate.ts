/**
 * Generated-content authority fitness gate（npm run test:generated-content-authority）。
 *
 * 严格模式：以观测 git HEAD 对照矩阵 sourceRevision（STALE 即失败），
 * 并要求干净工作树。这是 task 1.4 的 fail-closed 门；单元测试使用
 * 自洽绑定验证机制本身，不承担该门的陈旧语义。
 */
import { resolve } from 'node:path';

import {
  assertGeneratedContentAuthorityFitness,
  evaluateGeneratedContentAuthorityFitness,
} from '../../src/lib/generated-content-authority';

const repoRoot = resolve(process.cwd());
const report = evaluateGeneratedContentAuthorityFitness({ repoRoot });

console.log('[generated-content-authority] source binding:', JSON.stringify(report.sourceBinding));
for (const row of report.rows) {
  console.log(`[generated-content-authority] ${row.domain}: ${row.status} (dependency: ${row.dependency.qualification})`);
  for (const invariant of Object.keys(row.invariantFindings) as Array<keyof typeof row.invariantFindings>) {
    const finding = row.invariantFindings[invariant];
    if (finding.status !== 'QUALIFIED') {
      console.log(`  ${invariant}: ${finding.status} — ${finding.reasons.join('; ')}`);
    }
  }
}
if (report.violations.length > 0) {
  console.log('[generated-content-authority] violations:');
  for (const violation of report.violations) console.log(`  - ${violation}`);
}

try {
  assertGeneratedContentAuthorityFitness(report, { requireCleanWorktree: true });
  console.log('[generated-content-authority] PASS: matrix settled QUALIFIED with clean binding');
} catch (error) {
  console.error('[generated-content-authority] FAIL:', (error as Error).message);
  process.exit(1);
}

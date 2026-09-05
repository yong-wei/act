/**
 * #1951：official 汇总的同源派生导出（CSV / xlsx 工作簿 / markdown 幻灯片）。
 *
 * 单一冻结真源是 summary/official.json：导出写前重读真源并比对内容
 * 哈希，真源缺失、漂移或非 complete 时 fail closed，不产生第二套指标。
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import writeXlsxFile from 'write-excel-file/node';

import { toCsv } from '@/lib/csv-export';

import type {
  KonlingFairExperimentOfficialSummary,
  KonlingFairExperimentPairedDifference,
  KonlingFairExperimentPairedRatioDifference,
} from './types';

const SUMMARY_DIR = 'summary';

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/** 指标表行：全部载体共用同一投影，防止 CSV 与工作簿口径漂移。 */
function summaryRows(official: KonlingFairExperimentOfficialSummary): Array<Array<string | number>> {
  const rows: Array<Array<string | number>> = [
    ['metric', 'arm', 'value', 'numerator', 'denominator'],
  ];
  for (const [arm, perArm] of Object.entries(official.perArm)) {
    for (const [caliber, structure] of Object.entries(perArm.structure)) {
      rows.push([`structure@${caliber}`, arm, structure.rate, structure.passed, structure.n]);
    }
    if (perArm.audit) {
      rows.push(['audit-verdict', arm, perArm.audit.rate, perArm.audit.passed, perArm.audit.n]);
    }
    rows.push(['citation-precision', arm, perArm.citationAudit.precision.ratio, perArm.citationAudit.precision.numerator, perArm.citationAudit.precision.denominator]);
    rows.push(['citation-coverage', arm, perArm.citationAudit.coverage.ratio, perArm.citationAudit.coverage.numerator, perArm.citationAudit.coverage.denominator]);
  }
  return rows;
}

function deltaRows(
  deltas: readonly (KonlingFairExperimentPairedDifference | KonlingFairExperimentPairedRatioDifference)[],
): Array<Array<string | number>> {
  const rows: Array<Array<string | number>> = [
    ['metric', 'baseline', 'comparison', 'difference_pp', 'ci95_low_pp', 'ci95_high_pp', 'paired_n'],
  ];
  for (const delta of deltas) {
    rows.push([
      delta.metric,
      delta.baseline.label,
      delta.comparison.label,
      Number(delta.percentagePointDifference.toFixed(4)),
      Number(delta.pairedCi95.low.toFixed(4)),
      Number(delta.pairedCi95.high.toFixed(4)),
      delta.pairedN,
    ]);
  }
  return rows;
}

function slidesMarkdown(official: KonlingFairExperimentOfficialSummary): string {
  const lines: string[] = [
    `# 公平实验汇总 ${official.runId}`,
    '',
    `- 状态：${official.status}；题库 ${official.bank.version}（${official.bank.itemCount} 题 × ${official.bank.replicates} replicate）`,
    `- 模型：${official.config.model}（${official.config.provider}）`,
    '',
  ];
  for (const [arm, perArm] of Object.entries(official.perArm)) {
    lines.push(`## ${arm}`);
    lines.push('');
    lines.push('| 指标 | 值 |');
    lines.push('| --- | --- |');
    for (const [caliber, structure] of Object.entries(perArm.structure)) {
      lines.push(`| 结构通过率@${caliber} | ${(structure.rate * 100).toFixed(1)}% (${structure.passed}/${structure.n}) |`);
    }
    if (perArm.audit) {
      lines.push(`| 盲审通过率 | ${(perArm.audit.rate * 100).toFixed(1)}% (${perArm.audit.passed}/${perArm.audit.n}) |`);
    }
    lines.push(`| 引用精确率 | ${(perArm.citationAudit.precision.ratio * 100).toFixed(1)}% (${perArm.citationAudit.precision.numerator}/${perArm.citationAudit.precision.denominator}) |`);
    lines.push(`| 追溯覆盖率 | ${(perArm.citationAudit.coverage.ratio * 100).toFixed(1)}% (${perArm.citationAudit.coverage.numerator}/${perArm.citationAudit.coverage.denominator}) |`);
    lines.push('');
  }
  lines.push('## 配对差（百分点，95% CI）');
  lines.push('');
  lines.push('| 指标 | 基线 → 对照 | 差 | CI |');
  lines.push('| --- | --- | --- | --- |');
  for (const delta of [...official.generationDeltas, ...official.citationAuditDeltas, ...official.caliberDeltas]) {
    lines.push(`| ${delta.metric} | ${delta.baseline.label} → ${delta.comparison.label} | ${delta.percentagePointDifference.toFixed(1)} | [${delta.pairedCi95.low.toFixed(1)}, ${delta.pairedCi95.high.toFixed(1)}] |`);
  }
  lines.push('');
  return lines.join('\n');
}

export interface KonlingFairExperimentExportResult {
  csv: string;
  workbook: string;
  slides: string;
}

/**
 * 从冻结真源派生全部导出。真源以传入 official 的规范化 JSON 哈希比对，
 * 不一致即抛错（fail closed），确保四载体同源。
 */
export async function exportKonlingFairExperimentArtifacts(
  runDir: string,
  official: KonlingFairExperimentOfficialSummary,
): Promise<KonlingFairExperimentExportResult> {
  const officialPath = path.join(runDir, SUMMARY_DIR, 'official.json');
  if (!fs.existsSync(officialPath)) {
    throw new Error(`official summary missing: ${officialPath}`);
  }
  const frozen = fs.readFileSync(officialPath, 'utf8');
  const canonical = canonicalJson(official);
  if (
    createHash('sha256').update(frozen).digest('hex')
    !== createHash('sha256').update(canonical).digest('hex')
  ) {
    throw new Error('official summary drifted from frozen truth; refusing to export');
  }

  const rows = [...summaryRows(official), [], ...deltaRows(official.generationDeltas)];
  if (official.citationAuditDeltas.length > 0) {
    rows.push([], ...deltaRows(official.citationAuditDeltas));
  }
  const csv = toCsv(rows.map((row) => row.map((cell) => (cell == null ? '' : cell))));

  const workbookBuffer = await writeXlsxFile(
    [
      ...summaryRows(official).map((row) => row.map((cell) => ({ value: cell }))),
      [],
      ...deltaRows(official.generationDeltas).map((row) => row.map((cell) => ({ value: cell }))),
      [],
      ...deltaRows(official.citationAuditDeltas).map((row) => row.map((cell) => ({ value: cell }))),
    ],
    { sheet: 'official' },
  ).toBuffer();

  const csvPath = path.join(runDir, SUMMARY_DIR, 'official.csv');
  const workbookPath = path.join(runDir, SUMMARY_DIR, 'official.xlsx');
  const slidesPath = path.join(runDir, SUMMARY_DIR, 'official-slides.md');
  fs.writeFileSync(csvPath, csv, 'utf8');
  fs.writeFileSync(workbookPath, new Uint8Array(workbookBuffer));
  fs.writeFileSync(slidesPath, slidesMarkdown(official), 'utf8');
  return { csv: csvPath, workbook: workbookPath, slides: slidesPath };
}

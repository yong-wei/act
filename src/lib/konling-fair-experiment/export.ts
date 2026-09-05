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

// #2016：composite 指标的人类可见名称与公式在全部载体统一。内部 schema key
// `composite` 保持不变以兼容冻结历史数据，不改写 official.json 真源。
const COMPOSITE_DISPLAY_NAME = '结构与质量联合通过率';
const COMPOSITE_FORMULA = '结构通过且盲审质量非 major-error';
const PLAIN_BASELINE_COMPOSITE_NOTE = '未启用结构合同；联合通过率 0% 不代表知识正确率 0%';

function rateText(rate: number, passed: number, n: number): string {
  // 0/0 的引用类指标显示 N/A，不显示成 0%（#2016）。
  if (n === 0) return 'N/A';
  return `${(rate * 100).toFixed(1)}% (${passed}/${n})`;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}


function displayMetricName(metric: string): string {
  return metric.startsWith('composite@')
    ? metric.replace('composite@', `${COMPOSITE_DISPLAY_NAME}@`)
    : metric;
}

/** JSON 派生说明：composite 指标的统一名称、公式与普通基线结构性来源解释。 */
function derivedNotes(official: KonlingFairExperimentOfficialSummary) {
  const plain = official.perArm['plain-baseline'];
  const compositeRows = Object.values(plain?.composite ?? {});
  const allZero = compositeRows.length > 0 && compositeRows.every((composite) => composite.n > 0 && composite.passed === 0);
  // 与幻灯片同逻辑：仅在联合通过率实际为 0 时声称 0%（review R2 P2）。
  return {
    metricNames: {
      composite: COMPOSITE_DISPLAY_NAME,
      compositeFormula: COMPOSITE_FORMULA,
    },
    plainBaselineNote: allZero
      ? PLAIN_BASELINE_COMPOSITE_NOTE
      : '普通基线未启用结构合同；结构率与联合率仅为能力指标',
    zeroDenominatorPolicy: '0/0 的引用类指标显示 N/A，不显示成 0%',
    runId: official.runId,
  };
}

/** 指标表行：全部载体共用同一投影，防止 CSV 与工作簿口径漂移。 */
function summaryRows(official: KonlingFairExperimentOfficialSummary): Array<Array<string | number>> {
  const rows: Array<Array<string | number>> = [
    ['metric', 'arm', 'value', 'numerator', 'denominator', 'display_name', 'formula'],
  ];
  for (const [arm, perArm] of Object.entries(official.perArm)) {
    for (const [caliber, structure] of Object.entries(perArm.structure)) {
      rows.push([`structure@${caliber}`, arm, structure.rate, structure.passed, structure.n, '', '']);
    }
    if (perArm.audit) {
      rows.push(['audit-verdict', arm, perArm.audit.rate, perArm.audit.passed, perArm.audit.n, '', '']);
    }
    for (const [caliber, composite] of Object.entries(perArm.composite ?? {})) {
      // 机器 metric 名自解释；schema key 仍为 composite（冻结兼容）。
      // 显示名与公式作为独立列同步进 CSV 与工作簿（review R2 P2）。
      rows.push([
        `composite-structure-and-quality@${caliber}`,
        arm,
        composite.rate,
        composite.passed,
        composite.n,
        COMPOSITE_DISPLAY_NAME,
        COMPOSITE_FORMULA,
      ]);
    }
    rows.push(['citation-precision', arm, perArm.citationAudit.precision.denominator === 0 ? 'N/A' : perArm.citationAudit.precision.ratio, perArm.citationAudit.precision.numerator, perArm.citationAudit.precision.denominator, '', '']);
    rows.push(['citation-coverage', arm, perArm.citationAudit.coverage.denominator === 0 ? 'N/A' : perArm.citationAudit.coverage.ratio, perArm.citationAudit.coverage.numerator, perArm.citationAudit.coverage.denominator, '', '']);
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
    for (const [caliber, composite] of Object.entries(perArm.composite ?? {})) {
      lines.push(`| ${COMPOSITE_DISPLAY_NAME}@${caliber}（${COMPOSITE_FORMULA}） | ${rateText(composite.rate, composite.passed, composite.n)} |`);
    }
    if (arm === 'plain-baseline') {
      const compositeRows = Object.entries(perArm.composite ?? {});
      const allZero = compositeRows.length > 0 && compositeRows.every(([, composite]) => composite.n > 0 && composite.passed === 0);
      // 仅在联合通过率实际为 0 时声称 0%，避免与未来非零实测值自相矛盾（review P2）。
      lines.push(`| 说明 | ${allZero ? PLAIN_BASELINE_COMPOSITE_NOTE : '普通基线未启用结构合同；结构率与联合率仅为能力指标'}`);
    }
    if (perArm.audit) {
      lines.push(`| 盲审通过率 | ${(perArm.audit.rate * 100).toFixed(1)}% (${perArm.audit.passed}/${perArm.audit.n}) |`);
    }
    lines.push(`| 引用精确率 | ${rateText(perArm.citationAudit.precision.ratio, perArm.citationAudit.precision.numerator, perArm.citationAudit.precision.denominator)} |`);
    lines.push(`| 追溯覆盖率 | ${rateText(perArm.citationAudit.coverage.ratio, perArm.citationAudit.coverage.numerator, perArm.citationAudit.coverage.denominator)} |`);
    lines.push('');
  }
  lines.push('## 配对差（百分点，95% CI）');
  lines.push('');
  lines.push('| 指标 | 基线 → 对照 | 差 | CI |');
  lines.push('| --- | --- | --- | --- |');
  for (const delta of [...official.generationDeltas, ...official.citationAuditDeltas, ...official.caliberDeltas]) {
    lines.push(`| ${displayMetricName(delta.metric)} | ${delta.baseline.label} → ${delta.comparison.label} | ${delta.percentagePointDifference.toFixed(1)} | [${delta.pairedCi95.low.toFixed(1)}, ${delta.pairedCi95.high.toFixed(1)}] |`);
  }
  lines.push('');
  return lines.join('\n');
}

export interface KonlingFairExperimentExportResult {
  csv: string;
  workbook: string;
  slides: string;
  notes: string;
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
  const notesPath = path.join(runDir, SUMMARY_DIR, 'official-notes.json');
  fs.writeFileSync(notesPath, canonicalJson(derivedNotes(official)), 'utf8');
  return { csv: csvPath, workbook: workbookPath, slides: slidesPath, notes: notesPath };
}

/**
 * 知识问答公平基线实验评分器回放入口（Issue #1900；#1952 增 --bank）。
 *
 * 对既有运行目录的冻结回答快照按请求口径重新评分，不重新调用生成
 * 模型，不修改任何回答文件；输出独立回放报告（caliber-delta）。
 * --bank v1|v2（默认 v2）必须与被回放运行的题库一致（哈希门禁）。
 *
 * 用法：
 *   npx tsx scripts/konling-fair-experiment/replay-scoring.ts --run-id demo \
 *     [--bank v1|v2] --calibers structure-alias.v1,structure-alias.v2
 */

import {
  KONLING_FAIR_EXPERIMENT_BANK_V1,
  KONLING_FAIR_EXPERIMENT_BANK_V2,
  replayKonlingFairExperimentScoring,
} from '@/lib/konling-fair-experiment';
import { STUDY_QUESTION_SCORING_CALIBERS, type StudyQuestionScoringCaliber } from '@/lib/konling-study-question-structure';

import { gitRevision, parseCliFlags } from '../konling-blind-audit/cli';

async function main() {
  const { values } = parseCliFlags(process.argv.slice(2), ['run-id', 'calibers', 'bank']);
  const runId = values['run-id'];
  if (!runId) {
    console.error('需要 --run-id <existing-run>');
    process.exitCode = 1;
    return;
  }
  const bankSelection = values.bank ?? 'v2';
  if (bankSelection !== 'v1' && bankSelection !== 'v2') {
    console.error('未知题库版本；可用值：v1, v2');
    process.exitCode = 1;
    return;
  }
  const requested = (values.calibers ?? 'structure-alias.v1,structure-alias.v2')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const invalid = requested.filter(
    (caliber) => !(STUDY_QUESTION_SCORING_CALIBERS as readonly string[]).includes(caliber),
  );
  if (invalid.length > 0) {
    console.error(`未知评分口径: ${invalid.join(', ')}；可用口径: ${STUDY_QUESTION_SCORING_CALIBERS.join(', ')}`);
    process.exitCode = 1;
    return;
  }
  const result = replayKonlingFairExperimentScoring({
    root: process.cwd(),
    runId,
    bank: bankSelection === 'v1'
      ? KONLING_FAIR_EXPERIMENT_BANK_V1
      : KONLING_FAIR_EXPERIMENT_BANK_V2,
    calibers: requested as StudyQuestionScoringCaliber[],
    scorerRevision: gitRevision(),
  });
  process.stdout.write(`status: ${result.status}\n`);
  process.stdout.write(`caliberDeltas: ${JSON.stringify(result.officialSummary?.caliberDeltas ?? [])}\n`);
  if (result.replayReportPath) process.stdout.write(`report: ${result.replayReportPath}\n`);
  if (result.status !== 'complete') process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

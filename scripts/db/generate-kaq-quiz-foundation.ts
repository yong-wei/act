import { promises as fs } from 'node:fs';
import path from 'node:path';

import { PRESET_QUESTIONS } from '@/features/assessment/adaptive-question-bank';
import {
  buildKaqQuizFoundationArtifacts,
  type KaqQuizCoverageBaselineMatrix,
} from '@/features/adaptive-assessment/kaq-quiz-foundation';

const OUTPUT_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const BASELINE_MATRIX_PATH = path.join(OUTPUT_DIR, 'learning-goal-resource-baseline-matrix.json');
const COVERAGE_MATRIX_PATH = path.join(OUTPUT_DIR, 'kaq-quiz-foundation-coverage-matrix.json');
const REVIEWED_ITEMS_PATH = path.join(OUTPUT_DIR, 'kaq-quiz-foundation-reviewed-items.jsonl');
const LIMITATIONS_PATH = path.join(OUTPUT_DIR, 'kaq-quiz-foundation-limitations.json');

async function readBaselineMatrix(): Promise<KaqQuizCoverageBaselineMatrix> {
  const raw = await fs.readFile(BASELINE_MATRIX_PATH, 'utf8');
  return JSON.parse(raw) as KaqQuizCoverageBaselineMatrix;
}

async function main() {
  const baselineMatrix = await readBaselineMatrix();
  const artifacts = buildKaqQuizFoundationArtifacts({
    baselineMatrix,
    questions: PRESET_QUESTIONS,
  });

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(COVERAGE_MATRIX_PATH, `${JSON.stringify(artifacts.coverageMatrix, null, 2)}\n`);
  await fs.writeFile(
    REVIEWED_ITEMS_PATH,
    `${artifacts.reviewedItems.map((item) => JSON.stringify(item)).join('\n')}\n`,
  );
  await fs.writeFile(LIMITATIONS_PATH, `${JSON.stringify(artifacts.limitations, null, 2)}\n`);

  const summary = {
    coverageRows: artifacts.coverageMatrix.rows.length,
    reviewedItems: artifacts.reviewedItems.length,
    limitations: artifacts.limitations.rows.length,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

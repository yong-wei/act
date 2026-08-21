import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  buildAdaptiveAssessmentItemCatalog,
  loadAdaptiveAssessmentCatalogSources,
} from '@/features/adaptive-assessment/adaptive-assessment-item-catalog';
import { loadAssessmentItemSemanticReviewSource } from '@/features/adaptive-assessment/adaptive-assessment-semantic-review';
import {
  buildAdaptiveAssessmentLifecycleCoverage,
  buildTerminalValidationOverlayCatalog,
  buildTerminalValidationReviewDecisions,
  lifecycleCoverageArtifactsToFiles,
} from '@/features/adaptive-assessment/adaptive-assessment-lifecycle-coverage';

const OUTPUT_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');

async function main() {
  const sources = await loadAdaptiveAssessmentCatalogSources();
  const catalog = buildAdaptiveAssessmentItemCatalog({
    acqStaticQuestions: sources.acqStaticQuestions,
    icourseObjectiveBankItems: sources.icourseObjectiveBankItems,
    icourseObjectiveBankIndexTotal: sources.icourseObjectiveBankIndexTotal,
    kaqReviewedItems: sources.kaqReviewedItems,
  });
  const decisions = await loadAssessmentItemSemanticReviewSource(catalog.items);
  const overlay = buildTerminalValidationOverlayCatalog();
  const overlayDecisions = buildTerminalValidationReviewDecisions(overlay.items);
  const artifacts = buildAdaptiveAssessmentLifecycleCoverage({
    items: catalog.items,
    decisions,
    overlayItems: overlay.items,
    overlayDecisions,
  });
  const files = lifecycleCoverageArtifactsToFiles(artifacts);
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(path.join(OUTPUT_DIR, 'adaptive-assessment-lifecycle-coverage-v2.json'), files.matrix);
  await writeFile(path.join(OUTPUT_DIR, 'adaptive-assessment-lifecycle-coverage-v2-policy.json'), files.policy);
  await writeFile(path.join(OUTPUT_DIR, 'adaptive-assessment-lifecycle-coverage-v2-items.jsonl'), files.items);
  await writeFile(path.join(OUTPUT_DIR, 'adaptive-assessment-lifecycle-coverage-v2-baseline.json'), files.baseline);
  process.stdout.write(`${JSON.stringify({
    learningGoalCount: artifacts.matrix.totals.learningGoalCount,
    completeCells: artifacts.matrix.totals.completeCells,
    incompleteCells: artifacts.matrix.totals.incompleteCells,
    overlayItemCount: overlay.items.length,
    catalogItemCount: catalog.items.length,
    drift: artifacts.drift,
  }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

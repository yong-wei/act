import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  adaptiveAssessmentCatalogArtifactsToFiles,
  buildAdaptiveAssessmentItemCatalog,
  loadAdaptiveAssessmentCatalogSources,
} from '@/features/assessment/adaptive-assessment-item-catalog';
import {
  generatedQuestionsFromStore,
  readGeneratedCandidateStore,
} from '@/features/assessment/generated-candidate-catalog';

const OUTPUT_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'adaptive-assessment-item-catalog-manifest.json');
const ITEMS_PATH = path.join(OUTPUT_DIR, 'adaptive-assessment-item-catalog-items.jsonl');
const LIMITATIONS_PATH = path.join(OUTPUT_DIR, 'adaptive-assessment-item-catalog-limitations.json');

async function main() {
  const sources = await loadAdaptiveAssessmentCatalogSources();
  const generatedStore = readGeneratedCandidateStore();
  const artifacts = buildAdaptiveAssessmentItemCatalog({
    acqStaticQuestions: sources.acqStaticQuestions,
    icourseObjectiveBankItems: sources.icourseObjectiveBankItems,
    icourseObjectiveBankIndexTotal: sources.icourseObjectiveBankIndexTotal,
    kaqReviewedItems: sources.kaqReviewedItems,
    generatedCandidateStore: generatedStore ?? undefined,
    generatedQuestions: generatedStore ? generatedQuestionsFromStore(generatedStore) : [],
  });
  const files = adaptiveAssessmentCatalogArtifactsToFiles(artifacts);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(MANIFEST_PATH, files.manifest);
  await fs.writeFile(ITEMS_PATH, files.items);
  await fs.writeFile(LIMITATIONS_PATH, files.limitations);

  process.stdout.write(`${JSON.stringify({
    itemCount: artifacts.manifest.itemCount,
    pathEligibleItemCount: artifacts.manifest.pathEligibleItemCount,
    sourceFamilies: artifacts.manifest.sourceFamilies.map((family) => ({
      family: family.family,
      sourceTotal: family.sourceTotal,
      importedTotal: family.importedTotal,
      blockedTotal: family.blockedTotal,
    })),
    limitations: artifacts.limitations.rows.length,
  }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

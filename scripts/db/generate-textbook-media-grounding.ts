import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  buildTextbookMediaGroundingArtifacts,
  type TextbookMediaGroundingArtifacts,
} from '@/lib/textbook-media-grounding';
import type { RuntimeResourceProjectionArtifactRow } from '@/lib/runtime-resource-projections';
import {
  loadAllTextbookStructureUnitProjections,
  type TextbookStructureUnitProjection,
} from '@/lib/structured-textbook-runtime';

const SOURCE_PACKAGE_ID = 'hu-shousong-exercise-analysis-3rd';
const RUNTIME_TEXTBOOK_ROOT = path.join(process.cwd(), 'course-content/runtime/resources/textbooks-v2');
const OUTPUT_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const RUNTIME_PROJECTIONS_PATH = path.join(OUTPUT_DIR, 'runtime-resource-projections.jsonl');
const CANDIDATES_PATH = path.join(OUTPUT_DIR, 'textbook-unit-grounding-candidates.jsonl');
const CITATION_TARGETS_PATH = path.join(OUTPUT_DIR, 'textbook-unit-citation-targets.jsonl');
const LIMITATIONS_PATH = path.join(OUTPUT_DIR, 'textbook-media-grounding-limitations.json');

async function main() {
  const generatedAt = new Date().toISOString();
  const textbookUnits = await loadTextbookUnits();
  const targetFileHashes = new Map(textbookUnits.map((unit) => [unit.href, unit.contentHash]));
  const mediaProjections = await loadMediaProjectionRows(RUNTIME_PROJECTIONS_PATH);
  const artifacts = buildTextbookMediaGroundingArtifacts({
    sourcePackageId: SOURCE_PACKAGE_ID,
    generatedAt,
    reviewBatchId: `textbook-grounding-${generatedAt.slice(0, 10)}`,
    textbookUnits,
    targetFileHashForHref: (href) => targetFileHashes.get(href) ?? null,
    mediaProjections,
  });

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await writeJsonl(CANDIDATES_PATH, artifacts.candidates);
  await writeJsonl(CITATION_TARGETS_PATH, artifacts.citationTargets);
  await fs.writeFile(LIMITATIONS_PATH, `${JSON.stringify(artifacts.limitations, null, 2)}\n`, 'utf-8');
  printSummary(artifacts);
}

async function loadTextbookUnits(): Promise<TextbookStructureUnitProjection[]> {
  const units = (await loadAllTextbookStructureUnitProjections(RUNTIME_TEXTBOOK_ROOT))
    .filter((unit) => unit.metadata.bookId === SOURCE_PACKAGE_ID);
  if (units.length === 0) {
    throw new Error(`No structured textbook units found for ${SOURCE_PACKAGE_ID}.`);
  }
  return units;
}

async function loadMediaProjectionRows(filePath: string): Promise<RuntimeResourceProjectionArtifactRow[]> {
  const content = await readRequiredTextFile(
    filePath,
    'Missing runtime resource projections. Run the upstream projection generator before textbook-media grounding.',
  );
  return content
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as RuntimeResourceProjectionArtifactRow)
    .filter(isMediaProjectionRow);
}

function isMediaProjectionRow(row: RuntimeResourceProjectionArtifactRow): boolean {
  return row.family === 'runtime-lesson-media' ||
    row.family === 'knowledge-infograph' ||
    row.resourceType === 'image' ||
    row.resourceType === 'audio' ||
    row.resourceType === 'video' ||
    row.resourceType === 'slides';
}

async function readRequiredTextFile(filePath: string, message: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`${message}\nRequired file: ${filePath}`, { cause: error });
  }
}

async function writeJsonl(filePath: string, rows: readonly unknown[]) {
  await fs.writeFile(filePath, rows.length > 0 ? `${rows.map((row) => JSON.stringify(row)).join('\n')}\n` : '', 'utf-8');
}

function printSummary(artifacts: TextbookMediaGroundingArtifacts) {
  console.log(JSON.stringify({
    candidates: artifacts.candidates.length,
    citationTargets: artifacts.citationTargets.length,
    limitations: artifacts.limitations.limitations.length,
    denominator: artifacts.limitations.denominator,
    limitationReasons: artifacts.limitations.limitationReasons,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

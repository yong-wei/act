import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  buildTextbookMediaGroundingArtifacts,
  type TextbookMediaGroundingArtifacts,
} from '@/lib/textbook-media-grounding';
import type { RuntimeResourceProjectionArtifactRow } from '@/lib/runtime-resource-projections';
import {
  loadAllTextbookRuntimeSearchDocuments,
  type TextbookRuntimeSearchDocument,
} from '@/lib/textbook-runtime-resources';
import { buildKaqArtifactVersionRefs } from '@/lib/kaq-artifact-versioning';

const SOURCE_PACKAGE_ID = 'hu-shousong-exercise-analysis-3rd';
const RUNTIME_TEXTBOOK_ROOT = path.join(process.cwd(), 'course-content/runtime/resources/textbooks', SOURCE_PACKAGE_ID);
const OUTPUT_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const RUNTIME_PROJECTIONS_PATH = path.join(OUTPUT_DIR, 'runtime-resource-projections.jsonl');
const CANDIDATES_PATH = path.join(OUTPUT_DIR, 'textbook-section-grounding-candidates.jsonl');
const CITATION_TARGETS_PATH = path.join(OUTPUT_DIR, 'textbook-section-citation-targets.jsonl');
const LIMITATIONS_PATH = path.join(OUTPUT_DIR, 'textbook-media-grounding-limitations.json');

interface RuntimeTextbookManifest {
  bookId?: string;
  version?: string;
  title?: string;
  authoringManifestHash?: string;
}

async function main() {
  const generatedAt = new Date().toISOString();
  await assertRuntimeExportExists();
  const textbookManifest = await readJson<RuntimeTextbookManifest>(path.join(RUNTIME_TEXTBOOK_ROOT, 'manifest.json'));
  const textbookDocuments = await buildTextbookDocuments(textbookManifest);
  const mediaProjections = await loadMediaProjectionRows(RUNTIME_PROJECTIONS_PATH);
  const artifacts = buildTextbookMediaGroundingArtifacts({
    sourcePackageId: SOURCE_PACKAGE_ID,
    generatedAt,
    reviewBatchId: `textbook-grounding-${generatedAt.slice(0, 10)}`,
    textbookDocuments,
    mediaProjections,
  });

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await writeJsonl(CANDIDATES_PATH, artifacts.candidates);
  await writeJsonl(CITATION_TARGETS_PATH, artifacts.citationTargets);
  await fs.writeFile(LIMITATIONS_PATH, `${JSON.stringify(artifacts.limitations, null, 2)}\n`, 'utf-8');
  printSummary(artifacts);
}

async function buildTextbookDocuments(manifest: RuntimeTextbookManifest): Promise<TextbookRuntimeSearchDocument[]> {
  const bookId = manifest.bookId ?? SOURCE_PACKAGE_ID;
  const documents = (await loadAllTextbookRuntimeSearchDocuments(path.dirname(RUNTIME_TEXTBOOK_ROOT)))
    .filter((document) => document.metadata.bookId === bookId);
  if (documents.length === 0) {
    throw new Error(`No runtime search documents found for ${bookId}.`);
  }
  const versionRefs = buildKaqArtifactVersionRefs({
    resourceRegistryVersion: manifest.version ?? 'textbook-resource-export.v1',
    resourceProjectionVersion: 'resource-semantic-projection.v1',
    groundingVersion: 'textbook-media-grounding.v1',
  });
  await Promise.all(documents.map(assertTextbookDocumentRuntimeHrefExists));
  return documents.map((document) => ({
    ...document,
    resourceProjection: {
      ...document.resourceProjection,
      versionRefs: document.resourceProjection.versionRefs ?? versionRefs,
    },
  }));
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

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, 'utf-8')) as T;
}

async function readRequiredTextFile(filePath: string, message: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`${message}\nRequired file: ${filePath}`, { cause: error });
  }
}

async function assertTextbookDocumentRuntimeHrefExists(document: TextbookRuntimeSearchDocument): Promise<void> {
  const href = document.citationAddress?.href ?? document.href;
  if (href) await assertRuntimeHrefExists(href);
}

async function assertRuntimeHrefExists(href: string): Promise<void> {
  const [pathname] = href.split('#');
  const prefix = '/course-runtime/';
  if (!pathname.startsWith(prefix)) {
    throw new Error(`Textbook runtime section href must start with ${prefix}: ${href}`);
  }
  const relativePath = pathname.slice(prefix.length);
  const absolutePath = path.join(process.cwd(), 'course-content/runtime', relativePath);
  await fs.access(absolutePath);
}

async function assertRuntimeExportExists(): Promise<void> {
  const requiredFiles = ['manifest.json', 'search-documents.jsonl'];
  const missingFiles: string[] = [];
  for (const fileName of requiredFiles) {
    const filePath = path.join(RUNTIME_TEXTBOOK_ROOT, fileName);
    try {
      await fs.access(filePath);
    } catch {
      missingFiles.push(filePath);
    }
  }
  if (missingFiles.length > 0) {
    throw new Error([
      `Missing runtime textbook export for ${SOURCE_PACKAGE_ID}:`,
      ...missingFiles.map((filePath) => `- ${filePath}`),
      `Run: python3 course-content/scripts/export_textbook_resources.py --book ${SOURCE_PACKAGE_ID}`,
    ].join('\n'));
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

import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  buildTextbookMediaGroundingArtifacts,
  type TextbookMediaGroundingArtifacts,
} from '@/lib/textbook-media-grounding';
import type { RuntimeResourceProjectionArtifactRow } from '@/lib/runtime-resource-projections';
import type { TextbookRuntimeSearchDocument } from '@/lib/textbook-runtime-resources';
import { buildKaqArtifactVersionRefs } from '@/lib/kaq-artifact-versioning';

const SOURCE_PACKAGE_ID = 'hu-shousong-exercise-analysis-3rd';
const AUTHORING_TEXTBOOK_ROOT = path.join(process.cwd(), 'course-content/authoring/resources/textbooks', SOURCE_PACKAGE_ID);
const OUTPUT_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const RUNTIME_PROJECTIONS_PATH = path.join(OUTPUT_DIR, 'runtime-resource-projections.jsonl');
const CANDIDATES_PATH = path.join(OUTPUT_DIR, 'textbook-section-grounding-candidates.jsonl');
const CITATION_TARGETS_PATH = path.join(OUTPUT_DIR, 'textbook-section-citation-targets.jsonl');
const LIMITATIONS_PATH = path.join(OUTPUT_DIR, 'textbook-media-grounding-limitations.json');

interface TextbookManifest {
  bookId?: string;
  updatedAt?: string;
  title?: string;
  chapters?: Array<{
    id?: string;
    number?: number;
    title?: string;
    manifestPath?: string;
    markdownSha256?: string;
  }>;
}

interface ChapterManifest {
  id?: string;
  number?: number;
  title?: string;
  sourcePageStart?: number;
  sourcePageEnd?: number;
  sourcePageCount?: number;
  markdownSha256?: string;
}

const CHAPTER_BINDINGS: Record<number, { knowledgeNodeRefs: string[]; capabilityTargetRefs: string[] }> = {
  1: {
    knowledgeNodeRefs: ['自动控制系统_1_9678f418', '反馈控制系统_1_98dc667a'],
    capabilityTargetRefs: ['controlModeling'],
  },
  2: {
    knowledgeNodeRefs: ['动态数学模型_2_b7f98344', '传递函数_2_2c5e2589'],
    capabilityTargetRefs: ['controlModeling'],
  },
  3: {
    knowledgeNodeRefs: ['时域响应_1_1', '稳定性_1_1'],
    capabilityTargetRefs: ['diagnosticAssessment'],
  },
  4: {
    knowledgeNodeRefs: ['根轨迹_4_1', '闭环极点_4_1'],
    capabilityTargetRefs: ['parameterDesign'],
  },
  5: {
    knowledgeNodeRefs: ['频率特性_5_1', '相位裕度_5_1'],
    capabilityTargetRefs: ['engineeringDecision'],
  },
  6: {
    knowledgeNodeRefs: ['控制器_1_1', '校正装置_6_1'],
    capabilityTargetRefs: ['parameterDesign'],
  },
  7: {
    knowledgeNodeRefs: ['离散系统_7_1', '采样控制_7_1'],
    capabilityTargetRefs: ['controlModeling'],
  },
  8: {
    knowledgeNodeRefs: ['非线性系统_8_1', '相平面法_8_1'],
    capabilityTargetRefs: ['engineeringDecision'],
  },
  9: {
    knowledgeNodeRefs: ['状态空间表达式_1_6a8a62c1', '状态反馈_9_1'],
    capabilityTargetRefs: ['controlModeling'],
  },
  10: {
    knowledgeNodeRefs: ['最优控制_10_1', '动态规划_10_1'],
    capabilityTargetRefs: ['engineeringDecision'],
  },
};

async function main() {
  const generatedAt = new Date().toISOString();
  const textbookManifest = await readJson<TextbookManifest>(path.join(AUTHORING_TEXTBOOK_ROOT, 'manifest.json'));
  const textbookDocuments = await buildTextbookDocuments(textbookManifest);
  const mediaProjections = await loadMediaProjectionRows(RUNTIME_PROJECTIONS_PATH);
  const artifacts = buildTextbookMediaGroundingArtifacts({
    sourcePackageId: SOURCE_PACKAGE_ID,
    generatedAt,
    reviewBatchId: `textbook-grounding-${(textbookManifest.updatedAt ?? generatedAt).slice(0, 10)}`,
    textbookDocuments,
    mediaProjections,
    maxLimitationRows: 100,
  });

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await writeJsonl(CANDIDATES_PATH, artifacts.candidates);
  await writeJsonl(CITATION_TARGETS_PATH, artifacts.citationTargets);
  await fs.writeFile(LIMITATIONS_PATH, `${JSON.stringify(artifacts.limitations, null, 2)}\n`, 'utf-8');
  printSummary(artifacts);
}

async function buildTextbookDocuments(manifest: TextbookManifest): Promise<TextbookRuntimeSearchDocument[]> {
  const bookId = manifest.bookId ?? SOURCE_PACKAGE_ID;
  const chapters = manifest.chapters ?? [];
  const documents = await Promise.all(chapters.map(async (chapter): Promise<TextbookRuntimeSearchDocument | null> => {
    if (!chapter.id) return null;
    const chapterManifest = await readJson<ChapterManifest>(
      path.join(AUTHORING_TEXTBOOK_ROOT, chapter.manifestPath ?? `${chapter.id}/manifest.json`),
    );
    const chapterNumber = chapterManifest.number ?? chapter.number ?? null;
    const binding = chapterNumber ? CHAPTER_BINDINGS[chapterNumber] : undefined;
    const sectionId = chapter.id;
    const pageAnchor = pageAnchorFor(chapterManifest);
    const contentHash = chapterManifest.markdownSha256 ?? chapter.markdownSha256 ?? null;
    const title = chapterManifest.title ?? chapter.title ?? sectionId;
    const href = `/course-runtime/resources/textbooks/${bookId}/sections/${sectionId}.md#${pageAnchor}`;
    return {
      id: `${sectionId}__source-window`,
      kind: 'chunk',
      title,
      href,
      text: `${title}，页码范围 ${pageAnchor}。`,
      contentHash,
      resourceProjection: {
        resourceId: `textbook-section:${bookId}:${sectionId}`,
        segmentRef: sectionId,
        citationTargetRef: `${sectionId}__source-window`,
        knowledgeNodeRefs: binding?.knowledgeNodeRefs ?? [],
        capabilityTargetRefs: binding?.capabilityTargetRefs ?? [],
        contentHash,
        versionRefs: buildKaqArtifactVersionRefs({
          resourceProjectionVersion: 'resource-semantic-projection.v1',
          groundingVersion: 'textbook-media-grounding.v1',
        }),
      },
      citationAddress: {
        kind: 'text',
        sourceRefId: `${sectionId}__source-window`,
        href,
        locator: pageAnchor,
        contentHash,
      },
      metadata: {
        bookId,
        sectionId,
        chapterId: chapter.id,
        chapterNumber,
      },
    };
  }));
  return documents.filter((document): document is TextbookRuntimeSearchDocument => Boolean(document));
}

async function loadMediaProjectionRows(filePath: string): Promise<RuntimeResourceProjectionArtifactRow[]> {
  const content = await fs.readFile(filePath, 'utf-8').catch(() => '');
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

function pageAnchorFor(chapter: ChapterManifest): string {
  if (typeof chapter.sourcePageStart === 'number' && typeof chapter.sourcePageEnd === 'number') {
    return `pages-${chapter.sourcePageStart}-${chapter.sourcePageEnd}`;
  }
  if (typeof chapter.number === 'number') return `chapter-${String(chapter.number).padStart(2, '0')}`;
  return chapter.id ?? 'chapter';
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, 'utf-8')) as T;
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

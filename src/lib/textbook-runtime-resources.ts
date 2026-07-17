import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import type {
  TextbookResourceNodeInput,
  TextbookSectionResourceNodeInput,
} from './resource-node-registry';
import type { KaqArtifactVersionRefs } from './kaq-artifact-versioning';

export interface TextbookRuntimeResourceCatalogEntry {
  textbook: TextbookResourceNodeInput;
  sections: TextbookSectionResourceNodeInput[];
}

export interface TextbookRuntimeSearchDocument {
  id: string;
  kind: 'chunk' | 'figure' | string;
  title: string;
  href: string | null;
  text: string | null;
  contentHash: string | null;
  resourceProjection: {
    resourceId: string | null;
    segmentRef: string;
    citationTargetRef?: string | null;
    knowledgeNodeRefs: string[];
    capabilityTargetRefs: string[];
    contentHash?: string | null;
    versionRefs?: KaqArtifactVersionRefs;
  };
  citationAddress?: {
    kind: 'text' | 'image' | 'audio' | 'video' | 'slides' | 'interactive' | 'simulation' | 'arena' | 'external';
    sourceRefId: string;
    href: string | null;
    locator?: string | null;
    contentHash?: string | null;
  };
  metadata: {
    bookId: string;
    sectionId: string;
    chapterId?: string | null;
    chapterNumber?: number | null;
  };
}

interface RuntimeTextbookManifest {
  bookId?: string;
  title?: string;
}

interface RuntimeTextbookSectionIndexEntry {
  id?: string;
  bookId?: string;
  title?: string;
  href?: string;
  contentHash?: string;
  pathPlanning?: {
    pathEligible?: boolean;
    estimatedTimeMinutes?: number;
    knowledgeNodeIds?: string[];
    capabilityTargetRefs?: string[];
  };
}

interface RuntimeTextbookSearchDocumentLine {
  id?: string;
  kind?: string;
  title?: string;
  href?: string | null;
  text?: string | null;
  contentHash?: string | null;
  resourceProjection?: {
    resourceId?: string | null;
    segmentRef?: string | null;
    citationTargetRef?: string | null;
    knowledgeNodeRefs?: string[];
    capabilityTargetRefs?: string[];
    contentHash?: string | null;
    versionRefs?: KaqArtifactVersionRefs;
  };
  citationAddress?: TextbookRuntimeSearchDocument['citationAddress'];
  metadata?: {
    bookId?: string;
    sectionId?: string;
    chapterId?: string | null;
    chapterNumber?: number | null;
  };
}

interface TextbookSectionSemanticOverride {
  knowledgeNodeIds: string[];
  capabilityTargetIds: string[];
}

const TEXTBOOK_RUNTIME_ROOT = path.join(process.cwd(), 'course-content/runtime/resources/textbooks');

function resolveTextbookRuntimeRoot() {
  return process.env.ACT_TEXTBOOK_RUNTIME_ROOT || TEXTBOOK_RUNTIME_ROOT;
}

const TEXTBOOK_SECTION_SEMANTIC_OVERRIDES: Record<string, Record<string, TextbookSectionSemanticOverride>> = {
  'dorf-modern-control-systems': {
    'ch01-preview-001': controlIntro(['selfDirectedLearning']),
    'ch01-desired-outcomes-002': controlIntro(['selfDirectedLearning']),
    'ch01-sec01': controlIntro(['controlModeling']),
    'ch01-sec02': controlIntro(['selfDirectedLearning']),
    'ch01-sec03': controlExamples(['engineeringDecision']),
    'ch01-example-0101': controlExamples(['engineeringDecision']),
    'ch01-example-0103': controlExamples(['engineeringDecision']),
    'ch01-example-0104': controlExamples(['engineeringDecision']),
    'ch01-example-0105': controlExamples(['engineeringDecision']),
    'ch01-example-0106': controlExamples(['engineeringDecision']),
    'ch01-example-0107': controlExamples(['engineeringDecision']),
    'ch01-example-0108': controlExamples(['engineeringDecision']),
    'ch01-sec04': controlDesign(['engineeringDecision']),
    'ch01-sec05': controlDesign(['engineeringDecision', 'parameterDesign']),
    'ch01-sec06': controlDesign(['controlModeling', 'engineeringDecision']),
    'ch01-example-0109': controlExamples(['engineeringDecision']),
    'ch01-example-0110': controlExamples(['engineeringDecision']),
    'ch01-example-0111': controlExamples(['engineeringDecision']),
    'ch01-sec07': controlDesign(['engineeringDecision', 'inquiryReflection']),
    'ch01-sec08': controlDesign(['selfDirectedLearning', 'engineeringDecision']),
    'ch01-sec09': controlDesign(['engineeringDecision']),
    'ch01-example-0112': controlExamples(['engineeringDecision']),
    'ch01-example-0113': controlExamples(['controlModeling']),
    'ch01-example-0114': controlExamples(['engineeringDecision']),
    'ch01-sec10': controlDesign(['controlModeling', 'parameterDesign']),
    'ch01-skills-check-026': controlIntro(['diagnosticAssessment']),
    'ch01-sec11': controlIntro(['selfDirectedLearning']),
    'ch01-skills-check-028': controlIntro(['diagnosticAssessment']),
    'ch01-skills-check-029': controlIntro(['diagnosticAssessment']),
    'ch01-exercises-030': controlIntro(['diagnosticAssessment']),
    'ch01-exercises-031': controlIntro(['diagnosticAssessment']),
    'ch01-problems-032': controlDesign(['diagnosticAssessment']),
    'ch01-problems-033': controlDesign(['diagnosticAssessment']),
    'ch01-problems-034': controlDesign(['diagnosticAssessment']),
    'ch01-advanced-problems-035': controlDesign(['diagnosticAssessment', 'engineeringDecision']),
    'ch01-design-problems-036': controlDesign(['engineeringDecision']),
    'ch01-design-problems-037': controlDesign(['engineeringDecision']),
    'ch01-design-problems-038': controlDesign(['engineeringDecision']),
    'ch01-answers-to-skills-check-039': controlIntro(['selfDirectedLearning']),
    'ch01-terms-and-concepts-040': controlIntro(['selfDirectedLearning']),
    'ch02-preview-001': modelingBasics(['selfDirectedLearning']),
    'ch02-desired-outcomes-002': modelingBasics(['selfDirectedLearning']),
    'ch02-sec01': modelingBasics(['controlModeling']),
    'ch02-sec02': modelingBasics(['controlModeling']),
    'ch02-sec03': modelingBasics(['controlModeling', 'engineeringDecision']),
    'ch02-example-0201': modelingBasics(['controlModeling']),
    'ch02-sec04': transferFunction(['controlModeling']),
    'ch02-sec05': transferFunction(['controlModeling']),
    'ch02-example-0202': transferFunction(['controlModeling']),
    'ch02-example-0203': transferFunction(['controlModeling']),
    'ch02-example-0204': transferFunction(['controlModeling']),
    'ch02-example-0205': transferFunction(['controlModeling']),
    'ch02-sec06': blockDiagram(['controlModeling']),
    'ch02-example-0206': blockDiagram(['controlModeling']),
    'ch02-sec07': signalFlow(['controlModeling']),
    'ch02-example-0207': signalFlow(['controlModeling']),
    'ch02-example-0208': signalFlow(['controlModeling']),
    'ch02-example-0209': signalFlow(['controlModeling']),
    'ch02-example-0210': signalFlow(['controlModeling']),
    'ch02-sec08': modelingDesign(['engineeringDecision']),
    'ch02-example-0211': modelingDesign(['engineeringDecision']),
    'ch02-example-0212': modelingDesign(['controlModeling']),
    'ch02-example-0213': modelingDesign(['engineeringDecision']),
    'ch02-example-0214': modelingDesign(['parameterDesign']),
    'ch02-sec09': modelingDesign(['selfDirectedLearning']),
    'ch02-example-0215': transferFunction(['controlModeling']),
    'ch02-example-0216': blockDiagram(['controlModeling']),
    'ch02-example-0217': blockDiagram(['controlModeling']),
    'ch02-example-0218': blockDiagram(['controlModeling']),
    'ch02-example-0219': signalFlow(['controlModeling']),
    'ch02-example-0220': modelingDesign(['engineeringDecision']),
    'ch02-sec10': modelingDesign(['controlModeling', 'parameterDesign']),
    'ch02-sec11': modelingBasics(['selfDirectedLearning']),
    'ch02-skills-check-034': modelingBasics(['diagnosticAssessment']),
    'ch02-exercises-035': modelingBasics(['diagnosticAssessment']),
    'ch02-problems-036': modelingBasics(['diagnosticAssessment']),
    'ch02-advanced-problems-037': modelingDesign(['diagnosticAssessment', 'engineeringDecision']),
    'ch02-design-problems-038': modelingDesign(['engineeringDecision']),
    'ch02-computer-problems-039': modelingDesign(['selfDirectedLearning']),
    'ch02-answers-to-skills-check-040': modelingBasics(['selfDirectedLearning']),
    'ch02-terms-and-concepts-041': modelingBasics(['selfDirectedLearning']),
    'ch03-preview-001': stateSpace(['selfDirectedLearning']),
    'ch03-desired-outcomes-002': stateSpace(['selfDirectedLearning']),
    'ch03-sec01': stateSpace(['controlModeling']),
    'ch03-sec02': stateSpace(['controlModeling']),
    'ch03-sec03': stateSpace(['controlModeling']),
    'ch03-example-0301': stateSpace(['controlModeling']),
    'ch03-sec04': stateSpaceGraph(['controlModeling']),
    'ch03-example-0302': stateSpace(['controlModeling']),
    'ch03-sec05': stateSpaceGraph(['controlModeling']),
    'ch03-example-0303': stateSpace(['engineeringDecision', 'controlModeling']),
    'ch03-sec06': stateTransfer(['controlModeling']),
    'ch03-example-0304': stateTransfer(['controlModeling']),
    'ch03-sec07': stateTransition(['controlModeling']),
    'ch03-example-0305': stateTransition(['controlModeling']),
    'ch03-sec08': stateDesign(['engineeringDecision']),
    'ch03-example-0306': stateDesign(['engineeringDecision']),
    'ch03-example-0307': stateDesign(['controlModeling']),
    'ch03-sec09': stateDesign(['selfDirectedLearning']),
    'ch03-sec10': stateDesign(['controlModeling', 'parameterDesign']),
    'ch03-sec11': stateSpace(['selfDirectedLearning']),
    'ch03-skills-check-021': stateSpace(['diagnosticAssessment']),
    'ch03-exercises-022': stateSpace(['diagnosticAssessment']),
    'ch03-problems-023': stateSpace(['diagnosticAssessment']),
    'ch03-advanced-problems-024': stateDesign(['diagnosticAssessment', 'engineeringDecision']),
    'ch03-design-problems-025': stateDesign(['engineeringDecision']),
    'ch03-computer-problems-026': stateDesign(['selfDirectedLearning']),
    'ch03-answers-to-skills-check-027': stateSpace(['selfDirectedLearning']),
    'ch03-terms-and-concepts-028': stateSpace(['selfDirectedLearning']),
  },
};

export async function loadAllTextbookRuntimeResourceCatalogEntries(
  root = resolveTextbookRuntimeRoot(),
): Promise<TextbookRuntimeResourceCatalogEntry[]> {
  const bookDirs = await safeReadDir(root);
  const entries = await Promise.all(bookDirs.map((dirent) =>
    dirent.isDirectory() ? loadTextbookRuntimeResourceCatalogEntry(path.join(root, dirent.name)) : null
  ));
  return entries.filter((entry): entry is TextbookRuntimeResourceCatalogEntry => Boolean(entry));
}

export async function loadAllTextbookRuntimeSearchDocuments(
  root = resolveTextbookRuntimeRoot(),
): Promise<TextbookRuntimeSearchDocument[]> {
  const bookDirs = await safeReadDir(root);
  const entries = await Promise.all(bookDirs.map((dirent) =>
    dirent.isDirectory() ? loadTextbookRuntimeSearchDocuments(path.join(root, dirent.name)) : []
  ));
  return entries.flat();
}

async function loadTextbookRuntimeSearchDocuments(bookDir: string): Promise<TextbookRuntimeSearchDocument[]> {
  const manifest = await readJson<RuntimeTextbookManifest>(path.join(bookDir, 'manifest.json'));
  const fallbackBookId = manifest?.bookId ?? path.basename(bookDir);
  const lines = await readJsonl<RuntimeTextbookSearchDocumentLine>(path.join(bookDir, 'search-documents.jsonl'));
  return lines.flatMap((line) => {
    const bookId = line.metadata?.bookId ?? fallbackBookId;
    const sectionId = line.metadata?.sectionId ?? line.resourceProjection?.segmentRef ?? null;
    if (!line.id || !sectionId) return [];
    const projection = line.resourceProjection ?? {};
    const semantic = TEXTBOOK_SECTION_SEMANTIC_OVERRIDES[bookId]?.[sectionId];
    const knowledgeNodeRefs = projection.knowledgeNodeRefs?.length
      ? projection.knowledgeNodeRefs
      : semantic?.knowledgeNodeIds ?? [];
    const capabilityTargetRefs = projection.capabilityTargetRefs?.length
      ? projection.capabilityTargetRefs
      : semantic?.capabilityTargetIds ?? [];
    return [{
      id: line.id,
      kind: line.kind ?? 'chunk',
      title: line.title ?? line.id,
      href: line.href ?? null,
      text: line.text ?? null,
      contentHash: line.contentHash ?? projection.contentHash ?? line.citationAddress?.contentHash ?? null,
      resourceProjection: {
        resourceId: `textbook-section:${bookId}:${sectionId}`,
        segmentRef: sectionId,
        citationTargetRef: projection.citationTargetRef ?? line.id,
        knowledgeNodeRefs,
        capabilityTargetRefs,
        contentHash: projection.contentHash ?? line.contentHash ?? null,
        versionRefs: projection.versionRefs,
      },
      citationAddress: line.citationAddress,
      metadata: {
        bookId,
        sectionId,
        chapterId: line.metadata?.chapterId ?? null,
        chapterNumber: line.metadata?.chapterNumber ?? null,
      },
    }];
  });
}

async function loadTextbookRuntimeResourceCatalogEntry(
  bookDir: string,
): Promise<TextbookRuntimeResourceCatalogEntry | null> {
  const manifestPath = path.join(bookDir, 'manifest.json');
  const manifest = await readJson<RuntimeTextbookManifest>(manifestPath);
  const bookId = manifest?.bookId ?? path.basename(bookDir);
  const title = manifest?.title ?? bookId;
  const sectionLines = await readJsonl<RuntimeTextbookSectionIndexEntry>(path.join(bookDir, 'section-index.jsonl'));
  const sections = sectionLines
    .filter((section) => section.id && section.href)
    .map((section) => {
      const semantic = TEXTBOOK_SECTION_SEMANTIC_OVERRIDES[bookId]?.[section.id as string];
      return {
        bookId,
        sectionId: section.id as string,
        title: section.title || section.id as string,
        citationHref: section.href as string,
        sourceHash: section.contentHash ? `sha256:${section.contentHash}` : null,
        sourceVersionRef: 'textbook-runtime-section-index.v1',
        knowledgeNodeIds: semantic?.knowledgeNodeIds ?? section.pathPlanning?.knowledgeNodeIds ?? [],
        capabilityTargetIds: semantic?.capabilityTargetIds ?? section.pathPlanning?.capabilityTargetRefs ?? [],
        estimatedTimeMinutes: section.pathPlanning?.estimatedTimeMinutes ?? null,
        planningOverride: section.pathPlanning?.pathEligible === false
          ? {
            teacherPolicy: 'blocked' as const,
            terminalConstraints: ['textbook-section-not-path-eligible'],
          }
          : undefined,
      };
    });

  return {
    textbook: {
      bookId,
      title,
      sourceHref: `/course-runtime/resources/textbooks/${bookId}`,
      sourceHash: await sha256File(manifestPath),
      sourceVersionRef: 'textbook-runtime-manifest.v1',
      knowledgeNodeIds: uniqueSorted(sections.flatMap((section) => section.knowledgeNodeIds ?? [])),
      planningOverride: {
        evidenceInstrumentation: ['textbook_catalog_view'],
      },
    },
    sections,
  };
}

async function sha256File(filePath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath);
    return `sha256:${createHash('sha256').update(content).digest('hex')}`;
  } catch {
    return null;
  }
}

function controlIntro(capabilityTargetIds: string[]): TextbookSectionSemanticOverride {
  return {
    knowledgeNodeIds: ['自动控制系统_1_9678f418', '反馈控制系统_1_98dc667a', '课程总图_1_1'],
    capabilityTargetIds,
  };
}

function controlExamples(capabilityTargetIds: string[]): TextbookSectionSemanticOverride {
  return {
    knowledgeNodeIds: ['自动控制系统_1_9678f418', '被控对象_1_d156fc34', '反馈控制系统_1_98dc667a'],
    capabilityTargetIds,
  };
}

function controlDesign(capabilityTargetIds: string[]): TextbookSectionSemanticOverride {
  return {
    knowledgeNodeIds: ['性能指标_1_1', '控制器_1_1', '工程指标代价函数翻译_4_47003'],
    capabilityTargetIds,
  };
}

function modelingBasics(capabilityTargetIds: string[]): TextbookSectionSemanticOverride {
  return {
    knowledgeNodeIds: ['动态数学模型_2_b7f98344', '微分方程_2_775c96a3', '机理建模_1_2'],
    capabilityTargetIds,
  };
}

function transferFunction(capabilityTargetIds: string[]): TextbookSectionSemanticOverride {
  return {
    knowledgeNodeIds: ['传递函数_2_2c5e2589', '零初值传递函数_2_21001', '拉氏变换_2_243496d4'],
    capabilityTargetIds,
  };
}

function blockDiagram(capabilityTargetIds: string[]): TextbookSectionSemanticOverride {
  return {
    knowledgeNodeIds: ['结构图_2_3f312ccc', '结构图等效变换_2_12001', '闭环传递函数_2_5399c369'],
    capabilityTargetIds,
  };
}

function signalFlow(capabilityTargetIds: string[]): TextbookSectionSemanticOverride {
  return {
    knowledgeNodeIds: ['信号流图_2_372d4084', '梅森增益公式_2_419eab0c', '余子式接触判定_2_21003'],
    capabilityTargetIds,
  };
}

function modelingDesign(capabilityTargetIds: string[]): TextbookSectionSemanticOverride {
  return {
    knowledgeNodeIds: ['动态数学模型_2_b7f98344', '传递函数_2_2c5e2589', '工程指标代价函数翻译_4_47003'],
    capabilityTargetIds,
  };
}

function stateSpace(capabilityTargetIds: string[]): TextbookSectionSemanticOverride {
  return {
    knowledgeNodeIds: ['状态空间表达式_1_6a8a62c1', '状态变量_9_2dedb9d8', '状态空间_9_98b2feda'],
    capabilityTargetIds,
  };
}

function stateSpaceGraph(capabilityTargetIds: string[]): TextbookSectionSemanticOverride {
  return {
    knowledgeNodeIds: ['状态空间表达式_1_6a8a62c1', '信号流图_2_372d4084', '结构图_2_3f312ccc'],
    capabilityTargetIds,
  };
}

function stateTransfer(capabilityTargetIds: string[]): TextbookSectionSemanticOverride {
  return {
    knowledgeNodeIds: ['状态空间表达式_9_477dfe0d', '传递函数矩阵_9_a5fa7369', '传递函数_2_2c5e2589'],
    capabilityTargetIds,
  };
}

function stateTransition(capabilityTargetIds: string[]): TextbookSectionSemanticOverride {
  return {
    knowledgeNodeIds: ['状态转移矩阵_9_dca84f8f', '状态轨迹_9_f787a0a5', '状态空间_9_98b2feda'],
    capabilityTargetIds,
  };
}

function stateDesign(capabilityTargetIds: string[]): TextbookSectionSemanticOverride {
  return {
    knowledgeNodeIds: ['状态空间表达式_9_477dfe0d', '动态数学模型_2_b7f98344', '工程指标代价函数翻译_4_47003'],
    capabilityTargetIds,
  };
}

async function safeReadDir(dir: string) {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function readJsonl<T>(filePath: string): Promise<T[]> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

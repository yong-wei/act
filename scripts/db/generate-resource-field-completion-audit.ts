import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  loadAllTextbookRuntimeResourceCatalogEntries,
  loadAllTextbookRuntimeSearchDocuments,
} from '@/lib/textbook-runtime-resources';
import {
  buildResourceFieldCompletionAudit,
  type ResourceFieldCompletionCandidate,
} from '@/lib/resource-field-completion-audit';
import { getAllRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';
import { buildResourceNodeRegistryFromTeachingResources } from '@/lib/teacher-resource-node-data';
import { buildRuntimeResourceProjectionArtifacts } from '@/lib/runtime-resource-projections';

const OUTPUT_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const AUDIT_JSONL_PATH = path.join(OUTPUT_DIR, 'resource-field-completion-audit.jsonl');
const SUMMARY_JSON_PATH = path.join(OUTPUT_DIR, 'resource-field-completion-summary.json');
const PROJECTION_JSONL_PATH = path.join(OUTPUT_DIR, 'runtime-resource-projections.jsonl');
const PROJECTION_LIMITATIONS_PATH = path.join(OUTPUT_DIR, 'runtime-resource-projection-limitations.json');
const RUNTIME_LESSONS_DIR = path.join(process.cwd(), 'course-content/runtime/lessons');
const RUNTIME_KNOWLEDGE_CARDS_DIR = path.join(process.cwd(), 'course-content/runtime/knowledge/cards/nodes');
const INFOGRAPH_MANIFEST_PATH = path.join(process.cwd(), 'course-content/runtime/knowledge/infographs/manifest.json');
const AUTHORING_TEXTBOOK_ROOT = path.join(process.cwd(), 'course-content/authoring/resources/textbooks');
const STUDENT_VISIBLE_AUDIT_PRIVACY_SCOPE = 'student-visible' satisfies ResourceFieldCompletionCandidate['privacyScope'];
const UNCLASSIFIED_AUDIT_PRIVACY_SCOPE = null satisfies ResourceFieldCompletionCandidate['privacyScope'];

interface RuntimeInteractiveManifest {
  lesson_id?: string;
  course_title?: string;
  course_route_segment?: string;
  preview_mode?: {
    student_demo_base_path?: string;
  };
  steps?: Record<string, {
    title?: string;
    modules?: RuntimeInteractiveModule[];
    telemetry_spec?: unknown;
    ai_context_spec?: unknown;
    acceptance_checks?: unknown;
    preview_contract?: {
      demo_path?: string;
    };
    preview?: {
      student?: string;
    };
  }>;
}

interface RuntimeInteractiveModule {
  id?: string;
  kind?: string;
  payload?: {
    src?: string;
    caption?: string;
    title?: string;
  };
}

interface RuntimeLessonCatalogEntry {
  lesson: {
    lesson_id: string;
    title: string;
  };
  graphOverlay: {
    lesson_id: string;
    focus_node_ids: string[];
    entry_nodes?: string[];
    summary_nodes?: string[];
    card_order: string[];
    groups: Array<{ step_ids: string[]; node_ids: string[] }>;
    nodes: Array<{ id: string; name: string }>;
  };
  handoutPath: string;
  handoutSourcePath: string;
  handoutPdfPath: string | null;
  mediaResources: Array<{
    id: string;
    title: string;
    kind: string;
    url: string | null;
    filename: string | null;
  }>;
}

interface RuntimeLessonJson {
  lesson_id?: string;
  title?: string;
  handout_path?: string;
  handout_pdf_path?: string | null;
  card_order?: string[];
  sequence?: {
    groups?: Array<{ step_ids: string[]; node_ids: string[] }>;
  };
}

interface RuntimeGraphOverlay {
  lesson_id?: string;
  focus_node_ids?: string[];
  entry_nodes?: string[];
  summary_nodes?: string[];
  card_order?: string[];
  groups?: Array<{ step_ids: string[]; node_ids: string[] }>;
  nodes?: Array<{ id: string; name: string }>;
}

interface RuntimeLessonDir {
  lessonKey: string;
  lessonDir: string;
}

interface InteractiveCourseRouteIndex {
  baseSegments: ReadonlySet<string>;
  studentSegments: ReadonlySet<string>;
  teacherSegments: ReadonlySet<string>;
}

interface InfographManifest {
  items?: Array<{
    path?: string;
    url?: string;
    title?: string;
    nodeId?: string;
    sourceNodeId?: string;
  }>;
}

interface AuthoringTextbookChapterManifest {
  id?: string;
  number?: number;
  title?: string;
  pipeline?: string;
  textbookPath?: string;
  sourceMarkdown?: string;
  sourcePageStart?: number;
  sourcePageEnd?: number;
  markdownSha256?: string;
  images?: Array<{
    index?: number;
    sourcePath?: string;
    exportPath?: string;
    caption?: string;
    sourcePdfPage?: number;
    sha256?: string;
  }>;
}

async function main() {
  const generatedAt = new Date().toISOString();
  const [runtimeLessons, runtimeTextbooks, textbookDocuments] = await Promise.all([
    collectRuntimeLessonCatalogEntries(),
    loadAllTextbookRuntimeResourceCatalogEntries().catch(() => []),
    loadAllTextbookRuntimeSearchDocuments().catch(() => []),
  ]);
  const registry = buildResourceNodeRegistryFromTeachingResources(
    [],
    getAllRegisteredResourceMetadata(),
    runtimeLessons,
    runtimeTextbooks,
  );
  const { candidates, limitations } = await collectAuditOnlyCandidates(textbookDocuments);
  const result = buildResourceFieldCompletionAudit({
    registry,
    candidates,
    generatedAt,
    sourceWindow: { from: null, to: generatedAt },
    limitations,
  });
  const projectionArtifacts = buildRuntimeResourceProjectionArtifacts({
    auditRows: result.rows,
    generatedAt,
  });

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(
    AUDIT_JSONL_PATH,
    `${result.rows.map((row) => JSON.stringify(row)).join('\n')}\n`,
    'utf8',
  );
  await fs.writeFile(SUMMARY_JSON_PATH, `${JSON.stringify(result.summary, null, 2)}\n`, 'utf8');
  await fs.writeFile(
    PROJECTION_JSONL_PATH,
    `${projectionArtifacts.rows.map((row) => JSON.stringify(row)).join('\n')}\n`,
    'utf8',
  );
  await fs.writeFile(
    PROJECTION_LIMITATIONS_PATH,
    `${JSON.stringify(projectionArtifacts.limitations, null, 2)}\n`,
    'utf8',
  );

  console.log(`Resource field completion audit rows: ${result.rows.length}`);
  console.log(`Summary: ${path.relative(process.cwd(), SUMMARY_JSON_PATH)}`);
  console.log(`JSONL: ${path.relative(process.cwd(), AUDIT_JSONL_PATH)}`);
  console.log(`Runtime resource projections: ${projectionArtifacts.rows.length}`);
  console.log(`Projection summary: ${path.relative(process.cwd(), PROJECTION_LIMITATIONS_PATH)}`);
  console.log(`Projection JSONL: ${path.relative(process.cwd(), PROJECTION_JSONL_PATH)}`);
}

async function collectAuditOnlyCandidates(textbookDocuments: Awaited<ReturnType<typeof loadAllTextbookRuntimeSearchDocuments>>) {
  const [
    runtimeManifestCandidates,
    runtimeMediaCandidates,
    knowledgeCardCandidates,
    infographCandidates,
    authoringTextbookCandidates,
  ] = await Promise.all([
    collectRuntimeManifestCandidates(),
    collectRuntimeMediaCandidates(),
    collectKnowledgeCardCandidates(),
    collectInfographCandidates(),
    collectAuthoringTextbookCandidates(),
  ]);
  const textbookDocumentCandidates = textbookDocuments.map<ResourceFieldCompletionCandidate>((document) => ({
    id: `textbook-search-document:${document.id}`,
    title: document.title,
    family: 'textbook-search-document',
    sourcePathOrUrl: document.href,
    sourceRecord: document.metadata.bookId,
    knowledgeNodeIds: document.resourceProjection.knowledgeNodeRefs,
    capabilityTargetIds: document.resourceProjection.capabilityTargetRefs,
    segmentRefs: [document.resourceProjection.segmentRef].filter(Boolean),
    citationTargets: [document.resourceProjection.citationTargetRef ?? document.href].filter((value): value is string => Boolean(value)),
    pathTarget: null,
    evidenceInstrumentation: ['textbook_search_document_retrieved'],
    privacyScope: UNCLASSIFIED_AUDIT_PRIVACY_SCOPE,
    contentHash: document.contentHash,
    versionRef: 'textbook-runtime-search-documents.v1',
    humanConfirmed: false,
  }));

  const limitations = [
    ...runtimeManifestCandidates.limitations,
    ...runtimeMediaCandidates.limitations,
    ...knowledgeCardCandidates.limitations,
    ...infographCandidates.limitations,
    ...authoringTextbookCandidates.limitations,
  ];
  if (textbookDocumentCandidates.length === 0) {
    limitations.push('No textbook runtime search documents were available for authoring textbook section audit.');
  }
  limitations.push('No separate quiz/generated-question/checkpoint runtime source files were found; existing ResourceNode registry rows cover registered quiz, simulation, Arena, and checkpoint records where present.');

  return {
    candidates: [
      ...runtimeManifestCandidates.candidates,
      ...runtimeMediaCandidates.candidates,
      ...knowledgeCardCandidates.candidates,
      ...infographCandidates.candidates,
      ...authoringTextbookCandidates.candidates,
      ...textbookDocumentCandidates,
    ],
    limitations,
  };
}

async function collectRuntimeManifestCandidates() {
  const candidates: ResourceFieldCompletionCandidate[] = [];
  const lessonDirs = await discoverRuntimeLessonDirs();
  const routeIndex = await collectInteractiveCourseRouteIndex();
  for (const { lessonDir, lessonKey } of lessonDirs) {
    const manifestPath = path.join(lessonDir, 'interactive-manifest.json');
    const [manifest, graphOverlay, lesson, manifestHash] = await Promise.all([
      readJson<RuntimeInteractiveManifest>(manifestPath),
      readJson<RuntimeGraphOverlay>(path.join(lessonDir, 'graph-overlay.json')),
      readJson<RuntimeLessonJson>(path.join(lessonDir, 'lesson.json')),
      readLocalFileHash(manifestPath),
    ]);
    if (!manifest?.steps) continue;
    const lessonId = manifest.lesson_id ?? lesson?.lesson_id ?? lessonKey;
    const stepKnowledgeNodeIds = buildRuntimeStepKnowledgeNodeMap(
      graphOverlay?.groups ?? lesson?.sequence?.groups ?? [],
    );
    for (const [stepId, step] of Object.entries(manifest.steps)) {
      const verifiedStepPath = resolveVerifiedRuntimeStepPath({
        manifest,
        lessonId,
        stepId,
        routeIndex,
      });
      candidates.push({
        id: `runtime-step:${lessonId}:${stepId}`,
        title: step.title ?? stepId,
        family: 'runtime-lesson-step',
        sourcePathOrUrl: projectPath(manifestPath),
        sourceRecord: `${lessonId}:${stepId}`,
        knowledgeNodeIds: stepKnowledgeNodeIds.get(stepId) ?? [],
        capabilityTargetIds: [],
        segmentRefs: [stepId],
        citationTargets: [],
        pathTarget: verifiedStepPath,
        evidenceInstrumentation: step.telemetry_spec ? ['interactive_step_event'] : [],
        privacyScope: STUDENT_VISIBLE_AUDIT_PRIVACY_SCOPE,
        generatedBy: step.ai_context_spec ? 'template' : null,
        humanConfirmed: false,
        contentHash: manifestHash,
        versionRef: 'interactive-manifest.v2',
      });
      for (const moduleEntry of step.modules ?? []) {
        const moduleId = moduleEntry.id ?? `${stepId}:${moduleEntry.kind ?? 'module'}`;
        const modulePath = moduleEntry.payload?.src
          ? await resolveCitationTarget(lessonDir, moduleEntry.payload.src)
          : null;
        candidates.push({
          id: `runtime-module:${lessonId}:${stepId}:${moduleId}`,
          title: moduleEntry.payload?.title ?? moduleEntry.kind ?? moduleId,
          family: 'runtime-lesson-module',
          sourcePathOrUrl: projectPath(manifestPath),
          sourceRecord: `${lessonId}:${stepId}:${moduleId}`,
          knowledgeNodeIds: [],
          capabilityTargetIds: [],
          segmentRefs: [stepId, moduleId],
          citationTargets: modulePath ? [modulePath] : [],
          pathTarget: null,
          evidenceInstrumentation: moduleEntry.kind?.startsWith('interaction.') ? ['interactive_module_event'] : [],
          privacyScope: STUDENT_VISIBLE_AUDIT_PRIVACY_SCOPE,
          generatedBy: 'template',
          humanConfirmed: false,
          contentHash: manifestHash,
          versionRef: 'interactive-manifest.v2',
        });
      }
    }
  }
  return {
    candidates,
    limitations: candidates.length === 0 ? ['No runtime interactive lesson steps were found.'] : [],
  };
}

async function collectInteractiveCourseRouteIndex(): Promise<InteractiveCourseRouteIndex> {
  const routesDir = path.join(process.cwd(), 'src/app/interactive-learning/courses');
  const entries = await safeReadDir(routesDir);
  const baseSegments: string[] = [];
  const studentSegments: string[] = [];
  const teacherSegments: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const courseDir = path.join(routesDir, entry.name);
    if (await fileExists(path.join(courseDir, 'page.tsx'))) baseSegments.push(entry.name);
    if (await fileExists(path.join(courseDir, 'student/[sessionId]/page.tsx'))) studentSegments.push(entry.name);
    if (await fileExists(path.join(courseDir, 'teacher/[sessionId]/page.tsx'))) teacherSegments.push(entry.name);
  }
  return {
    baseSegments: sortedSet(baseSegments),
    studentSegments: sortedSet(studentSegments),
    teacherSegments: sortedSet(teacherSegments),
  };
}

function resolveVerifiedRuntimeStepPath(input: {
  manifest: RuntimeInteractiveManifest;
  lessonId: string;
  stepId: string;
  routeIndex: InteractiveCourseRouteIndex;
}) {
  const candidates = [
    input.manifest.steps?.[input.stepId]?.preview_contract?.demo_path,
    input.manifest.preview_mode?.student_demo_base_path
      ? `${input.manifest.preview_mode.student_demo_base_path}?step=${encodeURIComponent(input.stepId)}`
      : null,
    input.manifest.course_route_segment
      ? `/interactive-learning/courses/${input.manifest.course_route_segment}/student/demo?step=${encodeURIComponent(input.stepId)}`
      : null,
    inferRouteSegmentFromLessonId(input.lessonId, input.routeIndex.baseSegments)
      ? `/interactive-learning/courses/${inferRouteSegmentFromLessonId(input.lessonId, input.routeIndex.baseSegments)}/student/demo?step=${encodeURIComponent(input.stepId)}`
      : null,
  ];
  return candidates.find((candidate) => isVerifiedInteractiveCoursePath(candidate, input.routeIndex)) ?? null;
}

function inferRouteSegmentFromLessonId(lessonId: string, routeSegments: ReadonlySet<string>) {
  const normalized = lessonId.startsWith('unit-') ? lessonId : `unit-${lessonId}`;
  const matches = Array.from(routeSegments).filter((segment) => segment === lessonId || segment.startsWith(`${normalized}-`));
  return matches.length === 1 ? matches[0] : null;
}

function isVerifiedInteractiveCoursePath(pathTarget: string | null | undefined, routeIndex: InteractiveCourseRouteIndex) {
  if (!pathTarget) return false;
  const match = pathTarget.match(/^\/interactive-learning\/courses\/([^/?#]+)(?:\/([^?#]*))?(?:[?#].*)?$/);
  if (!match?.[1]) return false;
  const [, segment, subpath = ''] = match;
  if (!subpath) return routeIndex.baseSegments.has(segment);
  const parts = subpath.split('/').filter(Boolean);
  if (parts.length === 2 && parts[0] === 'student') return routeIndex.studentSegments.has(segment);
  if (parts.length === 2 && parts[0] === 'teacher') return routeIndex.teacherSegments.has(segment);
  return false;
}

function sortedSet(values: string[]) {
  return new Set(values.sort((left, right) => left.localeCompare(right)));
}

async function collectRuntimeMediaCandidates() {
  const candidates: ResourceFieldCompletionCandidate[] = [];
  const lessonDirs = await discoverRuntimeLessonDirs();
  for (const { lessonDir, lessonKey } of lessonDirs) {
    const mediaDir = path.join(lessonDir, 'media');
    const files = await collectFiles(mediaDir);
    for (const absolutePath of files.filter((file) => !file.endsWith('.md'))) {
      const relativePath = projectPath(absolutePath);
      const basename = path.basename(absolutePath);
      const mediaRelativePath = path.relative(mediaDir, absolutePath).split(path.sep).join('/');
      const contentHash = `sha256:${sha256(await fs.readFile(absolutePath))}`;
      candidates.push({
        id: `runtime-media:${lessonKey}:${mediaRelativePath}`,
        title: basename,
        family: 'runtime-lesson-media',
        sourcePathOrUrl: relativePath,
        sourceRecord: `${lessonKey}:${mediaRelativePath}`,
        knowledgeNodeIds: [],
        capabilityTargetIds: [],
        segmentRefs: [mediaRelativePath],
        citationTargets: [relativePath],
        pathTarget: `/course-runtime/lessons/${lessonKey}/media/${mediaRelativePath}`,
        evidenceInstrumentation: [],
        privacyScope: STUDENT_VISIBLE_AUDIT_PRIVACY_SCOPE,
        generatedBy: 'external-tool',
        humanConfirmed: false,
        contentHash,
        versionRef: 'runtime-lesson-media.v1',
      });
    }
  }
  return {
    candidates,
    limitations: candidates.length === 0 ? ['No runtime lesson media files were found.'] : [],
  };
}

async function collectRuntimeLessonCatalogEntries(): Promise<RuntimeLessonCatalogEntry[]> {
  const entries: RuntimeLessonCatalogEntry[] = [];
  const lessonDirs = await discoverRuntimeLessonDirs();
  for (const { lessonDir, lessonKey } of lessonDirs) {
    const [lesson, graphOverlay, mediaResources] = await Promise.all([
      readJson<RuntimeLessonJson>(path.join(lessonDir, 'lesson.json')),
      readJson<RuntimeGraphOverlay>(path.join(lessonDir, 'graph-overlay.json')),
      collectRuntimeLessonMediaResources(lessonKey, lessonDir),
    ]);
    if (!lesson || !graphOverlay) continue;
    const sourceLessonId = lesson.lesson_id ?? graphOverlay.lesson_id ?? lessonKey;
    const registryLessonId = lessonKey.includes('/') ? lessonKey : sourceLessonId;
    const handoutSourcePath = path.join('course-content/runtime/lessons', lessonKey, `${sourceLessonId}-handout.md`);
    const fallbackHandoutSourcePath = path.join('course-content/runtime/lessons', lessonKey, 'handout.md');
    const handoutPath = lesson.handout_path ?? `/course-runtime/lessons/${lessonKey}/${sourceLessonId}-handout.md`;
    const handoutPdfPath = await fileExists(path.join(lessonDir, `${sourceLessonId}-handout.pdf`))
      ? lesson.handout_pdf_path ?? `/course-runtime/lessons/${lessonKey}/${sourceLessonId}-handout.pdf`
      : null;
    entries.push({
      lesson: {
        lesson_id: registryLessonId,
        title: lesson.title ?? sourceLessonId,
      },
      graphOverlay: {
        lesson_id: registryLessonId,
        focus_node_ids: graphOverlay.focus_node_ids ?? [],
        entry_nodes: graphOverlay.entry_nodes ?? [],
        summary_nodes: graphOverlay.summary_nodes ?? [],
        card_order: graphOverlay.card_order ?? lesson.card_order ?? [],
        groups: graphOverlay.groups ?? lesson.sequence?.groups ?? [],
        nodes: graphOverlay.nodes ?? [],
      },
      handoutPath,
      handoutSourcePath: await fileExists(path.join(process.cwd(), handoutSourcePath))
        ? handoutSourcePath
        : fallbackHandoutSourcePath,
      handoutPdfPath,
      mediaResources,
    });
  }
  return entries.sort((left, right) => left.lesson.lesson_id.localeCompare(right.lesson.lesson_id));
}

async function collectRuntimeLessonMediaResources(lessonDirName: string, lessonDir: string): Promise<RuntimeLessonCatalogEntry['mediaResources']> {
  const mediaDir = path.join(lessonDir, 'media');
  const mediaIndexFiles = (await safeReadDir(mediaDir))
    .filter((entry) => entry.isFile() && entry.name.endsWith('-media.md'))
    .map((entry) => path.join(mediaDir, entry.name))
    .sort((left, right) => left.localeCompare(right));
  const resources: RuntimeLessonCatalogEntry['mediaResources'] = [];

  for (const mediaIndexPath of mediaIndexFiles) {
    const markdown = await readText(mediaIndexPath);
    if (!markdown) continue;
    resources.push(...parseRuntimeLessonMediaResources(markdown, lessonDirName));
  }

  return resources;
}

function parseRuntimeLessonMediaResources(markdown: string, lessonDirName: string): RuntimeLessonCatalogEntry['mediaResources'] {
  const resources: RuntimeLessonCatalogEntry['mediaResources'] = [];
  const lines = markdown.split(/\r?\n/);
  let currentFilename: string | null = null;
  let currentTitle: string | null = null;
  let currentUrl: string | null = null;

  const flushCurrent = () => {
    if (!currentFilename) return;
    if (!isRuntimeHandoutMarkdownFilename(currentFilename)) {
      const kind = inferRuntimeMediaKind(currentFilename);
      resources.push({
        id: normalizeRuntimeMediaId(currentFilename),
        title: currentTitle ?? currentFilename,
        kind,
        url: currentUrl,
        filename: currentFilename,
      });
    }
    currentFilename = null;
    currentTitle = null;
    currentUrl = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      const filename = headingMatch[1].trim();
      flushCurrent();
      if (!isRuntimeMediaIndexFilename(filename)) continue;
      currentFilename = filename;
      continue;
    }
    if (currentFilename && !currentTitle && line.startsWith('- ')) {
      currentTitle = line.slice(2).trim();
      continue;
    }
    if (currentFilename && !currentUrl && /^https?:\/\//i.test(line)) {
      currentUrl = line;
      continue;
    }
  }

  flushCurrent();
  return resources.map((resource) => ({
    ...resource,
    url: resource.url ?? `/course-runtime/lessons/${lessonDirName}/media/${resource.filename}`,
  }));
}

function buildRuntimeStepKnowledgeNodeMap(
  groups: Array<{ step_ids: string[]; node_ids: string[] }>,
): Map<string, string[]> {
  const result = new Map<string, Set<string>>();
  for (const group of groups) {
    for (const stepId of group.step_ids ?? []) {
      if (!result.has(stepId)) result.set(stepId, new Set());
      for (const nodeId of group.node_ids ?? []) {
        if (nodeId) result.get(stepId)?.add(nodeId);
      }
    }
  }
  return new Map(Array.from(result.entries()).map(([stepId, nodeIds]) => [
    stepId,
    Array.from(nodeIds).sort((left, right) => left.localeCompare(right)),
  ]));
}

async function collectInfographCandidates() {
  const manifest = await readJson<InfographManifest>(INFOGRAPH_MANIFEST_PATH);
  const candidates = await Promise.all((manifest?.items ?? []).map(async (item): Promise<ResourceFieldCompletionCandidate> => ({
    id: `infograph:${item.nodeId ?? item.path ?? item.title}`,
    title: item.title ?? item.nodeId ?? 'Untitled infograph',
    family: 'knowledge-infograph',
    sourcePathOrUrl: item.path ?? item.url ?? null,
    sourceRecord: item.sourceNodeId ?? item.nodeId ?? null,
    knowledgeNodeIds: [item.nodeId ?? item.sourceNodeId].filter((value): value is string => Boolean(value)),
    capabilityTargetIds: [],
    segmentRefs: [],
    citationTargets: [item.url].filter((value): value is string => Boolean(value)),
    pathTarget: item.url ?? null,
    evidenceInstrumentation: [],
    privacyScope: STUDENT_VISIBLE_AUDIT_PRIVACY_SCOPE,
    generatedBy: 'external-tool',
    humanConfirmed: false,
    contentHash: item.path ? await readLocalFileHash(item.path) : null,
    versionRef: 'knowledge-infograph-manifest.v1',
  })));
  return {
    candidates,
    limitations: candidates.length === 0 ? ['No knowledge infograph manifest items were found.'] : [],
  };
}

async function collectKnowledgeCardCandidates() {
  const files = await collectFiles(RUNTIME_KNOWLEDGE_CARDS_DIR);
  const candidates: ResourceFieldCompletionCandidate[] = [];
  for (const filePath of files.filter((file) => file.endsWith('.md'))) {
    const markdown = await readText(filePath);
    const sourcePath = projectPath(filePath);
    const nodeId = path.basename(filePath, '.md');
    candidates.push({
      id: `knowledge-card:${nodeId}`,
      title: extractMarkdownTitle(markdown) ?? nodeId,
      family: 'knowledge-card',
      sourcePathOrUrl: sourcePath,
      sourceRecord: nodeId,
      knowledgeNodeIds: [nodeId],
      capabilityTargetIds: [],
      segmentRefs: [nodeId],
      citationTargets: [sourcePath],
      pathTarget: `/knowledge?node=${encodeURIComponent(nodeId)}`,
      evidenceInstrumentation: [],
      privacyScope: STUDENT_VISIBLE_AUDIT_PRIVACY_SCOPE,
      generatedBy: 'template',
      humanConfirmed: false,
      contentHash: markdown ? `sha256:${sha256(markdown)}` : null,
      versionRef: 'runtime-knowledge-card.v1',
    });
  }
  return {
    candidates,
    limitations: candidates.length === 0 ? ['No runtime knowledge card markdown files were found.'] : [],
  };
}

async function collectAuthoringTextbookCandidates() {
  const candidates: ResourceFieldCompletionCandidate[] = [];
  const manifestPaths = await collectFiles(AUTHORING_TEXTBOOK_ROOT);
  for (const manifestPath of manifestPaths.filter((file) => file.endsWith('/manifest.json'))) {
    const manifest = await readJson<AuthoringTextbookChapterManifest>(manifestPath);
    if (!manifest?.id) continue;
    const chapterSource = projectPath(manifestPath);
    const chapterDir = path.dirname(manifestPath);
    const bookId = path.basename(path.dirname(path.dirname(manifestPath)));
    const chapterId = `${bookId}:${manifest.id}`;
    const manifestHash = await readLocalFileHash(manifestPath);
    const chapterCitationTargets = await resolveCitationTargets(chapterDir, [
      manifest.sourceMarkdown,
      manifest.textbookPath,
    ]);
    candidates.push({
      id: `authoring-textbook-chapter:${chapterId}`,
      title: manifest.title ?? manifest.id,
      family: 'authoring-textbook-chapter',
      sourcePathOrUrl: chapterSource,
      sourceRecord: chapterId,
      knowledgeNodeIds: [],
      capabilityTargetIds: [],
      segmentRefs: [manifest.id],
      citationTargets: chapterCitationTargets,
      pathTarget: null,
      evidenceInstrumentation: [],
      privacyScope: UNCLASSIFIED_AUDIT_PRIVACY_SCOPE,
      generatedBy: manifest.pipeline ? 'external-tool' : null,
      humanConfirmed: false,
      contentHash: manifestHash,
      versionRef: 'authoring-textbook-manifest.v1',
    });
    const sectionCandidates = await collectAuthoringTextbookSectionCandidates({
      bookId,
      chapterId,
      chapterDir,
      manifest,
    });
    candidates.push(...sectionCandidates);
    for (const image of manifest.images ?? []) {
      const imageId = `${chapterId}:figure-${image.index ?? image.exportPath ?? 'unknown'}`;
      const exportPath = image.exportPath
        ? path.join(path.dirname(chapterSource), image.exportPath)
        : null;
      candidates.push({
        id: `authoring-textbook-figure:${imageId}`,
        title: `Figure ${image.index ?? image.exportPath ?? 'unknown'}`,
        family: 'authoring-textbook-figure',
        sourcePathOrUrl: exportPath,
        sourceRecord: image.sourcePath ?? chapterId,
        knowledgeNodeIds: [],
        capabilityTargetIds: [],
        segmentRefs: [manifest.id, String(image.index ?? '')].filter(Boolean),
        citationTargets: exportPath ? [exportPath] : [],
        pathTarget: null,
        evidenceInstrumentation: [],
        privacyScope: UNCLASSIFIED_AUDIT_PRIVACY_SCOPE,
        generatedBy: manifest.pipeline ? 'external-tool' : null,
        humanConfirmed: false,
        contentHash: image.sha256 ?? null,
        versionRef: 'authoring-textbook-manifest.v1',
      });
      candidates.push({
        id: `authoring-textbook-caption:${imageId}`,
        title: `Caption ${image.index ?? image.exportPath ?? 'unknown'}`,
        family: 'authoring-textbook-caption',
        sourcePathOrUrl: chapterSource,
        sourceRecord: image.caption ? `caption:${image.index ?? image.exportPath}` : null,
        knowledgeNodeIds: [],
        capabilityTargetIds: [],
        segmentRefs: [manifest.id, String(image.index ?? '')].filter(Boolean),
        citationTargets: exportPath ? [exportPath] : [],
        pathTarget: null,
        evidenceInstrumentation: [],
        privacyScope: UNCLASSIFIED_AUDIT_PRIVACY_SCOPE,
        generatedBy: manifest.pipeline ? 'external-tool' : null,
        humanConfirmed: false,
        contentHash: image.caption ? `sha256:${sha256(image.caption)}` : manifest.markdownSha256 ?? null,
        versionRef: 'authoring-textbook-manifest.v1',
      });
    }
  }
  return {
    candidates,
    limitations: candidates.length === 0 ? ['No authoring textbook chapter, figure, or caption manifests were found.'] : [],
  };
}

async function collectAuthoringTextbookSectionCandidates(input: {
  bookId: string;
  chapterId: string;
  chapterDir: string;
  manifest: AuthoringTextbookChapterManifest;
}): Promise<ResourceFieldCompletionCandidate[]> {
  if (!input.manifest.textbookPath) return [];
  const textbookPath = path.join(input.chapterDir, input.manifest.textbookPath);
  const markdown = await readText(textbookPath);
  if (!markdown) return [];
  const sourcePath = projectPath(textbookPath);
  return markdown
    .split(/\r?\n/)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => /^##\s+\S/.test(line))
    .map(({ line, lineNumber }, index): ResourceFieldCompletionCandidate => {
      const title = line.replace(/^##\s+/, '').trim();
      const sectionId = slugifyAuthoringSection(title, lineNumber, index);
      return {
        id: `authoring-textbook-section:${input.chapterId}:${sectionId}`,
        title,
        family: 'authoring-textbook-section',
        sourcePathOrUrl: sourcePath,
        sourceRecord: `${input.chapterId}:L${lineNumber}`,
        knowledgeNodeIds: [],
        capabilityTargetIds: [],
        segmentRefs: [input.manifest.id ?? input.chapterId, sectionId],
        citationTargets: [`${sourcePath}#L${lineNumber}`],
        pathTarget: null,
        evidenceInstrumentation: [],
        privacyScope: UNCLASSIFIED_AUDIT_PRIVACY_SCOPE,
        generatedBy: input.manifest.pipeline ? 'external-tool' : null,
        humanConfirmed: false,
        contentHash: input.manifest.markdownSha256 ?? null,
        versionRef: 'authoring-textbook-manifest.v1',
      };
    });
}

async function safeReadDir(dir: string) {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function collectFiles(root: string): Promise<string[]> {
  const entries = await safeReadDir(root);
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) return collectFiles(absolutePath);
    if (entry.isFile()) return [absolutePath];
    return [];
  }));
  return nested.flat().sort((left, right) => left.localeCompare(right));
}

async function discoverRuntimeLessonDirs(): Promise<RuntimeLessonDir[]> {
  const lessons: RuntimeLessonDir[] = [];

  async function visit(dir: string) {
    const entries = await safeReadDir(dir);
    const hasLessonJson = entries.some((entry) => entry.isFile() && entry.name === 'lesson.json');
    if (hasLessonJson) {
      lessons.push({
        lessonKey: path.relative(RUNTIME_LESSONS_DIR, dir).split(path.sep).join('/'),
        lessonDir: dir,
      });
      return;
    }

    await Promise.all(entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => visit(path.join(dir, entry.name))));
  }

  await visit(RUNTIME_LESSONS_DIR);
  return lessons.sort((left, right) => left.lessonKey.localeCompare(right.lessonKey));
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readLocalFileHash(sourcePath: string) {
  if (/^https?:\/\//i.test(sourcePath)) return null;
  try {
    const absolutePath = path.isAbsolute(sourcePath)
      ? sourcePath
      : path.join(process.cwd(), sourcePath);
    return `sha256:${sha256(await fs.readFile(absolutePath))}`;
  } catch {
    return null;
  }
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function readText(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

function projectPath(absolutePath: string) {
  return path.relative(process.cwd(), absolutePath);
}

async function resolveCitationTargets(baseDir: string, sources: Array<string | null | undefined>) {
  const resolved = await Promise.all(sources.map((source) => resolveCitationTarget(baseDir, source)));
  return resolved.filter((value): value is string => Boolean(value));
}

async function resolveCitationTarget(baseDir: string, source: string | null | undefined) {
  if (!source) return null;
  if (/^https?:\/\//i.test(source) || source.startsWith('/')) return source;
  const absolutePath = path.isAbsolute(source)
    ? source
    : path.resolve(baseDir, source);
  try {
    await fs.access(absolutePath);
    return projectPath(absolutePath);
  } catch {
    return null;
  }
}

function inferRuntimeMediaKind(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.mp4' || ext === '.webm') return 'video';
  if (ext === '.m4a' || ext === '.mp3' || ext === '.wav') return 'audio';
  if (ext === '.pdf' && /(^|[-_])slides(?:[-_.]|$)/i.test(path.basename(filename))) return 'slides';
  if (ext === '.pdf') return 'pdf';
  return 'other';
}

function normalizeRuntimeMediaId(filename: string) {
  return filename.replace(/\.[^.]+$/, '');
}

function isRuntimeHandoutMarkdownFilename(filename: string) {
  return filename === 'handout.md' || /-handout\.md$/i.test(filename);
}

function isRuntimeMediaIndexFilename(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  if (!ext) return false;
  if (isRuntimeHandoutMarkdownFilename(filename)) return true;
  return ['.mp4', '.webm', '.m4a', '.mp3', '.wav', '.pdf'].includes(ext);
}

function slugifyAuthoringSection(title: string, lineNumber: number, index: number) {
  const compact = title
    .normalize('NFKC')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `${String(index + 1).padStart(3, '0')}-${compact || `line-${lineNumber}`}`;
}

function extractMarkdownTitle(markdown: string | null) {
  if (!markdown) return null;
  const titleLine = markdown.split(/\r?\n/).find((line) => /^#\s+\S/.test(line));
  return titleLine?.replace(/^#\s+/, '').trim() ?? null;
}

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

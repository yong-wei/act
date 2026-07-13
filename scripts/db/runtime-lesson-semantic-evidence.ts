import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const RUNTIME_LESSONS_ROOT = path.join(PROJECT_ROOT, 'course-content/runtime/lessons');

export type RuntimeSemanticRecordKind = 'step' | 'module' | 'media' | 'handout';
export type RuntimeSemanticEvidenceSelectorKind = 'json-pointer' | 'markdown-line' | 'file-sha256';
export type RuntimeSemanticSourceFileKind =
  | 'interactive-manifest'
  | 'graph-overlay'
  | 'markdown'
  | 'binary-media'
  | 'structured-media'
  | 'missing-local-runtime-asset'
  | 'external-media';
export type RuntimeSemanticAssetStatus =
  | 'not-applicable'
  | 'tracked-local-runtime-asset'
  | 'missing-local-runtime-asset'
  | 'external-http-runtime-asset';
export type RuntimeSemanticAssetAvailability =
  | 'not-applicable'
  | 'tracked-in-git-index'
  | 'not-tracked-in-git-index'
  | 'external-media-index-url';
export const RUNTIME_SEMANTIC_ASSET_OBSERVATION_VERSION = 'runtime-lesson-asset-observation.v1' as const;
export const RUNTIME_SEMANTIC_DECISION_VERSION = 'runtime-lesson-media-semantic-decision.v1' as const;
export type RuntimeSemanticSourcePathKind = 'local-path' | 'http-url' | 'none';

export interface RuntimeSemanticAssetObservation {
  schemaVersion: typeof RUNTIME_SEMANTIC_ASSET_OBSERVATION_VERSION;
  localPath: string | null;
  /** Review-time filesystem observation; it is intentionally excluded from canonical status and decision hashes. */
  workingTreePresent: boolean;
  gitIndexTracked: boolean;
  mediaIndexUrlSha256: string | null;
  auditSourcePathOrUrlKind: RuntimeSemanticSourcePathKind;
  auditSourcePathOrUrlSha256: string | null;
}

export interface RuntimeLessonSemanticDecisionFacts {
  sourceFamily: string;
  recordKind: RuntimeSemanticRecordKind;
  source: {
    filePath: string;
    fileKind: RuntimeSemanticSourceFileKind;
    fileExtension: string | null;
    fileHash: string | null;
    assetStatus: RuntimeSemanticAssetStatus;
    assetAvailability: RuntimeSemanticAssetAvailability;
  };
  manifest: {
    path: string | null;
    hash: string | null;
    pointer: string | null;
    recordKey: string;
    mediaKind: string | null;
    moduleKind: string | null;
    childStructure: string[];
  };
  asset: {
    mediaIndexPath: string | null;
    mediaIndexLine: number | null;
    externalIdentitySha256: string | null;
    localPath: string | null;
    gitIndexTracked: boolean | null;
    auditSourcePathOrUrlKind: RuntimeSemanticSourcePathKind;
    auditSourcePathOrUrlSha256: string | null;
  };
  parent: {
    lessonRef: string;
    resourceCandidates: string[];
    resourceRef: string | null;
    planningUnitRef: string | null;
    resolution: RuntimeLessonSemanticReviewEvidence['parent']['resolution'];
  };
  contract: {
    readinessPresent: boolean;
    estimatedTimeMinutes: number | null;
    citationTargets: string[];
    graphNodeRefs: {
      knowledge: string[];
      capability: string[];
      quality: string[];
    };
    evidenceDecision: string;
    evidenceContractComplete: boolean;
    evidenceMissingFields: string[];
    evidenceInstrumentation: string[];
    launch: RuntimeLessonSemanticReviewEvidence['launch'];
    evidence: RuntimeLessonSemanticReviewEvidence['evidence'];
  };
}

export interface RuntimeLessonSemanticReviewEvidence {
  schemaVersion: 'runtime-lesson-semantic-evidence.v1';
  recordKind: RuntimeSemanticRecordKind;
  parentLessonRef: string;
  sourceFilePath: string;
  sourceFileKind: RuntimeSemanticSourceFileKind;
  sourceFileExtension: string | null;
  sourceFileHash: string | null;
  evidenceFilePath: string;
  evidenceFileHash: string;
  evidenceSelector: `${RuntimeSemanticEvidenceSelectorKind}:${string}`;
  evidenceMatch: string | null;
  manifestPath: string | null;
  manifestPointer: string | null;
  mediaIndexPath: string | null;
  mediaIndexLine: number | null;
  recordKey: string;
  mediaKind: string | null;
  moduleKind: string | null;
  childStructure: string[];
  interactionKind: string | null;
  telemetryFields: string[];
  evidenceSequence: string[];
  launch: {
    studentPath: string | null;
    teacherPath: string | null;
    pathTarget: string | null;
    available: boolean;
    independent: boolean;
  };
  evidence: {
    decision: string;
    instrumentation: string[];
    independent: boolean;
  };
  parent: {
    resourceRef: string | null;
    planningUnitRef: string | null;
    resolution: 'lesson' | 'resource' | 'planning-unit' | 'none';
    resourceCandidates: string[];
  };
  externalIdentitySha256: string | null;
  assetStatus: RuntimeSemanticAssetStatus;
  assetAvailability: RuntimeSemanticAssetAvailability;
  rawContentIncluded: false;
}

interface JsonRow {
  [key: string]: any;
}

interface RuntimeLessonManifestContext {
  lessonKey: string;
  parentLessonRef: string;
  lessonJson: JsonRow;
  manifestPath: string | null;
  manifest: JsonRow | null;
  manifestHash: string | null;
  graphOverlayPath: string | null;
  graphOverlay: JsonRow | null;
  graphOverlayHash: string | null;
  handoutPath: string | null;
  handoutHash: string | null;
  mediaIndexPath: string | null;
  mediaIndexHash: string | null;
  steps: Map<string, {
    id: string;
    pointer: string;
    value: JsonRow;
    studentPath: string | null;
    teacherPath: string | null;
  }>;
  modules: Map<string, {
    id: string;
    pointer: string;
    stepId: string;
    value: JsonRow;
  }>;
  media: Map<string, {
    id: string;
    filename: string;
    kind: string;
    headingLine: number;
    externalUrl: string | null;
  }>;
}

const contextCache = new Map<string, RuntimeLessonManifestContext>();
const gitIndexPathCache = new Map<string, boolean>();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function projectPath(relativePath: string): string {
  const absolutePath = path.resolve(PROJECT_ROOT, relativePath);
  assert(absolutePath === PROJECT_ROOT || absolutePath.startsWith(`${PROJECT_ROOT}${path.sep}`), `Runtime semantic path escapes project: ${relativePath}`);
  return absolutePath;
}

function fileHash(relativePath: string): string {
  const absolutePath = projectPath(relativePath);
  assert(existsSync(absolutePath), `Runtime semantic evidence file does not exist: ${relativePath}`);
  return `sha256:${createHash('sha256').update(readFileSync(absolutePath)).digest('hex')}`;
}

function isGitIndexPath(relativePath: string): boolean {
  const cached = gitIndexPathCache.get(relativePath);
  if (cached !== undefined) return cached;
  const result = spawnSync('git', ['cat-file', '-e', `:${relativePath}`], {
    cwd: PROJECT_ROOT,
    stdio: 'ignore',
  });
  const tracked = result.status === 0;
  gitIndexPathCache.set(relativePath, tracked);
  return tracked;
}

function readJson(relativePath: string): JsonRow {
  return JSON.parse(readFileSync(projectPath(relativePath), 'utf8')) as JsonRow;
}

function optionalProjectPath(candidates: readonly (string | null | undefined)[]): string | null {
  for (const candidate of candidates) {
    if (!candidate || /^https?:\/\//i.test(candidate)) continue;
    if (existsSync(projectPath(candidate))) return candidate;
  }
  return null;
}

function jsonPointerEscape(value: string): string {
  return value.replace(/~/g, '~0').replace(/\//g, '~1');
}

function jsonPointerValue(document: unknown, pointer: string): unknown {
  assert(pointer === '' || pointer.startsWith('/'), `Invalid JSON Pointer: ${pointer}`);
  let current: any = document;
  if (pointer === '') return current;
  for (const rawSegment of pointer.slice(1).split('/')) {
    const segment = rawSegment.replace(/~1/g, '/').replace(/~0/g, '~');
    assert(current !== null && current !== undefined, `JSON Pointer traversed null at ${pointer}`);
    if (Array.isArray(current)) {
      assert(/^\d+$/.test(segment), `JSON Pointer array segment is not an index: ${pointer}`);
      current = current[Number(segment)];
    } else {
      current = current[segment];
    }
    assert(current !== undefined, `JSON Pointer target does not exist: ${pointer}`);
  }
  return current;
}

function parseEvidenceSelector(selector: string): {
  kind: RuntimeSemanticEvidenceSelectorKind;
  value: string;
} {
  const separator = selector.indexOf(':');
  assert(separator > 0, `Runtime semantic evidence selector lacks kind: ${selector}`);
  const kind = selector.slice(0, separator) as RuntimeSemanticEvidenceSelectorKind;
  const value = selector.slice(separator + 1);
  assert(kind === 'json-pointer' || kind === 'markdown-line' || kind === 'file-sha256', `Unsupported runtime semantic evidence selector: ${selector}`);
  assert(value.length > 0, `Runtime semantic evidence selector is empty: ${selector}`);
  return { kind, value };
}

export function assertRuntimeSemanticEvidenceReference(reference: string): {
  evidenceFilePath: string;
  evidenceFileHash: string;
  selector: string;
  selectorKind: RuntimeSemanticEvidenceSelectorKind;
} {
  assert(typeof reference === 'string' && reference.length > 0, 'Runtime semantic evidence reference is empty');
  const hashIndex = reference.indexOf('#');
  assert(hashIndex > 0 && hashIndex === reference.lastIndexOf('#'), `Runtime semantic evidence reference must contain one fragment: ${reference}`);
  const evidenceFilePath = reference.slice(0, hashIndex);
  const selector = reference.slice(hashIndex + 1);
  assert(!/^https?:\/\//i.test(evidenceFilePath), `Runtime semantic evidence cannot use an external URL as evidence file: ${reference}`);
  const parsed = parseEvidenceSelector(selector);
  const evidenceFileHash = fileHash(evidenceFilePath);
  if (parsed.kind === 'json-pointer') {
    const document = readJson(evidenceFilePath);
    jsonPointerValue(document, parsed.value);
  } else if (parsed.kind === 'markdown-line') {
    const lineNumber = Number(parsed.value);
    assert(Number.isInteger(lineNumber) && lineNumber > 0, `Markdown evidence line is invalid: ${reference}`);
    const lines = readFileSync(projectPath(evidenceFilePath), 'utf8').split(/\r?\n/);
    assert(lineNumber <= lines.length && lines[lineNumber - 1].trim().length > 0, `Markdown evidence line does not exist: ${reference}`);
  } else {
    const normalizedSelectorHash = parsed.value.startsWith('sha256:') ? parsed.value : `sha256:${parsed.value}`;
    assert(/^sha256:[0-9a-f]{64}$/i.test(normalizedSelectorHash), `File evidence selector must contain a sha256: ${reference}`);
    assert(isGitIndexPath(evidenceFilePath), `File evidence selector requires a git-index tracked asset: ${reference}`);
    assert(normalizedSelectorHash.toLowerCase() === evidenceFileHash.toLowerCase(), `File evidence hash mismatch: ${reference}`);
  }
  return { evidenceFilePath, evidenceFileHash, selector, selectorKind: parsed.kind };
}

function normalizeMediaId(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
}

function mediaKind(filename: string): string {
  const extension = path.extname(filename).toLowerCase();
  if (extension === '.mp4' || extension === '.webm') return 'video';
  if (extension === '.m4a' || extension === '.mp3' || extension === '.wav') return 'audio';
  if (extension === '.pdf' && /(^|[-_])slides(?:[-_.]|$)/i.test(path.basename(filename))) return 'slides';
  if (extension === '.pdf') return 'pdf';
  if (['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp'].includes(extension)) return 'image';
  if (['.json', '.csv', '.txt'].includes(extension)) return 'data';
  return 'other';
}

function isMediaHeading(filename: string): boolean {
  return /\.(?:mp4|webm|m4a|mp3|wav|pdf|png|jpg|jpeg|svg|gif|webp|json|csv|txt)$/i.test(filename)
    && !/(?:^|[-_])handout\.md$/i.test(filename);
}

function parseMediaIndex(markdown: string) {
  const entries: RuntimeLessonManifestContext['media'] = new Map();
  const lines = markdown.split(/\r?\n/);
  let current: { filename: string; headingLine: number; externalUrl: string | null } | null = null;
  const flush = () => {
    if (!current) return;
    const id = normalizeMediaId(current.filename);
    if (!entries.has(id)) {
      entries.set(id, {
        id,
        filename: current.filename,
        kind: mediaKind(current.filename),
        headingLine: current.headingLine,
        externalUrl: current.externalUrl,
      });
    }
    current = null;
  };
  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      flush();
      if (isMediaHeading(heading[1].trim())) {
        current = { filename: heading[1].trim(), headingLine: index + 1, externalUrl: null };
      }
      return;
    }
    if (current && !current.externalUrl && /^https?:\/\//i.test(line)) current.externalUrl = line;
  });
  flush();
  return entries;
}

function objectEntries(value: unknown): Array<{ key: string; value: JsonRow; pointerSegment: string }> {
  if (Array.isArray(value)) {
    return value.map((entry, index) => ({ key: String(index), value: entry as JsonRow, pointerSegment: String(index) }));
  }
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).map(([key, entry]) => ({
    key,
    value: entry as JsonRow,
    pointerSegment: jsonPointerEscape(key),
  }));
}

function firstString(value: unknown, candidates: readonly string[]): string | null {
  if (!value || typeof value !== 'object') return null;
  for (const key of candidates) {
    const candidate = (value as JsonRow)[key];
    if (typeof candidate === 'string' && candidate.length > 0) return candidate;
  }
  return null;
}

function childStructure(value: JsonRow, prefix: string): string[] {
  const entries: string[] = [];
  for (const key of Object.keys(value).sort()) {
    const child = value[key];
    if (Array.isArray(child)) entries.push(`${prefix}.${key}:array(${child.length})`);
    else if (child && typeof child === 'object') entries.push(`${prefix}.${key}:object(${Object.keys(child).length})`);
  }
  return entries;
}

function stepStructure(step: JsonRow): string[] {
  return [
    `modules:${Array.isArray(step.modules) ? step.modules.length : 0}`,
    `content_blocks:${step.content_blocks && typeof step.content_blocks === 'object' ? Object.keys(step.content_blocks).sort().join(',') : ''}`,
    `interaction_kind:${firstString(step.interaction_spec, ['interaction_kind', 'interactionKind']) ?? 'none'}`,
    `activity_cards:${Array.isArray(step.interaction_spec?.activity_cards) ? step.interaction_spec.activity_cards.length : 0}`,
    `evidence_sequence:${Array.isArray(step.evidence_sequence) ? step.evidence_sequence.length : 0}`,
  ];
}

function moduleStructure(module: JsonRow): string[] {
  return [
    `kind:${typeof module.kind === 'string' ? module.kind : 'unknown'}`,
    `region:${typeof module.region === 'string' ? module.region : 'unknown'}`,
    `order:${typeof module.order === 'number' ? module.order : 'unknown'}`,
    ...childStructure(module, 'module'),
    ...(module.payload && typeof module.payload === 'object' ? childStructure(module.payload, 'payload') : []),
  ];
}

function recursiveStringContains(value: unknown, needles: readonly string[]): boolean {
  if (typeof value === 'string') return needles.some((needle) => needle.length > 0 && value.includes(needle));
  if (Array.isArray(value)) return value.some((entry) => recursiveStringContains(entry, needles));
  if (value && typeof value === 'object') return Object.values(value).some((entry) => recursiveStringContains(entry, needles));
  return false;
}

function lessonKeyFromResourceId(resourceId: string): string {
  const match = resourceId.match(/^runtime-(?:step|module|media|handout):(.+)$/);
  assert(match, `Unsupported runtime semantic resource id: ${resourceId}`);
  const rest = match[1];
  if (resourceId.startsWith('runtime-handout:')) return rest;
  const separator = rest.indexOf(':');
  assert(separator > 0, `Runtime semantic resource id lacks lesson key: ${resourceId}`);
  return rest.slice(0, separator);
}

function loadContext(lessonKey: string): RuntimeLessonManifestContext {
  const cached = contextCache.get(lessonKey);
  if (cached) return cached;
  const lessonDir = path.join(RUNTIME_LESSONS_ROOT, lessonKey);
  assert(existsSync(lessonDir), `Runtime lesson directory does not exist: ${lessonKey}`);
  const lessonJsonPath = `course-content/runtime/lessons/${lessonKey}/lesson.json`;
  const lessonJson = readJson(lessonJsonPath);
  const manifestPath = optionalProjectPath([
    lessonJson.interactive_manifest_source_path,
    `course-content/runtime/lessons/${lessonKey}/interactive-manifest.json`,
  ]);
  const graphOverlayPath = optionalProjectPath([
    lessonJson.graph_overlay_source_path,
    `course-content/runtime/lessons/${lessonKey}/graph-overlay.json`,
  ]);
  const handoutPath = optionalProjectPath([
    lessonJson.handout_source_path,
    `course-content/runtime/lessons/${lessonKey}/${lessonJson.lesson_id ?? lessonKey}-handout.md`,
    `course-content/runtime/lessons/${lessonKey}/handout.md`,
  ]);
  const mediaIndexPath = optionalProjectPath([
    lessonJson.media_index_source_path,
    `course-content/runtime/lessons/${lessonKey}/media/${lessonJson.lesson_id ?? lessonKey}-media.md`,
  ]);
  const manifest = manifestPath ? readJson(manifestPath) : null;
  const graphOverlay = graphOverlayPath ? readJson(graphOverlayPath) : null;
  const steps: RuntimeLessonManifestContext['steps'] = new Map();
  const modules: RuntimeLessonManifestContext['modules'] = new Map();
  for (const entry of objectEntries(manifest?.steps)) {
    const stepId = typeof entry.value.id === 'string' ? entry.value.id : entry.key;
    const pointer = `/steps/${entry.pointerSegment}`;
    const step = {
      id: stepId,
      pointer,
      value: entry.value,
      studentPath: firstString(entry.value.preview, ['student']) ?? firstString(entry.value.preview_contract, ['demo_path']),
      teacherPath: firstString(entry.value.preview, ['teacher']),
    };
    steps.set(stepId, step);
    const rawModules = Array.isArray(entry.value.modules) ? entry.value.modules : [];
    rawModules.forEach((module, index) => {
      const moduleId = typeof module.id === 'string' ? module.id : `${stepId}-module-${index + 1}`;
      modules.set(`${stepId}:${moduleId}`, {
        id: moduleId,
        pointer: `${pointer}/modules/${index}`,
        stepId,
        value: module as JsonRow,
      });
    });
  }
  const mediaIndex = mediaIndexPath ? parseMediaIndex(readFileSync(projectPath(mediaIndexPath), 'utf8')) : new Map();
  const context: RuntimeLessonManifestContext = {
    lessonKey,
    parentLessonRef: `runtime-lesson:${lessonKey}`,
    lessonJson,
    manifestPath,
    manifest,
    manifestHash: manifestPath ? fileHash(manifestPath) : null,
    graphOverlayPath,
    graphOverlay,
    graphOverlayHash: graphOverlayPath ? fileHash(graphOverlayPath) : null,
    handoutPath,
    handoutHash: handoutPath ? fileHash(handoutPath) : null,
    mediaIndexPath,
    mediaIndexHash: mediaIndexPath ? fileHash(mediaIndexPath) : null,
    steps,
    modules,
    media: mediaIndex,
  };
  contextCache.set(lessonKey, context);
  return context;
}

function moduleResourceId(lessonKey: string, module: { id: string; stepId: string }): string {
  return `runtime-module:${lessonKey}:${module.stepId}:${module.id}`;
}

function stepResourceId(lessonKey: string, stepId: string): string {
  return `runtime-step:${lessonKey}:${stepId}`;
}

function mediaResourceId(lessonKey: string, mediaId: string): string {
  return `runtime-media:${lessonKey}:${mediaId}`;
}

function localMediaPathCandidates(row: JsonRow, context: RuntimeLessonManifestContext, mediaFilename: string | null): Array<string | null> {
  return [
    typeof row.sourcePathOrUrl === 'string' && row.sourcePathOrUrl.startsWith('course-content/') ? row.sourcePathOrUrl : null,
    typeof row.sourcePathOrUrl === 'string' && row.sourcePathOrUrl.startsWith('/course-runtime/')
      ? row.sourcePathOrUrl.replace(/^\//, '').replace(/^course-runtime\//, 'course-content/runtime/')
      : null,
    mediaFilename ? `course-content/runtime/lessons/${context.lessonKey}/media/${mediaFilename}` : null,
  ];
}

function mediaParentCandidates(context: RuntimeLessonManifestContext, filename: string | null): string[] {
  if (!filename || !context.manifest) return [];
  const needles = [filename, `/media/${filename}`, `../media/${filename}`];
  return [...context.modules.values()]
    .filter((module) => recursiveStringContains(module.value, needles))
    .map((module) => moduleResourceId(context.lessonKey, module))
    .sort();
}

function graphEvidenceForStep(
  context: RuntimeLessonManifestContext,
  stepId: string,
  knowledgeRefs: readonly string[],
): { evidenceFilePath: string; evidenceFileHash: string; evidenceSelector: string; evidenceMatch: string | null } | null {
  if (!context.graphOverlayPath || !context.graphOverlay) return null;
  const groups = Array.isArray(context.graphOverlay.groups) ? context.graphOverlay.groups : [];
  const matching = groups
    .map((group, index) => ({ group, index }))
    .filter(({ group }) => Array.isArray(group.step_ids) && group.step_ids.includes(stepId));
  const selected = matching.find(({ group }) => (
    Array.isArray(group.node_ids) && group.node_ids.some((id: string) => knowledgeRefs.includes(id))
  )) ?? matching[0];
  if (!selected) return null;
  const groupName = selected.group.group_name ?? selected.group.title ?? `group-${selected.index}`;
  return {
    evidenceFilePath: context.graphOverlayPath,
    evidenceFileHash: context.graphOverlayHash!,
    evidenceSelector: `json-pointer:/groups/${selected.index}`,
    evidenceMatch: String(groupName),
  };
}

function firstMarkdownEvidence(pathname: string): { line: number; hash: string } {
  const lines = readFileSync(projectPath(pathname), 'utf8').split(/\r?\n/);
  const firstNonEmpty = lines.findIndex((line) => line.trim().length > 0);
  assert(firstNonEmpty >= 0, `Runtime handout/media index is empty: ${pathname}`);
  return { line: firstNonEmpty + 1, hash: fileHash(pathname) };
}

function isHttpUrl(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^https?:\/\/\S+$/i.test(value);
}

function sha256String(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function sourcePathKind(value: unknown): RuntimeSemanticSourcePathKind {
  if (isHttpUrl(value as string | null | undefined)) return 'http-url';
  if (typeof value === 'string' && value.length > 0) return 'local-path';
  return 'none';
}

export function deriveRuntimeSemanticAssetStatus(input: {
  gitIndexTracked: boolean;
  auditSourcePathOrUrl: unknown;
  mediaIndexUrl: string | null;
}): RuntimeSemanticAssetStatus {
  if (input.gitIndexTracked) return 'tracked-local-runtime-asset';
  if (
    isHttpUrl(input.auditSourcePathOrUrl as string | null | undefined)
    && isHttpUrl(input.mediaIndexUrl)
    && sha256String(input.auditSourcePathOrUrl as string) === sha256String(input.mediaIndexUrl)
  ) {
    return 'external-http-runtime-asset';
  }
  return 'missing-local-runtime-asset';
}

function assertAssetObservation(
  row: JsonRow,
  source: JsonRow,
  context: RuntimeLessonManifestContext,
  localPathCandidate: string | null,
  mediaUrl: string | null,
): RuntimeSemanticAssetObservation {
  const observation = source.assetObservation as RuntimeSemanticAssetObservation | undefined;
  assert(observation && typeof observation === 'object', `Runtime media source lacks independent asset observation: ${row.resourceId}`);
  assert(observation.schemaVersion === RUNTIME_SEMANTIC_ASSET_OBSERVATION_VERSION, `Runtime media asset observation version mismatch: ${row.resourceId}`);
  assert(observation.localPath === localPathCandidate, `Runtime media asset observation local path mismatch: ${row.resourceId}`);
  const actualIndexTracked = localPathCandidate ? isGitIndexPath(localPathCandidate) : false;
  assert(observation.gitIndexTracked === actualIndexTracked, `Runtime media asset observation git-index state mismatch: ${row.resourceId}`);
  const sourceUrl = typeof row.sourcePathOrUrl === 'string' ? row.sourcePathOrUrl : null;
  assert(observation.auditSourcePathOrUrlKind === sourcePathKind(sourceUrl), `Runtime media asset observation source kind mismatch: ${row.resourceId}`);
  const sourceUrlSha256 = isHttpUrl(sourceUrl) ? sha256String(sourceUrl) : null;
  assert(observation.auditSourcePathOrUrlSha256 === sourceUrlSha256, `Runtime media asset observation audit URL identity mismatch: ${row.resourceId}`);
  const mediaUrlSha256 = mediaUrl ? sha256String(mediaUrl) : null;
  assert(observation.mediaIndexUrlSha256 === mediaUrlSha256, `Runtime media asset observation media-index URL identity mismatch: ${row.resourceId}`);
  if (localPathCandidate && existsSync(projectPath(localPathCandidate))) {
    assert(observation.workingTreePresent, `Runtime media asset observation falsely reports a present local file as absent: ${row.resourceId}`);
  }
  if (observation.gitIndexTracked) {
    assert(localPathCandidate && observation.workingTreePresent, `Tracked runtime media asset observation lacks a local file: ${row.resourceId}`);
  }
  if (observation.workingTreePresent) {
    assert(localPathCandidate, `Working-tree runtime media asset observation lacks a local path: ${row.resourceId}`);
  }
  assert(context.mediaIndexPath || observation.gitIndexTracked, `Runtime media asset observation lacks media-index or tracked-file evidence: ${row.resourceId}`);
  return observation;
}

function routeFileForPathTarget(pathTarget: string | null): string | null {
  if (!pathTarget || !pathTarget.startsWith('/interactive-learning/courses/')) return null;
  const pathname = pathTarget.split('?', 1)[0];
  const routePath = pathname.replace(/\/student\/[^/]+$/, '/student/[sessionId]');
  const candidate = `src/app${routePath}/page.tsx`;
  return existsSync(projectPath(candidate)) ? candidate : null;
}

export function buildRuntimeLessonSemanticEvidence(
  row: JsonRow,
  source: JsonRow,
): RuntimeLessonSemanticReviewEvidence {
  const lessonKey = lessonKeyFromResourceId(row.resourceId);
  const context = loadContext(lessonKey);
  const parentLessonRef = context.parentLessonRef;
  const family = row.family as string;
  const parentPlanningUnitRef = source.parentPlanningUnitRef ?? null;
  if (family === 'runtime-lesson-step') {
    assert(context.manifestPath && context.manifestHash, `Runtime step has no interactive manifest: ${row.resourceId}`);
    const stepId = row.resourceId.slice(`runtime-step:${lessonKey}:`.length);
    const step = context.steps.get(stepId);
    assert(step, `Runtime step is absent from manifest: ${row.resourceId}`);
    const graphEvidence = source.promotedAsPlanningUnit
      ? graphEvidenceForStep(context, stepId, row.graphNodeRefs?.knowledge ?? [])
      : null;
    const evidence = graphEvidence ?? {
      evidenceFilePath: context.manifestPath,
      evidenceFileHash: context.manifestHash,
      evidenceSelector: `json-pointer:${step.pointer}`,
      evidenceMatch: stepId,
    };
    return {
      schemaVersion: 'runtime-lesson-semantic-evidence.v1',
      recordKind: 'step',
      parentLessonRef,
      sourceFilePath: context.manifestPath,
      sourceFileKind: 'interactive-manifest',
      sourceFileExtension: '.json',
      sourceFileHash: context.manifestHash,
      evidenceFilePath: evidence.evidenceFilePath,
      evidenceFileHash: evidence.evidenceFileHash,
      evidenceSelector: evidence.evidenceSelector as RuntimeLessonSemanticReviewEvidence['evidenceSelector'],
      evidenceMatch: evidence.evidenceMatch,
      manifestPath: context.manifestPath,
      manifestPointer: step.pointer,
      mediaIndexPath: context.mediaIndexPath,
      mediaIndexLine: null,
      recordKey: stepId,
      mediaKind: null,
      moduleKind: null,
      childStructure: stepStructure(step.value),
      interactionKind: firstString(step.value.interaction_spec, ['interaction_kind', 'interactionKind']),
      telemetryFields: Array.isArray(step.value.telemetry_spec?.summary_fields) ? [...step.value.telemetry_spec.summary_fields] : [],
      evidenceSequence: Array.isArray(step.value.evidence_sequence) ? [...step.value.evidence_sequence] : [],
      launch: {
        studentPath: step.studentPath,
        teacherPath: step.teacherPath,
        pathTarget: source.pathTarget ?? null,
        available: Boolean(step.studentPath || routeFileForPathTarget(source.pathTarget)),
        independent: Boolean(
          source.promotedAsPlanningUnit
          && routeFileForPathTarget(source.pathTarget)
          && (firstString(step.value.interaction_spec, ['interaction_kind', 'interactionKind'])
            || (Array.isArray(step.value.evidence_sequence) && step.value.evidence_sequence.length > 0))
          && (Array.isArray(step.value.telemetry_spec?.summary_fields) && step.value.telemetry_spec.summary_fields.length > 0)
        ),
      },
      evidence: {
        decision: source.evidenceDecision,
        instrumentation: [...(source.evidenceInstrumentation ?? [])],
        independent: Boolean(
          source.promotedAsPlanningUnit
          && source.evidenceDecision === 'independent-path-evidence'
          && (Array.isArray(step.value.evidence_sequence) && step.value.evidence_sequence.length > 0
            || firstString(step.value.interaction_spec, ['interaction_kind', 'interactionKind']))
          && (Array.isArray(step.value.telemetry_spec?.summary_fields) && step.value.telemetry_spec.summary_fields.length > 0)
          && (source.evidenceInstrumentation ?? []).length > 0,
        ),
      },
      parent: {
        resourceRef: source.parentResourceRef ?? null,
        planningUnitRef: parentPlanningUnitRef,
        resolution: parentPlanningUnitRef ? 'planning-unit' : source.parentResourceRef ? 'resource' : 'lesson',
        resourceCandidates: [],
      },
      externalIdentitySha256: null,
      assetStatus: 'not-applicable',
      assetAvailability: 'not-applicable',
      rawContentIncluded: false,
    };
  }

  if (family === 'runtime-lesson-module') {
    assert(context.manifestPath && context.manifestHash, `Runtime module has no interactive manifest: ${row.resourceId}`);
    const prefix = `runtime-module:${lessonKey}:`;
    const rest = row.resourceId.slice(prefix.length);
    const separator = rest.indexOf(':');
    assert(separator > 0, `Runtime module id lacks step key: ${row.resourceId}`);
    const stepId = rest.slice(0, separator);
    const moduleId = rest.slice(separator + 1);
    const module = context.modules.get(`${stepId}:${moduleId}`);
    assert(module && module.stepId === stepId, `Runtime module is absent from manifest: ${row.resourceId}`);
    const step = context.steps.get(stepId);
    assert(step, `Runtime module parent step is absent from manifest: ${row.resourceId}`);
    return {
      schemaVersion: 'runtime-lesson-semantic-evidence.v1',
      recordKind: 'module',
      parentLessonRef,
      sourceFilePath: context.manifestPath,
      sourceFileKind: 'interactive-manifest',
      sourceFileExtension: '.json',
      sourceFileHash: context.manifestHash,
      evidenceFilePath: context.manifestPath,
      evidenceFileHash: context.manifestHash,
      evidenceSelector: `json-pointer:${module.pointer}`,
      evidenceMatch: module.id,
      manifestPath: context.manifestPath,
      manifestPointer: module.pointer,
      mediaIndexPath: context.mediaIndexPath,
      mediaIndexLine: null,
      recordKey: module.id,
      mediaKind: null,
      moduleKind: typeof module.value.kind === 'string' ? module.value.kind : null,
      childStructure: moduleStructure(module.value),
      interactionKind: firstString(step.value.interaction_spec, ['interaction_kind', 'interactionKind']),
      telemetryFields: Array.isArray(step.value.telemetry_spec?.summary_fields) ? [...step.value.telemetry_spec.summary_fields] : [],
      evidenceSequence: Array.isArray(step.value.evidence_sequence) ? [...step.value.evidence_sequence] : [],
      launch: {
        studentPath: step.studentPath,
        teacherPath: step.teacherPath,
        pathTarget: null,
        available: Boolean(step.studentPath),
        independent: false,
      },
      evidence: {
        decision: source.evidenceDecision,
        instrumentation: [...(source.evidenceInstrumentation ?? [])],
        independent: false,
      },
      parent: {
        resourceRef: source.parentResourceRef ?? stepResourceId(lessonKey, stepId),
        planningUnitRef: parentPlanningUnitRef,
        resolution: parentPlanningUnitRef ? 'planning-unit' : 'resource',
        resourceCandidates: [stepResourceId(lessonKey, stepId)],
      },
      externalIdentitySha256: null,
      assetStatus: 'not-applicable',
      assetAvailability: 'not-applicable',
      rawContentIncluded: false,
    };
  }

  if (family === 'runtime-lesson-media') {
    const mediaId = row.resourceId.slice(`runtime-media:${lessonKey}:`.length);
    const media = context.media.get(mediaId);
    const filename = media?.filename ?? (typeof row.sourcePathOrUrl === 'string' ? path.basename(row.sourcePathOrUrl) : null);
    const localPathCandidate = localMediaPathCandidates(row, context, filename)
      .find((candidate): candidate is string => Boolean(candidate)) ?? null;
    const parentCandidates = mediaParentCandidates(context, filename);
    const externalSourceIdentity = isHttpUrl(media?.externalUrl) ? media.externalUrl : null;
    const observation = assertAssetObservation(
      row,
      source,
      context,
      localPathCandidate,
      externalSourceIdentity,
    );
    const localAssetIsTracked = localPathCandidate ? isGitIndexPath(localPathCandidate) : false;
    const assetStatus = deriveRuntimeSemanticAssetStatus({
      gitIndexTracked: localAssetIsTracked,
      auditSourcePathOrUrl: row.sourcePathOrUrl,
      mediaIndexUrl: externalSourceIdentity,
    });
    const isExternal = assetStatus === 'external-http-runtime-asset';
    const evidenceFilePath = localAssetIsTracked ? localPathCandidate : context.mediaIndexPath;
    assert(evidenceFilePath, `Runtime media has no local asset or media index evidence: ${row.resourceId}`);
    assert(!localAssetIsTracked || localPathCandidate, `Tracked runtime media has no local path: ${row.resourceId}`);
    assert(media?.headingLine || localAssetIsTracked, `Runtime media has no asset-specific evidence selector: ${row.resourceId}`);
    const evidenceSelector = localAssetIsTracked
      ? `file-sha256:${fileHash(localPathCandidate!).slice('sha256:'.length)}`
      : `markdown-line:${media?.headingLine ?? firstMarkdownEvidence(evidenceFilePath).line}`;
    const evidenceFileHash = fileHash(evidenceFilePath);
    const sourceFileHash = localAssetIsTracked ? fileHash(localPathCandidate!) : null;
    const externalIdentitySha256 = isExternal && externalSourceIdentity
      ? sha256String(externalSourceIdentity)
      : null;
    const sourceExtension = filename ? path.extname(filename).toLowerCase() || null : null;
    const assetAvailability: RuntimeSemanticAssetAvailability = localAssetIsTracked
      ? 'tracked-in-git-index'
      : isExternal
        ? 'external-media-index-url'
        : 'not-tracked-in-git-index';
    return {
      schemaVersion: 'runtime-lesson-semantic-evidence.v1',
      recordKind: 'media',
      parentLessonRef,
      sourceFilePath: localAssetIsTracked
        ? localPathCandidate!
        : isExternal
          ? `external-media:${externalIdentitySha256}`
          : localPathCandidate ?? `missing-local-runtime-asset:${mediaId}`,
      sourceFileKind: localAssetIsTracked
        ? (['.json', '.csv', '.txt'].includes(sourceExtension ?? '') ? 'structured-media' : 'binary-media')
        : isExternal
          ? 'external-media'
          : 'missing-local-runtime-asset',
      sourceFileExtension: sourceExtension,
      sourceFileHash,
      evidenceFilePath,
      evidenceFileHash,
      evidenceSelector: evidenceSelector as RuntimeLessonSemanticReviewEvidence['evidenceSelector'],
      evidenceMatch: localAssetIsTracked ? null : filename,
      manifestPath: context.manifestPath,
      manifestPointer: null,
      mediaIndexPath: context.mediaIndexPath,
      mediaIndexLine: media?.headingLine ?? null,
      recordKey: filename ?? mediaId,
      mediaKind: media?.kind ?? (filename ? mediaKind(filename) : 'other'),
      moduleKind: null,
      childStructure: [
        `media-index:${context.mediaIndexPath ?? 'none'}`,
        `parent-modules:${parentCandidates.length}`,
        `external:${isExternal}`,
        `asset-status:${assetStatus}`,
      ],
      interactionKind: null,
      telemetryFields: [],
      evidenceSequence: [],
      launch: {
        studentPath: null,
        teacherPath: null,
        pathTarget: null,
        available: false,
        independent: false,
      },
      evidence: {
        decision: source.evidenceDecision,
        instrumentation: [...(source.evidenceInstrumentation ?? [])],
        independent: false,
      },
      parent: {
        resourceRef: source.parentResourceRef ?? (parentCandidates.length === 1 ? parentCandidates[0] : null),
        planningUnitRef: parentPlanningUnitRef,
        resolution: parentPlanningUnitRef ? 'planning-unit' : source.parentResourceRef || parentCandidates.length === 1 ? 'resource' : 'lesson',
        resourceCandidates: parentCandidates,
      },
      externalIdentitySha256,
      assetStatus,
      assetAvailability,
      rawContentIncluded: false,
    };
  }

  assert(family === 'runtime-handout', `Unsupported runtime semantic family: ${row.family}`);
  assert(context.handoutPath && context.handoutHash, `Runtime handout source does not exist: ${row.resourceId}`);
  const markdownEvidence = firstMarkdownEvidence(context.handoutPath);
  return {
    schemaVersion: 'runtime-lesson-semantic-evidence.v1',
    recordKind: 'handout',
    parentLessonRef,
    sourceFilePath: context.handoutPath,
    sourceFileKind: 'markdown',
    sourceFileExtension: '.md',
    sourceFileHash: context.handoutHash,
    evidenceFilePath: context.handoutPath,
    evidenceFileHash: markdownEvidence.hash,
    evidenceSelector: `markdown-line:${markdownEvidence.line}`,
    evidenceMatch: null,
    manifestPath: context.manifestPath,
    manifestPointer: null,
    mediaIndexPath: context.mediaIndexPath,
    mediaIndexLine: null,
    recordKey: row.sourceRecord ?? lessonKey,
    mediaKind: null,
    moduleKind: null,
    childStructure: [`markdown-line:${markdownEvidence.line}`],
    interactionKind: null,
    telemetryFields: [],
    evidenceSequence: [],
    launch: {
      studentPath: null,
      teacherPath: null,
      pathTarget: null,
      available: false,
      independent: false,
    },
    evidence: {
      decision: source.evidenceDecision,
      instrumentation: [...(source.evidenceInstrumentation ?? [])],
      independent: false,
    },
    parent: {
      resourceRef: source.parentResourceRef ?? null,
      planningUnitRef: parentPlanningUnitRef,
      resolution: parentPlanningUnitRef ? 'planning-unit' : source.parentResourceRef ? 'resource' : 'lesson',
      resourceCandidates: [],
    },
    externalIdentitySha256: null,
    assetStatus: 'not-applicable',
    assetAvailability: 'not-applicable',
    rawContentIncluded: false,
  };
}

export function buildRuntimeLessonSemanticDecisionFacts(
  row: JsonRow,
  source: JsonRow,
  facts: RuntimeLessonSemanticReviewEvidence,
): RuntimeLessonSemanticDecisionFacts {
  return {
    sourceFamily: row.family,
    recordKind: facts.recordKind,
    source: {
      filePath: facts.sourceFilePath,
      fileKind: facts.sourceFileKind,
      fileExtension: facts.sourceFileExtension,
      fileHash: facts.sourceFileHash,
      assetStatus: facts.assetStatus,
      assetAvailability: facts.assetAvailability,
    },
    manifest: {
      path: facts.manifestPath,
      hash: facts.manifestPath ? fileHash(facts.manifestPath) : null,
      pointer: facts.manifestPointer,
      recordKey: facts.recordKey,
      mediaKind: facts.mediaKind,
      moduleKind: facts.moduleKind,
      childStructure: [...facts.childStructure],
    },
    asset: {
      mediaIndexPath: facts.mediaIndexPath,
      mediaIndexLine: facts.mediaIndexLine,
      externalIdentitySha256: facts.externalIdentitySha256,
      localPath: facts.recordKind === 'media'
        ? (source.assetObservation?.localPath ?? null)
        : null,
      gitIndexTracked: facts.recordKind === 'media'
        ? (source.assetObservation?.gitIndexTracked ?? null)
        : null,
      auditSourcePathOrUrlKind: facts.recordKind === 'media'
        ? (source.assetObservation?.auditSourcePathOrUrlKind ?? 'none')
        : 'none',
      auditSourcePathOrUrlSha256: facts.recordKind === 'media'
        ? (source.assetObservation?.auditSourcePathOrUrlSha256 ?? null)
        : null,
    },
    parent: {
      lessonRef: facts.parentLessonRef,
      resourceCandidates: [...facts.parent.resourceCandidates],
      resourceRef: facts.parent.resourceRef,
      planningUnitRef: facts.parent.planningUnitRef,
      resolution: facts.parent.resolution,
    },
    contract: {
      readinessPresent: row.readiness !== null,
      estimatedTimeMinutes: row.estimatedTimeMinutes,
      citationTargets: (row.citationTargets ?? [])
        .filter((target: unknown): target is string => typeof target === 'string' && !/^https?:\/\//i.test(target))
        .sort(),
      graphNodeRefs: {
        knowledge: [...(row.graphNodeRefs?.knowledge ?? [])],
        capability: [...(row.graphNodeRefs?.capability ?? [])],
        quality: [...(row.graphNodeRefs?.quality ?? [])],
      },
      evidenceDecision: facts.evidence.decision,
      evidenceContractComplete: row.evidenceContract?.complete === true,
      evidenceMissingFields: [...(row.evidenceContract?.missingFields ?? [])],
      evidenceInstrumentation: [...(source.evidenceInstrumentation ?? [])],
      launch: facts.launch,
      evidence: facts.evidence,
    },
  };
}

export function buildRuntimeLessonSemanticReasonCodes(
  row: JsonRow,
  source: JsonRow,
  facts: RuntimeLessonSemanticReviewEvidence,
): string[] {
  return [...new Set([
    ...(row.missingFieldCodes ?? []).map((code: string) => `audit:${code}`),
    `disposition:${source.disposition}`,
    `record-kind:${facts.recordKind}`,
    `source-kind:${facts.sourceFileKind}`,
    `asset-status:${facts.assetStatus}`,
    `parent-resolution:${facts.parent.resolution}`,
    `launch:${facts.launch.independent ? 'independent' : 'supporting-or-unavailable'}`,
    `evidence:${facts.evidence.independent ? 'independent' : 'supporting-or-unavailable'}`,
  ])];
}

function canonicalDecisionValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalDecisionValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalDecisionValue(entry)]),
  );
}

export function buildRuntimeLessonSemanticDecisionHash(source: JsonRow): string {
  const payload = canonicalDecisionValue({
    decisionVersion: RUNTIME_SEMANTIC_DECISION_VERSION,
    resourceId: source.resourceId,
    reviewerId: source.reviewerId,
    reviewerRole: source.reviewerRole,
    reviewedAt: source.reviewedAt,
    reviewBatchId: source.reviewBatchId,
    disposition: source.disposition,
    promotedAsPlanningUnit: source.promotedAsPlanningUnit,
    currentPathEligible: source.currentPathEligible,
    pathTarget: source.pathTarget,
    parentLessonRef: source.parentLessonRef,
    parentResourceRef: source.parentResourceRef,
    parentPlanningUnitRef: source.parentPlanningUnitRef,
    graphNodeRefs: source.graphNodeRefs,
    learningGoalIds: source.learningGoalIds,
    knowledgeObjectiveIds: source.knowledgeObjectiveIds,
    capabilityObjectiveIds: source.capabilityObjectiveIds,
    qualityObjectiveIds: source.qualityObjectiveIds,
    learningGoalFit: source.learningGoalFit,
    evidenceDecision: source.evidenceDecision,
    evidenceContractComplete: source.evidenceContractComplete,
    evidenceMissingFields: source.evidenceMissingFields,
    evidenceInstrumentation: source.evidenceInstrumentation,
    readinessPresent: source.readinessPresent,
    estimatedTimeMinutes: source.estimatedTimeMinutes,
    citationTargets: source.citationTargets,
    reasonCodes: source.reasonCodes,
    decisionFacts: source.decisionFacts,
    reviewerVisibleRationale: source.reviewerVisibleRationale,
  });
  return `sha256:${sha256String(JSON.stringify(payload))}`;
}

export function assertRuntimeLessonSemanticReviewEvidence(
  row: JsonRow,
  source: JsonRow,
): RuntimeLessonSemanticReviewEvidence {
  const facts = buildRuntimeLessonSemanticEvidence(row, source);
  assert(source.decisionVersion === RUNTIME_SEMANTIC_DECISION_VERSION, `Runtime semantic decision version mismatch: ${row.resourceId}`);
  assert(source.decisionHash === buildRuntimeLessonSemanticDecisionHash(source), `Runtime semantic decision hash mismatch: ${row.resourceId}`);
  assert(source.runtimeEvidence && typeof source.runtimeEvidence === 'object', `Runtime semantic source lacks explicit runtime evidence facts: ${row.resourceId}`);
  assert(source.decisionFacts && typeof source.decisionFacts === 'object', `Runtime semantic source lacks explicit decision facts: ${row.resourceId}`);
  assert(Array.isArray(source.reasonCodes) && source.reasonCodes.length > 0, `Runtime semantic source lacks explicit reason codes: ${row.resourceId}`);
  assert(source.independentEvidenceRef === `${facts.evidenceFilePath}#${facts.evidenceSelector}`, `Runtime semantic evidence reference is not the canonical source selector: ${row.resourceId}`);
  const reference = assertRuntimeSemanticEvidenceReference(source.independentEvidenceRef);
  assert(reference.evidenceFileHash === facts.evidenceFileHash, `Runtime semantic evidence file hash mismatch: ${row.resourceId}`);
  assert(source.sourceEvidenceHash === facts.evidenceFileHash, `Runtime semantic source evidence hash mismatch: ${row.resourceId}`);
  assert(JSON.stringify(source.runtimeEvidence) === JSON.stringify(facts), `Runtime semantic source facts do not match runtime files: ${row.resourceId}`);
  assert(
    JSON.stringify(source.decisionFacts) === JSON.stringify(buildRuntimeLessonSemanticDecisionFacts(row, source, facts)),
    `Runtime semantic source decision facts do not match runtime files: ${row.resourceId}`,
  );
  assert(
    JSON.stringify(source.reasonCodes) === JSON.stringify(buildRuntimeLessonSemanticReasonCodes(row, source, facts)),
    `Runtime semantic source reason codes do not match audit/runtime facts: ${row.resourceId}`,
  );
  assert(/Source file=/.test(source.reviewerVisibleRationale), `Runtime semantic rationale lacks source-file basis: ${row.resourceId}`);
  assert(/Launch=/.test(source.reviewerVisibleRationale), `Runtime semantic rationale lacks launch basis: ${row.resourceId}`);
  assert(/Evidence=/.test(source.reviewerVisibleRationale), `Runtime semantic rationale lacks evidence basis: ${row.resourceId}`);
  assert(/Parent=/.test(source.reviewerVisibleRationale), `Runtime semantic rationale lacks parent basis: ${row.resourceId}`);
  if (facts.assetStatus === 'missing-local-runtime-asset') {
    assert(source.disposition === 'supporting-citation' || source.disposition === 'excluded-with-rationale', `Missing local runtime asset cannot be promoted: ${row.resourceId}`);
    assert(source.reviewerVisibleRationale.includes('missing-local-runtime-asset'), `Missing local runtime asset rationale is not explicit: ${row.resourceId}`);
  }
  if (facts.assetStatus === 'external-http-runtime-asset') {
    assert(facts.sourceFileKind === 'external-media' && facts.externalIdentitySha256, `External runtime media lacks HTTP identity: ${row.resourceId}`);
  }
  const canonicalResourceParent = facts.recordKind === 'module'
    ? facts.parent.resourceCandidates[0] ?? null
    : facts.recordKind === 'media' && facts.parent.resourceCandidates.length === 1
      ? facts.parent.resourceCandidates[0]
      : null;
  assert(source.parentResourceRef === canonicalResourceParent, `Runtime semantic source parent resource is not the canonical manifest relationship: ${row.resourceId}`);
  if (facts.recordKind === 'step' && !source.promotedAsPlanningUnit) {
    assert(source.parentPlanningUnitRef === null, `Non-promoted runtime step cannot claim a PlanningUnit parent: ${row.resourceId}`);
  }
  if (source.promotedAsPlanningUnit) {
    assert(facts.launch.independent, `Promoted runtime step has no independently launchable route and manifest interaction evidence: ${row.resourceId}`);
    assert(facts.evidence.independent, `Promoted runtime step has no independently observable manifest evidence behavior: ${row.resourceId}`);
  } else {
    assert(!facts.launch.independent && !facts.evidence.independent, `Non-promoted runtime resource claims independent runtime launch/evidence: ${row.resourceId}`);
  }
  return facts;
}

export function runtimeSemanticCanonicalEvidenceReference(
  row: JsonRow,
  source: JsonRow,
): string {
  const facts = buildRuntimeLessonSemanticEvidence(row, source);
  return `${facts.evidenceFilePath}#${facts.evidenceSelector}`;
}

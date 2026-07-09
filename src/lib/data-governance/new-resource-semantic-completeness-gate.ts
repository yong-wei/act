import type { RegisteredResourceMetadata } from '@/lib/resource-registry-metadata';
import type {
  ResourceGraphNodeRefs,
  ResourcePathPlanningDisposition,
  RuntimeResourceProjectionInput,
} from '@/lib/resource-node-registry';

export interface NewResourceGateIssue {
  resourceId: string;
  family: 'registered-resource' | 'runtime-resource-projection';
  code: string;
  message: string;
}

export interface NewResourceGateResult {
  passed: boolean;
  checked: number;
  issues: NewResourceGateIssue[];
}

export interface ChangedRegisteredResourceInput {
  id: string;
  lineStart: number;
  lineEnd: number;
}

export interface DiffLineRange {
  start: number;
  end: number;
}

export interface RuntimeProjectionParseResult {
  rows: RuntimeResourceProjectionInput[];
  result: NewResourceGateResult;
}

const PLACEHOLDER_REVIEWER_PATTERN = /\b(?:placeholder|todo|unknown|generated|synthetic|example|ai-generated|system-governed|template)\b/i;

export function validateChangedRegisteredResources(
  resources: readonly RegisteredResourceMetadata[],
): NewResourceGateResult {
  const issues = resources.flatMap((resource) => validateRegisteredResource(resource));
  return {
    passed: issues.length === 0,
    checked: resources.length,
    issues,
  };
}

export function validateChangedRuntimeResourceProjections(
  rows: readonly RuntimeResourceProjectionInput[],
): NewResourceGateResult {
  const issues = rows.flatMap((row) => validateRuntimeResourceProjection(row));
  return {
    passed: issues.length === 0,
    checked: rows.length,
    issues,
  };
}

export function mergeGateResults(results: readonly NewResourceGateResult[]): NewResourceGateResult {
  const issues = results.flatMap((result) => result.issues);
  return {
    passed: issues.length === 0,
    checked: results.reduce((total, result) => total + result.checked, 0),
    issues,
  };
}

export function parseChangedRegisteredResourceIds(source: string, diff: string): string[] {
  const ranges = parseDiffCurrentLineRanges(diff);
  if (ranges.length === 0) return [];
  const resources = [
    ...parseRegisteredResourceLineRanges(source),
    ...parseRegisteredResourcePatchLineRanges(source),
    ...parseRegisteredResourceProgressionLineRanges(source),
  ];
  const resourceIds = new Set(resources.map((resource) => resource.id));
  return uniqueSorted(
    [
      ...resources
      .filter((resource) => ranges.some((range) => rangesOverlap(resource, range)))
      .map((resource) => resource.id),
      ...parseChangedStringLiteralIds(diff).filter((id) => resourceIds.has(id)),
    ],
  );
}

export function parseAddedRuntimeProjectionRows(diff: string): RuntimeResourceProjectionInput[] {
  return parseAddedRuntimeProjectionChanges(diff).rows;
}

export function parseAddedRuntimeProjectionChanges(diff: string): RuntimeProjectionParseResult {
  const rows: RuntimeResourceProjectionInput[] = [];
  const issues: NewResourceGateIssue[] = [];
  for (const [index, rawLine] of diff.split(/\r?\n/).entries()) {
    if (!rawLine.startsWith('+') || rawLine.startsWith('+++')) continue;
    const line = rawLine.slice(1).trim();
    if (!line) continue;
    try {
      const row = JSON.parse(line) as Partial<RuntimeResourceProjectionInput>;
      if (!row.id) {
        issues.push(issue(`added-line-${index + 1}`, 'runtime-resource-projection', 'missing-runtime-projection-id', 'Added runtime projection JSONL row requires an id.'));
        continue;
      }
      rows.push(row as RuntimeResourceProjectionInput);
    } catch {
      issues.push(issue(`added-line-${index + 1}`, 'runtime-resource-projection', 'malformed-runtime-projection-json', 'Added runtime projection JSONL row must be valid single-line JSON.'));
    }
  }
  return {
    rows,
    result: {
      passed: issues.length === 0,
      checked: rows.length + issues.length,
      issues,
    },
  };
}

export function parseDiffCurrentLineRanges(diff: string): DiffLineRange[] {
  return diff
    .split(/\r?\n/)
    .map((line) => /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => {
      const start = Number(match[1]);
      const count = match[2] ? Number(match[2]) : 1;
      const end = count === 0 ? start : start + count - 1;
      return { start, end };
    });
}

export function parseRegisteredResourceLineRanges(source: string): ChangedRegisteredResourceInput[] {
  const lines = source.split(/\r?\n/);
  const resources: ChangedRegisteredResourceInput[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^    ['"]([^'"]+)['"]:\s*\{/.exec(lines[index]);
    if (!match) continue;
    const lineStart = index + 1;
    let depth = 0;
    let lineEnd = lineStart;
    for (let inner = index; inner < lines.length; inner += 1) {
      depth += braceDelta(lines[inner]);
      lineEnd = inner + 1;
      if (inner > index && depth <= 0) break;
    }
    resources.push({ id: match[1], lineStart, lineEnd });
  }
  return resources;
}

export function parseRegisteredResourcePatchLineRanges(source: string): ChangedRegisteredResourceInput[] {
  const lines = source.split(/\r?\n/);
  const resources: ChangedRegisteredResourceInput[] = [];
  for (const mapName of ['registeredResourceOperationalMetadata', 'registeredResourceSemanticMetadata']) {
    const mapStart = lines.findIndex((line) => line.includes(`const ${mapName}:`));
    if (mapStart < 0) continue;
    let mapEnd = lines.length - 1;
    for (let index = mapStart + 1; index < lines.length; index += 1) {
      if (/^};/.test(lines[index])) {
        mapEnd = index;
        break;
      }
    }
    for (let index = mapStart + 1; index < mapEnd; index += 1) {
      const match = /^    ['"]([^'"]+)['"]:\s*/.exec(lines[index]);
      if (!match) continue;
      resources.push({
        id: match[1],
        lineStart: index + 1,
        lineEnd: parsePatchEntryEndLine(lines, index, mapEnd),
      });
    }
  }
  return resources;
}

export function parseRegisteredResourceProgressionLineRanges(source: string): ChangedRegisteredResourceInput[] {
  const lines = source.split(/\r?\n/);
  const progressionRange = parseFunctionLineRange(lines, 'buildRegisteredResourceProgressionMetadata');
  if (!progressionRange) return [];
  const ids = parseProgressionIds(lines, progressionRange);
  const sharedRanges = [
    progressionRange,
    parseFunctionLineRange(lines, 'resourceReadiness'),
    parseFunctionLineRange(lines, 'readyImmediately'),
    parseFunctionLineRange(lines, 'buildUnlockMessage'),
  ].filter((range): range is DiffLineRange => Boolean(range));
  return ids.flatMap((id) => sharedRanges.map((range) => ({
    id,
    lineStart: range.start,
    lineEnd: range.end,
  })));
}

function parseProgressionIds(lines: readonly string[], range: DiffLineRange): string[] {
  const ids: string[] = [];
  let inIdsArray = false;
  for (const line of lines.slice(range.start - 1, range.end)) {
    if (/^\s*ids\s*:\s*\[/.test(line)) {
      inIdsArray = true;
      continue;
    }
    if (!inIdsArray) continue;
    ids.push(...Array.from(line.matchAll(/^\s*['"]([^'"]+)['"],?$/g), (match) => match[1]));
    if (/^\s*\]/.test(line)) {
      inIdsArray = false;
    }
  }
  return uniqueSorted(ids);
}

function parsePatchEntryEndLine(lines: readonly string[], startIndex: number, mapEnd: number): number {
  let depth = braceDelta(lines[startIndex]);
  if (depth <= 0) return startIndex + 1;
  for (let index = startIndex + 1; index < mapEnd; index += 1) {
    depth += braceDelta(lines[index]);
    if (depth <= 0) return index + 1;
  }
  return mapEnd + 1;
}

function parseFunctionLineRange(lines: readonly string[], functionName: string): DiffLineRange | null {
  const startIndex = lines.findIndex((line) => line.startsWith(`function ${functionName}(`));
  if (startIndex < 0) return null;
  let depth = 0;
  let opened = false;
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index];
    if (!opened) {
      const bodyStart = line.indexOf('{');
      if (bodyStart < 0) continue;
      opened = true;
      depth += braceDelta(line.slice(bodyStart));
    } else {
      depth += braceDelta(line);
    }
    if (opened && depth <= 0) {
      return { start: startIndex + 1, end: index + 1 };
    }
  }
  return { start: startIndex + 1, end: lines.length };
}

function validateRegisteredResource(resource: RegisteredResourceMetadata): NewResourceGateIssue[] {
  const issues: NewResourceGateIssue[] = [];
  const planning = resource.planningOverride;
  const disposition = planning?.pathDisposition ?? null;

  pushDispositionIssues(issues, resource.id, 'registered-resource', disposition);

  if (!planning) {
    issues.push(issue(resource.id, 'registered-resource', 'missing-planning-override', 'Registered resource requires reviewed semantic planning metadata.'));
    return issues;
  }

  if (disposition?.kind === 'path-plannable') {
    if (!resource.renderTarget && !resource.launchTarget) {
      issues.push(issue(resource.id, 'registered-resource', 'missing-render-or-launch-target', 'Path-plannable resource requires a render or launch target.'));
    }
    if (!resource.knowledgeNodeIds?.length) {
      issues.push(issue(resource.id, 'registered-resource', 'missing-knowledge-mapping', 'Path-plannable resource requires knowledge graph bindings.'));
    }
    if (!planning.abilityImpact || Object.keys(planning.abilityImpact).length === 0) {
      issues.push(issue(resource.id, 'registered-resource', 'missing-capability-mapping', 'Path-plannable resource requires K/A/Q capability impact metadata.'));
    }
    if (!planning.readiness) {
      issues.push(issue(resource.id, 'registered-resource', 'missing-readiness-policy', 'Path-plannable resource requires readiness metadata.'));
    }
    if (!planning.privacyLevel) {
      issues.push(issue(resource.id, 'registered-resource', 'missing-privacy-policy', 'Path-plannable resource requires privacy policy metadata.'));
    }
    if (!planning.evidenceInstrumentation?.length) {
      issues.push(issue(resource.id, 'registered-resource', 'missing-evidence-policy', 'Path-plannable resource requires evidence instrumentation policy.'));
    }
  }

  if (disposition?.kind === 'embedded-asset' && !disposition.parentResourceNodeId) {
    issues.push(issue(resource.id, 'registered-resource', 'missing-parent-planning-unit', 'Embedded assets require a reviewed parent planning unit reference.'));
  }
  if (disposition?.kind === 'evidence-producing' && !planning.evidenceInstrumentation?.length) {
    issues.push(issue(resource.id, 'registered-resource', 'missing-evidence-policy', 'Evidence-producing resources require evidence instrumentation policy.'));
  }

  return issues;
}

function validateRuntimeResourceProjection(row: RuntimeResourceProjectionInput): NewResourceGateIssue[] {
  const issues: NewResourceGateIssue[] = [];
  const audit = row.reviewAudit;
  const evidence = row.evidenceContract;

  if (!audit || audit.status !== 'human-confirmed') {
    issues.push(issue(row.id, 'runtime-resource-projection', 'missing-human-review', 'Runtime projection requires human-confirmed review metadata.'));
  }
  if (!audit?.reviewerId || PLACEHOLDER_REVIEWER_PATTERN.test(audit.reviewerId)) {
    issues.push(issue(row.id, 'runtime-resource-projection', 'missing-reviewer-id', 'Runtime projection requires a non-placeholder reviewer identity.'));
  }
  if (!audit?.reviewedAt) {
    issues.push(issue(row.id, 'runtime-resource-projection', 'missing-reviewed-at', 'Runtime projection requires review timestamp.'));
  }
  if (!audit?.reviewedSourceHash || !audit.reviewedVersionRef) {
    issues.push(issue(row.id, 'runtime-resource-projection', 'missing-reviewed-source-evidence', 'Runtime projection requires reviewed source hash and version evidence.'));
  } else if (!runtimeProjectionReviewSourceMatches(row) || audit.reviewedVersionRef !== row.sourceVersionRef) {
    issues.push(issue(row.id, 'runtime-resource-projection', 'stale-review-evidence', 'Runtime projection review evidence must match the current source hash and version.'));
  }
  if (!audit?.reviewerRole) {
    issues.push(issue(row.id, 'runtime-resource-projection', 'missing-reviewer-role', 'Runtime projection requires reviewer role metadata.'));
  }
  if (!audit?.reviewBatchId) {
    issues.push(issue(row.id, 'runtime-resource-projection', 'missing-review-batch-id', 'Runtime projection requires review batch metadata.'));
  }
  if (!audit?.reviewerVisibleRationale || audit.reviewerVisibleRationale.trim().length < 12) {
    issues.push(issue(row.id, 'runtime-resource-projection', 'missing-review-rationale', 'Runtime projection requires reviewer-visible rationale.'));
  }
  if (!audit?.independentEvidenceRef) {
    issues.push(issue(row.id, 'runtime-resource-projection', 'missing-independent-review-evidence', 'Runtime projection requires independent review evidence reference.'));
  }
  if (typeof audit?.confidence !== 'number' || !Number.isFinite(audit.confidence)) {
    issues.push(issue(row.id, 'runtime-resource-projection', 'missing-review-confidence', 'Runtime projection requires reviewer confidence metadata.'));
  }
  if (!audit?.staleInvalidationRule) {
    issues.push(issue(row.id, 'runtime-resource-projection', 'missing-stale-invalidation-rule', 'Runtime projection requires stale invalidation rule.'));
  }
  if (!row.sourceHash || !row.sourceVersionRef) {
    issues.push(issue(row.id, 'runtime-resource-projection', 'missing-source-version-evidence', 'Runtime projection requires source hash and version reference.'));
  }
  if (!row.privacyScope) {
    issues.push(issue(row.id, 'runtime-resource-projection', 'missing-privacy-policy', 'Runtime projection requires privacy scope.'));
  }
  if (!hasGraphBinding(row.graphNodeRefs)) {
    issues.push(issue(row.id, 'runtime-resource-projection', 'missing-graph-binding', 'Runtime projection requires graph bindings.'));
  }
  if ((row.projectionLevel === 'ResourceNode' || row.projectionLevel === 'PlanningUnit') && !hasCapabilityBinding(row.graphNodeRefs)) {
    issues.push(issue(row.id, 'runtime-resource-projection', 'missing-capability-mapping', 'Path-capable runtime projection requires capability graph bindings.'));
  }
  if (!row.citationTargets?.length) {
    issues.push(issue(row.id, 'runtime-resource-projection', 'missing-citation-target', 'Runtime projection requires citation metadata.'));
  }
  if (requiresCompleteEvidenceContract(row) && !isEvidenceContractComplete(evidence)) {
    issues.push(issue(row.id, 'runtime-resource-projection', 'missing-evidence-contract', 'Runtime projection requires a complete evidence contract.'));
  }
  if ((row.projectionLevel === 'ResourceNode' || row.projectionLevel === 'PlanningUnit') && !row.routeTarget && !row.renderTarget) {
    issues.push(issue(row.id, 'runtime-resource-projection', 'missing-route-or-render-target', 'Path-capable runtime projection requires route or render target.'));
  }

  return issues;
}

function pushDispositionIssues(
  issues: NewResourceGateIssue[],
  resourceId: string,
  family: NewResourceGateIssue['family'],
  disposition: ResourcePathPlanningDisposition | null,
) {
  if (!disposition) {
    issues.push(issue(resourceId, family, 'missing-path-disposition', 'Resource requires reviewed path-planning disposition.'));
    return;
  }
  if (disposition.reviewStatus !== 'human-confirmed') {
    issues.push(issue(resourceId, family, 'missing-human-review', 'Disposition requires human-confirmed review status.'));
  }
  if (!disposition.reviewerId || PLACEHOLDER_REVIEWER_PATTERN.test(disposition.reviewerId)) {
    issues.push(issue(resourceId, family, 'missing-reviewer-id', 'Disposition requires a non-placeholder reviewer identity.'));
  }
  if (!disposition.reviewedAt) {
    issues.push(issue(resourceId, family, 'missing-reviewed-at', 'Disposition requires review timestamp.'));
  }
  if (!disposition.sourceVersionRef || !disposition.stableSourceRef || !disposition.sourceFamily) {
    issues.push(issue(resourceId, family, 'missing-source-version-evidence', 'Disposition requires source family, stable source ref, and source version evidence.'));
  }
  if (!disposition.rationale || disposition.rationale.trim().length < 12) {
    issues.push(issue(resourceId, family, 'missing-disposition-rationale', 'Disposition requires reviewer-visible rationale.'));
  }
}

function hasGraphBinding(refs: Partial<ResourceGraphNodeRefs> | undefined): boolean {
  if (!refs) return false;
  return [...(refs.knowledge ?? []), ...(refs.capability ?? []), ...(refs.quality ?? [])].length > 0;
}

function hasCapabilityBinding(refs: Partial<ResourceGraphNodeRefs> | undefined): boolean {
  return (refs?.capability?.length ?? 0) > 0;
}

function parseChangedStringLiteralIds(diff: string): string[] {
  return diff
    .split(/\r?\n/)
    .filter((line) => (line.startsWith('+') || line.startsWith('-')) && !line.startsWith('+++') && !line.startsWith('---'))
    .flatMap((line) => Array.from(line.matchAll(/['"]([^'"]+)['"]/g), (match) => match[1]));
}

function requiresCompleteEvidenceContract(row: RuntimeResourceProjectionInput): boolean {
  return row.projectionLevel === 'ResourceNode' || row.projectionLevel === 'PlanningUnit' || (row.evidenceInstrumentation?.length ?? 0) > 0;
}

function isEvidenceContractComplete(evidence: RuntimeResourceProjectionInput['evidenceContract']): boolean {
  if (!evidence) return false;
  if (evidence.complete === false || (evidence.missingFields?.length ?? 0) > 0) return false;
  return evidence.eventSource &&
    evidence.eventType &&
    evidence.clientEventIdPolicy &&
    evidence.attemptKey &&
    evidence.sourceLogId &&
    evidence.dedupeKey &&
    evidence.timestamps &&
    isLearningFactPolicySatisfied(evidence) &&
    isLearningFactMaterializationPolicySatisfied(evidence) &&
    evidence.confidencePolicy &&
    evidence.privacyScope;
}

function isLearningFactPolicySatisfied(evidence: NonNullable<RuntimeResourceProjectionInput['evidenceContract']>): boolean {
  return evidence.learningFactPolicy ||
    evidence.learningFactMaterializationPolicy === 'path-execution-evidence-only' ||
    evidence.learningFactMaterializationPolicy === 'not-applicable';
}

function isLearningFactMaterializationPolicySatisfied(evidence: NonNullable<RuntimeResourceProjectionInput['evidenceContract']>): boolean {
  return evidence.learningFactMaterializationPolicy === 'materialized-learning-fact' ||
    evidence.learningFactMaterializationPolicy === 'path-execution-evidence-only' ||
    evidence.learningFactMaterializationPolicy === 'not-applicable';
}

function runtimeProjectionReviewSourceMatches(row: RuntimeResourceProjectionInput): boolean {
  const audit = row.reviewAudit;
  if (row.sourceKind === 'knowledge_graph') {
    return audit?.reviewedSourceHash === row.sourceHash;
  }
  if (audit?.promptOrManifestHash) {
    return audit.reviewedSourceHash === audit.promptOrManifestHash;
  }
  return audit?.reviewedSourceHash === row.sourceHash;
}

function issue(
  resourceId: string,
  family: NewResourceGateIssue['family'],
  code: string,
  message: string,
): NewResourceGateIssue {
  return { resourceId, family, code, message };
}

function rangesOverlap(resource: ChangedRegisteredResourceInput, range: DiffLineRange): boolean {
  return range.start <= resource.lineEnd && range.end >= resource.lineStart;
}

function braceDelta(line: string): number {
  let delta = 0;
  for (const char of line) {
    if (char === '{') delta += 1;
    if (char === '}') delta -= 1;
  }
  return delta;
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

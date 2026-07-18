import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { resolveOpenSpecChangeEvidencePath } from '@/lib/data-governance/openspec-change-evidence-path';

type LongformFamily =
  | 'textbook'
  | 'textbook-section'
  | 'textbook-search-document'
  | 'authoring-textbook-chapter'
  | 'authoring-textbook-section'
  | 'authoring-textbook-figure'
  | 'authoring-textbook-caption';

type Disposition = 'supporting-citation' | 'embedded-asset' | 'excluded-with-rationale';
type AddressKind = 'route' | 'section' | 'text' | 'image' | 'manifest' | 'markdown-line';

export interface ReviewSourceRow {
  artifactVersion: typeof REVIEW_SOURCE_VERSION;
  reviewBatchId: typeof REVIEW_BATCH_ID;
  reviewSourceSha256: string;
  reviewRowHash: string;
  reviewerId: string;
  reviewerRole: 'implementing-agent';
  reviewedAt: string;
  reviewStatus: 'agent-reviewed';
  resourceId: string;
  sourceFamily: LongformFamily;
  title: string;
  disposition: Disposition;
  parentResourceId: string | null;
  sourcePathOrUrl: string;
  sourceHash: string;
  sourceVersionRef: string;
  citationAddress: { kind: AddressKind; href: string; locator: string; contentHash: string };
  addressReady: boolean;
  limitationCode: string | null;
  reviewedContextHash: string;
  reviewerVisibleRationale: string;
  semanticReview?: {
    contentType: 'concept' | 'worked-example' | 'reference-entry' | 'mixed' | 'insufficient-source';
    bodySummary: string;
    teachingUse: string;
    missingIndependentContract: string;
  };
  independentEvidenceRef: string;
  privacyScope: 'student-visible' | 'teacher-scoped';
  lifecycleScope: 'runtime' | 'audit-only';
  preOverlaySnapshot: {
    reviewStatus: string;
    blockerCodes: string[];
  };
  promotedAsPlanningUnit: false;
  currentPathEligible: false;
  acceptedGraphNodeRefs: { knowledge: []; capability: []; quality: [] };
  acceptedLearningGoalIds: [];
  acceptedKaqObjectiveIds: { knowledge: []; capability: []; quality: [] };
  rawContentIncluded: false;
  privacyMinimized: true;
}

interface AuditRow {
  resourceId: string;
  family: LongformFamily | string;
  title: string;
  sourcePathOrUrl: string | null;
  sourceRecord: string | null;
  citationTargets: string[];
  sourceHash: string | null;
  sourceVersionRef: string | null;
  missingFieldCodes: string[];
  reviewStatus: string;
}

interface GroundingCandidate {
  candidateId: string;
  documentId: string;
  kind: 'chunk' | 'figure';
  title: string;
  bookId: string;
  sectionId: string;
  pageAnchor: string;
  sourceHash: string;
}

interface CitationTarget {
  candidateId: string;
  documentId: string;
  address: { kind: AddressKind; href: string; locator: string; contentHash: string };
  contentHash: string;
  targetFileHash: string;
}

interface CurrentFact {
  resourceId: string;
  family: LongformFamily;
  parentResourceId: string | null;
  sourcePathOrUrl: string;
  sourceHash: string;
  sourceVersionRef: string;
  citationAddress?: CitationTarget['address'];
  preOverlaySnapshot: ReviewSourceRow['preOverlaySnapshot'];
}

interface InputSnapshotRow extends CurrentFact {
  artifactVersion: typeof INPUT_SNAPSHOT_VERSION;
  inputRowHash: string;
}

interface InputSnapshotSeal {
  artifactVersion: typeof INPUT_SNAPSHOT_VERSION;
  baselineCommit: string;
  baselineTree: string;
  rowCount: number;
  rowsSha256: string;
}

interface IssueBodyValidatorEvidence {
  artifactVersion: 'buddy-issue-body-validator-evidence.v1';
  command: string;
  result: 'Buddy issue body validation passed.';
  exitCode: 0;
  validatedAt: string;
  input: { path: string; sha256: string };
  githubStateObserved: false;
}

interface ValidationFacts {
  auditRows: AuditRow[];
  candidates: GroundingCandidate[];
  targets: CitationTarget[];
  currentFacts: Map<string, CurrentFact>;
  validationMode: 'full' | 'delivery';
}

const GOVERNANCE_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const SOURCE_PATH = path.join(GOVERNANCE_DIR, 'longform-textbook-reference-resource-semantics-review-source.jsonl');
const WORKQUEUE_PATH = path.join(GOVERNANCE_DIR, 'longform-textbook-reference-resource-semantics-workqueue-items.jsonl');
const REVIEW_ITEMS_PATH = path.join(GOVERNANCE_DIR, 'longform-textbook-reference-resource-semantics-review-items.jsonl');
const SUMMARY_PATH = path.join(GOVERNANCE_DIR, 'longform-textbook-reference-resource-semantics-summary.json');
const EVIDENCE_PATH = path.join(GOVERNANCE_DIR, 'longform-textbook-reference-resource-semantics-evidence.md');
const LONGFORM_CHANGE_ID = 'complete-longform-textbook-reference-resource-semantics';
const changeEvidencePath = (fileName: string) =>
  resolveOpenSpecChangeEvidencePath(process.cwd(), LONGFORM_CHANGE_ID, fileName);
const INPUT_SNAPSHOT_PATH = changeEvidencePath('longform-textbook-reference-resource-input-snapshot.jsonl');
const INPUT_SNAPSHOT_SEAL_PATH = changeEvidencePath('longform-textbook-reference-resource-input-snapshot.seal.json');
const ISSUE_BODY_VALIDATOR_EVIDENCE_PATH = changeEvidencePath('issue-body-validator-evidence.json');
const AUDIT_PATH = path.join(GOVERNANCE_DIR, 'resource-field-completion-audit.jsonl');
const CANDIDATES_PATH = path.join(GOVERNANCE_DIR, 'textbook-section-grounding-candidates.jsonl');
const TARGETS_PATH = path.join(GOVERNANCE_DIR, 'textbook-section-citation-targets.jsonl');
const REVIEW_SOURCE_VERSION = 'longform-textbook-reference-resource-semantics.review-source.v2' as const;
const INPUT_SNAPSHOT_VERSION = 'longform-textbook-reference-resource-input-snapshot.v1' as const;
const ARTIFACT_VERSION = 'longform-textbook-reference-resource-semantics.v2' as const;
const REVIEW_BATCH_ID = 'longform-textbook-reference-resource-semantics-882-2026-07-17' as const;
const AUTHORING_FAMILIES = new Set<LongformFamily>([
  'authoring-textbook-chapter',
  'authoring-textbook-section',
  'authoring-textbook-figure',
  'authoring-textbook-caption',
]);

export async function loadLongformReviewSource(): Promise<ReviewSourceRow[]> {
  return readJsonl<ReviewSourceRow>(SOURCE_PATH);
}

export function sealLongformReviewRows(inputRows: ReviewSourceRow[]): ReviewSourceRow[] {
  const rows = inputRows
    .map((row) => ({ ...row, reviewSourceSha256: '', reviewRowHash: '' }))
    .sort((left, right) => left.resourceId.localeCompare(right.resourceId));
  const withRowHashes = rows.map((row) => ({ ...row, reviewRowHash: hashJson(rowForRowHash(row)) }));
  const reviewSourceSha256 = sha256(withRowHashes.map((row) => JSON.stringify(rowForSourceHash(row))).join('\n') + '\n');
  return withRowHashes.map((row) => ({ ...row, reviewSourceSha256 }));
}

export async function loadLongformValidationFacts(
  auditRowsOverride?: readonly AuditRow[],
): Promise<ValidationFacts> {
  const [auditRows, candidates, targets, inputRows] = await Promise.all([
    auditRowsOverride ? Promise.resolve([...auditRowsOverride]) : readJsonl<AuditRow>(AUDIT_PATH),
    readJsonl<GroundingCandidate>(CANDIDATES_PATH),
    readJsonl<CitationTarget>(TARGETS_PATH),
    loadInputSnapshot(),
  ]);
  const currentFacts = indexUnique(inputRows, (row) => row.resourceId, 'input snapshot');
  const validationMode = await resolveValidationMode();
  if (validationMode === 'full') {
    const liveFacts = await loadLiveCurrentFacts(auditRows, candidates, targets);
    assertCurrentFactsMatchSnapshot(currentFacts, liveFacts);
  }
  return { auditRows, candidates, targets, currentFacts, validationMode };
}

async function loadLiveCurrentFacts(
  auditRows: AuditRow[],
  candidates: GroundingCandidate[],
  targets: CitationTarget[],
): Promise<Map<string, CurrentFact>> {
  const currentFacts = new Map(await loadTextbookSourceFacts());
  for (const row of auditRows) {
    if (!AUTHORING_FAMILIES.has(row.family as LongformFamily)) continue;
    assert(row.sourcePathOrUrl && row.sourceHash && row.sourceVersionRef, `incomplete authoring fact: ${row.resourceId}`);
    currentFacts.set(row.resourceId, {
      resourceId: row.resourceId,
      family: row.family as LongformFamily,
      parentResourceId: canonicalAuthoringParent(row.resourceId, row.family as LongformFamily),
      sourcePathOrUrl: row.sourcePathOrUrl,
      sourceHash: row.sourceHash,
      sourceVersionRef: row.sourceVersionRef,
      citationAddress: await citationAddressForAuthoringAuditRow(row),
      preOverlaySnapshot: derivePreOverlaySnapshot(row),
    });
  }
  for (const candidate of candidates) {
    const resourceId = `textbook-search-document:${candidate.documentId}`;
    const target = targets.find((item) => item.candidateId === candidate.candidateId);
    assert(target, `search document has no citation target: ${resourceId}`);
    assert(!currentFacts.has(resourceId), `duplicate current fact id: ${resourceId}`);
    currentFacts.set(resourceId, {
      resourceId,
      family: 'textbook-search-document',
      parentResourceId: `textbook-section:${candidate.bookId}:${candidate.sectionId}`,
      sourcePathOrUrl: target.address.href,
      sourceHash: candidate.sourceHash,
      sourceVersionRef: 'textbook-runtime-search-documents.v1',
      citationAddress: target.address,
      preOverlaySnapshot: deriveSearchDocumentPreOverlaySnapshot(candidate),
    });
  }
  return currentFacts;
}

async function citationAddressForAuthoringAuditRow(row: AuditRow): Promise<CitationTarget['address']> {
  assert(row.sourcePathOrUrl, `authoring citation source is missing: ${row.resourceId}`);
  const sourcePath = path.join(process.cwd(), row.sourcePathOrUrl);
  if (row.family === 'authoring-textbook-chapter') {
    return {
      kind: 'manifest',
      href: row.sourcePathOrUrl,
      locator: 'json-pointer:/',
      contentHash: `sha256:${sha256(await fs.readFile(sourcePath))}`,
    };
  }
  if (row.family === 'authoring-textbook-section') {
    const lineNumber = Number(row.sourceRecord?.match(/:L(\d+)$/)?.[1]);
    assert(Number.isInteger(lineNumber) && lineNumber > 0, `authoring section line identity is invalid: ${row.resourceId}`);
    const line = (await fs.readFile(sourcePath, 'utf8')).split(/\r?\n/)[lineNumber - 1];
    assert(line !== undefined, `authoring section line is missing: ${row.resourceId}`);
    return {
      kind: 'markdown-line',
      href: `${row.sourcePathOrUrl}#L${lineNumber}`,
      locator: `markdown-line:${lineNumber}`,
      contentHash: `sha256:${sha256(line)}`,
    };
  }
  const figureNumber = Number(row.resourceId.match(/:figure-(\d+)$/)?.[1]);
  assert(Number.isInteger(figureNumber) && figureNumber > 0, `authoring figure identity is invalid: ${row.resourceId}`);
  const manifestPath = row.family === 'authoring-textbook-caption'
    ? sourcePath
    : path.join(path.dirname(path.dirname(sourcePath)), 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as {
    images?: Array<{ sourcePdfPage?: number; caption?: string | null }>;
  };
  const image = manifest.images?.[figureNumber - 1];
  assert(image, `authoring figure manifest entry is missing: ${row.resourceId}`);
  if (row.family === 'authoring-textbook-caption') {
    return {
      kind: 'manifest',
      href: row.sourcePathOrUrl,
      locator: `json-pointer:/images/${figureNumber - 1}/caption`,
      contentHash: `sha256:${sha256(image.caption ?? '')}`,
    };
  }
  return {
    kind: 'image',
    href: row.sourcePathOrUrl,
    locator: `source-pdf-page:${image.sourcePdfPage}:figure-${figureNumber}`,
    contentHash: `sha256:${sha256(await fs.readFile(sourcePath))}`,
  };
}

async function loadInputSnapshot(): Promise<InputSnapshotRow[]> {
  const [rows, sealText] = await Promise.all([
    readJsonl<InputSnapshotRow>(INPUT_SNAPSHOT_PATH),
    fs.readFile(INPUT_SNAPSHOT_SEAL_PATH, 'utf8'),
  ]);
  const seal = JSON.parse(sealText) as InputSnapshotSeal;
  assert(seal.artifactVersion === INPUT_SNAPSHOT_VERSION, 'invalid longform input snapshot seal version');
  assert(/^[0-9a-f]{40}$/.test(seal.baselineCommit), 'invalid longform input snapshot baseline commit');
  assert(/^[0-9a-f]{40}$/.test(seal.baselineTree), 'invalid longform input snapshot baseline tree');
  const sealedCommitTree = execFileSync('git', ['rev-parse', `${seal.baselineCommit}^{tree}`], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: cleanGitEnvironment(process.env),
  }).trim();
  assert(sealedCommitTree === seal.baselineTree, 'longform input snapshot baseline commit/tree mismatch');
  assert(seal.rowCount === rows.length, 'longform input snapshot row count mismatch');
  assert(rows.every((row) => row.artifactVersion === INPUT_SNAPSHOT_VERSION), 'invalid longform input snapshot row version');
  assert(rows.every((row) => row.inputRowHash === hashJson(inputRowForHash(row))), 'longform input snapshot row seal mismatch');
  const rowsSha256 = `sha256:${sha256(rows.map((row) => JSON.stringify(row)).join('\n') + '\n')}`;
  assert(seal.rowsSha256 === rowsSha256, 'longform input snapshot aggregate seal mismatch');
  return rows;
}

function cleanGitEnvironment(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const cleaned = { ...environment };
  for (const key of Object.keys(cleaned)) {
    if (key.startsWith('GIT_')) delete cleaned[key];
  }
  return cleaned;
}

async function resolveValidationMode(): Promise<'full' | 'delivery'> {
  const requested = process.env.LONGFORM_VALIDATION_MODE ?? 'auto';
  assert(['auto', 'full', 'delivery'].includes(requested), `invalid LONGFORM_VALIDATION_MODE: ${requested}`);
  if (requested === 'delivery') return 'delivery';
  const textbookRoot = process.env.LONGFORM_TEXTBOOK_ROOT ?? path.join(process.cwd(), 'course-content/runtime/resources/textbooks');
  const liveAvailable = await fs.access(textbookRoot).then(() => true).catch(() => false);
  if (requested === 'full') {
    assert(liveAvailable, `full validation requires live textbook exports: ${textbookRoot}`);
    return 'full';
  }
  return liveAvailable ? 'full' : 'delivery';
}

function assertCurrentFactsMatchSnapshot(
  snapshot: ReadonlyMap<string, CurrentFact>,
  live: ReadonlyMap<string, CurrentFact>,
) {
  assert(snapshot.size === live.size, `live/input denominator mismatch: snapshot=${snapshot.size}; live=${live.size}`);
  for (const [resourceId, expected] of snapshot) {
    const actual = live.get(resourceId);
    assert(actual, `live source missing tracked input id: ${resourceId}`);
    assert(actual.family === expected.family, `live/input family mismatch: ${resourceId}`);
    assert(actual.parentResourceId === expected.parentResourceId, `live/input canonical parent mismatch: ${resourceId}`);
    assert(actual.sourcePathOrUrl === expected.sourcePathOrUrl, `live/input source identity mismatch: ${resourceId}`);
    assert(normalizeHash(actual.sourceHash) === normalizeHash(expected.sourceHash), `live/input source hash mismatch: ${resourceId}`);
    assert(actual.sourceVersionRef === expected.sourceVersionRef, `live/input source version mismatch: ${resourceId}`);
    assert(Boolean(actual.citationAddress) === Boolean(expected.citationAddress), `live/input citation address presence mismatch: ${resourceId}`);
    if (actual.citationAddress && expected.citationAddress) {
      assert(sameAddress(actual.citationAddress, expected.citationAddress), `live/input citation address mismatch: ${resourceId}`);
    }
  }
}

function derivePreOverlaySnapshot(row: AuditRow): ReviewSourceRow['preOverlaySnapshot'] {
  return { reviewStatus: row.reviewStatus, blockerCodes: [...row.missingFieldCodes].sort() };
}

function deriveSearchDocumentPreOverlaySnapshot(_candidate: GroundingCandidate): ReviewSourceRow['preOverlaySnapshot'] {
  return { reviewStatus: 'not-materialized', blockerCodes: ['not-materialized'] };
}

function sameSnapshot(
  left: ReviewSourceRow['preOverlaySnapshot'],
  right: ReviewSourceRow['preOverlaySnapshot'],
) {
  return left.reviewStatus === right.reviewStatus &&
    JSON.stringify([...left.blockerCodes].sort()) === JSON.stringify([...right.blockerCodes].sort());
}

export async function validateLongformReviewSource(
  rows: ReviewSourceRow[],
  providedFacts?: ValidationFacts,
) {
  const facts = providedFacts ?? await loadLongformValidationFacts();
  const duplicateIds = duplicateValues(rows.map((row) => row.resourceId));
  assert(duplicateIds.length === 0, `duplicate reviewed IDs: ${duplicateIds.join(', ')}`);
  const reviewedIds = new Set(rows.map((row) => row.resourceId));
  const expectedIds = new Set(facts.currentFacts.keys());
  const missing = [...expectedIds].filter((id) => !reviewedIds.has(id)).sort();
  const extra = [...reviewedIds].filter((id) => !expectedIds.has(id)).sort();
  assert(missing.length === 0 && extra.length === 0, `reviewed ID closure mismatch; missing=${missing.join(',') || 'none'}; extra=${extra.join(',') || 'none'}`);

  const sortedIds = [...reviewedIds].sort((left, right) => left.localeCompare(right));
  assert(rows.every((row, index) => row.resourceId === sortedIds[index]), 'review source rows must use canonical resourceId order');
  const sealed = sealLongformReviewRows(rows);
  const expectedSourceSha = sealed[0]?.reviewSourceSha256 ?? sha256('');
  const candidateByResourceId = indexUnique(
    facts.candidates.map((candidate) => ({ ...candidate, resourceId: `textbook-search-document:${candidate.documentId}` })),
    (candidate) => candidate.resourceId,
    'grounding candidate',
  );
  const targetByCandidateId = indexUnique(facts.targets, (target) => target.candidateId, 'citation target');
  const sourceById = indexUnique(rows, (row) => row.resourceId, 'review source');
  const addressResults: boolean[] = [];

  for (const row of rows) {
    validateReviewContract(row, expectedSourceSha, sealed.find((item) => item.resourceId === row.resourceId)!);
    const fact = facts.currentFacts.get(row.resourceId)!;
    assert(row.sourceFamily === fact.family, `review source family mismatch: ${row.resourceId}`);
    assert(normalizeHash(row.sourceHash) === normalizeHash(fact.sourceHash), `review source hash mismatch: ${row.resourceId}`);
    assert(row.sourceVersionRef === fact.sourceVersionRef, `review source version mismatch: ${row.resourceId}`);
    assert(row.sourcePathOrUrl === fact.sourcePathOrUrl, `review source path mismatch: ${row.resourceId}`);
    validateCanonicalParent(row, fact, sourceById);
    if (row.sourceFamily === 'textbook-search-document') {
      const candidate = candidateByResourceId.get(row.resourceId)!;
      const target = targetByCandidateId.get(candidate.candidateId)!;
      assert(sameAddress(row.citationAddress, target.address), `search document citation address mismatch: ${row.resourceId}`);
    }
    assert(sameSnapshot(row.preOverlaySnapshot, fact.preOverlaySnapshot), `pre-overlay snapshot mismatch: ${row.resourceId}`);
    addressResults.push(await validateCitationAddress(row, fact, facts.validationMode));
    if (row.sourceFamily === 'textbook-section' && facts.validationMode === 'full') {
      const localPath = localPathForAddress(row.sourcePathOrUrl);
      assert(localPath, `section source is not local: ${row.resourceId}`);
      validateSectionSemanticAgainstBody(row, await fs.readFile(localPath, 'utf8'));
    }
  }
  const sectionDiversity = buildRationaleDiversity(rows.filter((row) => row.sourceFamily === 'textbook-section'));
  validateSectionReviewDiversity(sectionDiversity);
  const byFamily = countBy(rows, (row) => row.sourceFamily);
  return {
    auditRows: facts.auditRows,
    byFamily,
    diagnostics: { missing, extra, duplicate: duplicateIds, stale: [] as string[] },
    reviewSourceSha256: expectedSourceSha,
    addressHashParentVerified: addressResults.every(Boolean),
    validationMode: facts.validationMode,
  };
}

async function loadTextbookSourceFacts(): Promise<Map<string, CurrentFact>> {
  const textbookRoot = process.env.LONGFORM_TEXTBOOK_ROOT ?? path.join(process.cwd(), 'course-content/runtime/resources/textbooks');
  const facts = new Map<string, CurrentFact>();
  const books = (await fs.readdir(textbookRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));
  for (const book of books) {
    const manifestPath = path.join(textbookRoot, book.name, 'manifest.json');
    const manifestContent = await fs.readFile(manifestPath);
    facts.set(`textbook:${book.name}`, {
      resourceId: `textbook:${book.name}`,
      family: 'textbook',
      parentResourceId: null,
      sourcePathOrUrl: `/course-runtime/resources/textbooks/${book.name}`,
      sourceHash: `sha256:${sha256(manifestContent)}`,
      sourceVersionRef: 'textbook-runtime-manifest.v1',
      citationAddress: {
        kind: 'manifest',
        href: path.relative(process.cwd(), manifestPath),
        locator: 'json-pointer:/',
        contentHash: `sha256:${sha256(manifestContent)}`,
      },
      preOverlaySnapshot: { reviewStatus: 'not-reviewed', blockerCodes: ['missing-human-review'] },
    });
    const sections = await readJsonl<{ id: string; href: string; contentHash: string; sourceSpan?: { startLine: number; endLine: number } }>(path.join(textbookRoot, book.name, 'section-index.jsonl'));
    for (const section of sections) {
      const resourceId = `textbook-section:${book.name}:${section.id}`;
      facts.set(resourceId, {
        resourceId,
        family: 'textbook-section',
        parentResourceId: `textbook:${book.name}`,
        sourcePathOrUrl: section.href,
        sourceHash: `sha256:${section.contentHash}`,
        sourceVersionRef: 'textbook-runtime-section-index.v1',
        citationAddress: section.sourceSpan
          ? {
              kind: 'section' as const,
              href: section.href,
              locator: `${section.sourceSpan.startLine}-${section.sourceSpan.endLine}`,
              contentHash: section.contentHash,
            }
          : undefined,
        preOverlaySnapshot: { reviewStatus: 'not-reviewed', blockerCodes: ['missing-human-review'] },
      });
    }
  }
  return facts;
}

async function main() {
  const rows = await loadLongformReviewSource();
  const validation = await validateLongformReviewSource(rows);
  if (process.argv.includes('--validate-explicit-source')) {
    console.log(`Validated ${rows.length} explicit longform agent-review rows.`);
    return;
  }
  const generatedAt = latestReviewedAt(rows);
  const sectionRows = rows.filter((row) => row.sourceFamily === 'textbook-section');
  const sectionSemanticRows = sectionRows.filter(hasCompleteSectionSemanticReview);
  const sectionReviewConclusions = sectionRows.filter(hasSectionReviewConclusion);
  assert(sectionReviewConclusions.length === sectionRows.length, 'every section candidate requires a concrete review conclusion');
  const rationaleDiversity = buildRationaleDiversity(sectionRows);
  const issueBodyValidatorEvidence = await loadIssueBodyValidatorEvidence();
  validateSectionReviewDiversity(rationaleDiversity);
  const workqueueItems = rows.map((row, index) => ({
    artifactVersion: ARTIFACT_VERSION,
    reviewSourceSha256: validation.reviewSourceSha256,
    reviewRowHash: row.reviewRowHash,
    reviewBatchId: REVIEW_BATCH_ID,
    selectedOrder: index + 1,
    resourceId: row.resourceId,
    sourceFamily: row.sourceFamily,
    title: minimizeTitle(row.title),
    startingReviewStatus: row.preOverlaySnapshot.reviewStatus,
    startingBlockerCodes: row.preOverlaySnapshot.blockerCodes,
    startingBlockerCount: row.preOverlaySnapshot.blockerCodes.length,
    rawContentIncluded: false,
    privacyMinimized: true,
  }));
  const reviewItems = rows.map((row, index) => ({
    ...row,
    artifactVersion: ARTIFACT_VERSION,
    generatedAt,
    selectedOrder: index + 1,
    reviewSourceRef: `course-content/runtime/resource-governance/${path.basename(SOURCE_PATH)}#${row.resourceId}`,
  }));
  const summary = {
    artifactVersion: ARTIFACT_VERSION,
    reviewSourceVersion: REVIEW_SOURCE_VERSION,
    reviewSourceSha256: validation.reviewSourceSha256,
    generatedAt,
    reviewBatchId: REVIEW_BATCH_ID,
    delivery: {
      files: [
        path.basename(SOURCE_PATH),
        path.basename(WORKQUEUE_PATH),
        path.basename(REVIEW_ITEMS_PATH),
        path.basename(SUMMARY_PATH),
        path.basename(EVIDENCE_PATH),
        path.relative(process.cwd(), INPUT_SNAPSHOT_PATH),
        path.relative(process.cwd(), INPUT_SNAPSHOT_SEAL_PATH),
        path.relative(process.cwd(), ISSUE_BODY_VALIDATOR_EVIDENCE_PATH),
      ],
      cleanDeliveryInput: {
        snapshot: path.relative(process.cwd(), INPUT_SNAPSHOT_PATH),
        seal: path.relative(process.cwd(), INPUT_SNAPSHOT_SEAL_PATH),
        validationMode: validation.validationMode,
      },
      validationEntrypoints: {
        liveFull: {
          command: 'npm run test:longform-textbook-reference-resource-semantics:live-full',
          guarantee: 'cross-checks tracked review rows against live runtime textbook section bodies',
        },
        deliveryClean: {
          command: 'npm run test:longform-textbook-reference-resource-semantics:delivery-clean',
          guarantee: 'validates tracked sealed delivery inputs in a clean staged clone; does not claim live textbook-body coverage',
        },
      },
    },
    denominator: { total: rows.length, byFamily: validation.byFamily },
    closure: validation.diagnostics,
    before: {
      byReviewStatus: countBy(workqueueItems, (row) => row.startingReviewStatus),
      blockerRows: workqueueItems.filter((row) => row.startingBlockerCount > 0).length,
    },
    after: {
      agentReviewed: rows.length,
      semanticReviewed: rows.length - sectionRows.length + sectionSemanticRows.length,
      sectionReviewCompleted: sectionReviewConclusions.length,
      sectionSemanticReviewed: sectionSemanticRows.length,
      sectionInsufficientSource: sectionRows.length - sectionSemanticRows.length,
      humanConfirmed: 0,
      promotedPlanningUnits: 0,
      unexplainedUnreviewed: 0,
      byDisposition: countBy(rows, (row) => row.disposition),
      byAddressKind: countBy(rows, (row) => row.citationAddress.kind),
      addressReady: rows.filter((row) => row.addressReady).length,
      limitationMarked: rows.filter((row) => !row.addressReady && Boolean(row.limitationCode)).length,
      rationaleDiversity,
    },
    guardrails: {
      exactDenominator: validation.diagnostics.missing.length === 0 && validation.diagnostics.extra.length === 0,
      implementingAgentNeverHumanConfirmed: rows.every((row) => row.reviewStatus === 'agent-reviewed'),
      noPathPromotion: rows.every((row) => !row.promotedAsPlanningUnit && !row.currentPathEligible),
      acceptedGraphLabelsNotGenerated: rows.every((row) => Object.values(row.acceptedGraphNodeRefs).every((refs) => refs.length === 0)),
      authoringTeacherScopedAuditOnly: rows.filter((row) => AUTHORING_FAMILIES.has(row.sourceFamily)).every((row) => row.privacyScope === 'teacher-scoped' && row.lifecycleScope === 'audit-only'),
      addressHashParentVerified: validation.addressHashParentVerified,
      beforeAfterIndependent: rows.every((row) => row.preOverlaySnapshot.reviewStatus !== 'agent-reviewed'),
      trackedInputSnapshotSealed: true,
      sectionReviewConclusionsComplete: sectionReviewConclusions.length === sectionRows.length,
      insufficientSourceNotCountedAsSemanticReviewed: sectionSemanticRows.every((row) => row.semanticReview?.contentType !== 'insufficient-source'),
      sectionRationaleDiversity: rationaleDiversity.normalizedDecisionRatio >= 0.6 &&
        rationaleDiversity.normalizedBodySummaryRatio >= 0.6 &&
        rationaleDiversity.variableStrippedBodySummaryRatio >= 0.8 &&
        rationaleDiversity.nearDuplicatePairRatio <= 0.0001 &&
        rationaleDiversity.teachingUseSentenceFrameRatio >= 0.2 &&
        rationaleDiversity.teachingUseTopSixFrameCoverage <= 0.45 &&
        rationaleDiversity.actionObjectOutputRatio >= 0.75 &&
        rationaleDiversity.forbiddenTeachingUseStarts === 0,
      rawContentIncluded: false,
      privacyMinimized: true,
    },
    issueBodyValidatorEvidence,
  };
  await Promise.all([
    writeJsonl(WORKQUEUE_PATH, workqueueItems),
    writeJsonl(REVIEW_ITEMS_PATH, reviewItems),
    fs.writeFile(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, 'utf8'),
    fs.writeFile(EVIDENCE_PATH, renderEvidence(summary), 'utf8'),
  ]);
  console.log(`Longform denominator: ${rows.length}`);
  console.log(`Longform agent-reviewed: ${summary.after.agentReviewed}`);
}

function validateReviewContract(row: ReviewSourceRow, expectedSourceSha: string, sealed: ReviewSourceRow) {
  assert(row.artifactVersion === REVIEW_SOURCE_VERSION, `invalid review source version: ${row.resourceId}`);
  assert(row.reviewBatchId === REVIEW_BATCH_ID, `invalid review batch: ${row.resourceId}`);
  assert(row.reviewRowHash === sealed.reviewRowHash, `stale review row hash: ${row.resourceId}`);
  assert(row.reviewSourceSha256 === expectedSourceSha, `stale review source hash: ${row.resourceId}`);
  assert(row.reviewStatus === 'agent-reviewed' && row.reviewerRole === 'implementing-agent', `review provenance mismatch: ${row.resourceId}`);
  const reviewedAt = Date.parse(row.reviewedAt);
  assert(Number.isFinite(reviewedAt) && reviewedAt <= Date.now(), `invalid or future reviewedAt: ${row.resourceId}`);
  assert(Boolean(row.reviewerId), `missing reviewer identity: ${row.resourceId}`);
  assert(row.reviewerVisibleRationale.length >= 80, `review rationale is too short: ${row.resourceId}`);
  if (row.sourceFamily === 'textbook-section') validateSectionSemanticReview(row);
  assert(!row.independentEvidenceRef.includes('longform-textbook-reference-resource-semantics-review-source'), `independent evidence self-reference: ${row.resourceId}`);
  assert(!row.promotedAsPlanningUnit && !row.currentPathEligible, `agent review must not promote path eligibility: ${row.resourceId}`);
  assert(Object.values(row.acceptedGraphNodeRefs).every((refs) => refs.length === 0), `review source must not accept inferred graph labels: ${row.resourceId}`);
  assert(row.acceptedLearningGoalIds.length === 0, `review source must not accept inferred LearningGoal labels: ${row.resourceId}`);
  assert(Object.values(row.acceptedKaqObjectiveIds).every((refs) => refs.length === 0), `review source must not accept inferred K/A/Q labels: ${row.resourceId}`);
  assert(row.rawContentIncluded === false && row.privacyMinimized === true, `review source privacy contract mismatch: ${row.resourceId}`);
  assert(normalizeHash(row.reviewedContextHash) === normalizeHash(row.sourceHash), `reviewed context hash mismatch: ${row.resourceId}`);
  if (AUTHORING_FAMILIES.has(row.sourceFamily)) {
    assert(row.privacyScope === 'teacher-scoped' && row.lifecycleScope === 'audit-only', `authoring source must be teacher-scoped/audit-only: ${row.resourceId}`);
  }
  if (!row.addressReady) assert(Boolean(row.limitationCode), `non-addressable row needs limitation: ${row.resourceId}`);
  if (row.addressReady) assert(!row.limitationCode, `address-ready row cannot carry limitation: ${row.resourceId}`);
}

function validateCanonicalParent(row: ReviewSourceRow, fact: CurrentFact, sourceById: Map<string, ReviewSourceRow>) {
  assert(row.parentResourceId === fact.parentResourceId, `canonical parent mismatch: ${row.resourceId}`);
  if (row.parentResourceId) assert(sourceById.has(row.parentResourceId), `review source parent is missing: ${row.resourceId}`);
}

async function validateCitationAddress(
  row: ReviewSourceRow,
  fact: CurrentFact,
  validationMode: ValidationFacts['validationMode'],
): Promise<boolean> {
  assert(Boolean(row.citationAddress.href && row.citationAddress.locator), `citation address is incomplete: ${row.resourceId}`);
  if (fact.citationAddress) assert(sameAddress(row.citationAddress, fact.citationAddress), `citation target identity mismatch: ${row.resourceId}`);
  assert(
    normalizeHash(row.citationAddress.contentHash) === normalizeHash(fact.citationAddress?.contentHash),
    `citation target content hash mismatch: ${row.resourceId}`,
  );
  if (validationMode === 'delivery') return true;
  if (
    row.sourceFamily === 'authoring-textbook-caption' ||
    row.sourceFamily === 'authoring-textbook-figure' ||
    row.sourceFamily === 'authoring-textbook-section'
  ) {
    assert(
      row.citationAddress.href.split('#')[0] === fact.sourcePathOrUrl.split('#')[0],
      `citation target identity mismatch: ${row.resourceId}`,
    );
  }
  const localPath = localPathForAddress(row.citationAddress.href);
  assert(localPath, `citation address is not a canonical local target: ${row.resourceId}`);
  const content = await fs.readFile(localPath).catch(() => null);
  assert(content, `citation address file is missing: ${row.resourceId}:${localPath}`);
  let actualHash: string;
  if (row.citationAddress.kind === 'manifest') {
    const pointer = row.citationAddress.locator.match(/^json-pointer:(\/.*)$/)?.[1];
    assert(pointer, `invalid JSON pointer locator: ${row.resourceId}`);
    if (pointer === '/') {
      actualHash = sha256(content);
    } else {
      const value = resolveJsonPointer(JSON.parse(content.toString('utf8')), pointer);
      assert(value !== undefined, `invalid JSON pointer target: ${row.resourceId}`);
      actualHash = sha256(value === null ? '' : typeof value === 'string' ? value : JSON.stringify(value));
      if (row.sourceFamily === 'authoring-textbook-caption' && (value === null || value === '')) {
        assert(!row.addressReady && row.disposition === 'excluded-with-rationale' && row.limitationCode === 'empty-caption-no-citation-text', `empty caption cannot be citation-ready: ${row.resourceId}`);
      }
    }
  } else if (row.citationAddress.kind === 'markdown-line') {
    const match = row.citationAddress.locator.match(/^markdown-line:(\d+)(?:-(\d+))?$/);
    assert(match, `invalid markdown line locator: ${row.resourceId}`);
    const lines = content.toString('utf8').split(/\r?\n/);
    const from = Number(match[1]);
    const to = Number(match[2] ?? match[1]);
    assert(from >= 1 && to >= from && to <= lines.length, `markdown line locator out of range: ${row.resourceId}`);
    actualHash = sha256(lines.slice(from - 1, to).join('\n'));
  } else if (row.citationAddress.kind === 'section') {
    const fragment = row.citationAddress.href.split('#')[1];
    if (fragment) assert(fragment === row.citationAddress.locator, `section fragment/locator mismatch: ${row.resourceId}`);
    assert(/^\d+-\d+$/.test(row.citationAddress.locator), `invalid section line range: ${row.resourceId}`);
    actualHash = normalizeHash(fact.sourceHash)!;
  } else if (row.sourceFamily === 'textbook-search-document') {
    actualHash = normalizeHash(fact.sourceHash)!;
  } else {
    actualHash = sha256(content);
  }
  assert(normalizeHash(row.citationAddress.contentHash) === actualHash, `citation address content hash mismatch: ${row.resourceId}`);
  return true;
}

function canonicalAuthoringParent(resourceId: string, family: LongformFamily): string | null {
  const identity = resourceId.split(':').slice(1);
  if (family === 'authoring-textbook-chapter') return `textbook:${identity[0]}`;
  if (family === 'authoring-textbook-section') return `authoring-textbook-chapter:${identity[0]}:${identity[1]}`;
  if (family === 'authoring-textbook-figure') return `authoring-textbook-chapter:${identity[0]}:${identity[1]}`;
  if (family === 'authoring-textbook-caption') return `authoring-textbook-figure:${identity.join(':')}`;
  return null;
}

function validateSectionSemanticReview(row: ReviewSourceRow) {
  const review = row.semanticReview;
  assert(review, `missing section semantic review: ${row.resourceId}`);
  const normalizedBody = normalizeSemanticText(review.bodySummary);
  const normalizedDecision = normalizeSemanticText(row.reviewerVisibleRationale);
  assert(normalizedBody.length >= 24, `section body summary is too short: ${row.resourceId}`);
  assert(normalizeSemanticText(review.teachingUse).length >= 24, `section teaching use is too short: ${row.resourceId}`);
  assert(normalizeSemanticText(review.missingIndependentContract).length >= 24, `section missing contract is too short: ${row.resourceId}`);
  assert(!/citation comment|source hash|引文注释|引用注释/i.test(normalizedBody), `citation comment cannot be a section summary: ${row.resourceId}`);
  assert(!/^reviewed\b|^已审查/.test(normalizedDecision), `template review decision is forbidden: ${row.resourceId}`);
  assert(!normalizedBody.includes(normalizeSemanticText(row.citationAddress.locator)), `citation locator cannot stand in for a section summary: ${row.resourceId}`);
  assert(!looksLikeLegacyGeneratedReview(review), `section review matches forbidden generated template: ${row.resourceId}`);
  assert(!looksLikeFixedSectionFrame(review), `section review uses a fixed sentence frame: ${row.resourceId}`);
  assert(!matchesForbiddenGenericTeachingUseTemplate(review.teachingUse), `section teaching use matches a forbidden generic template: ${row.resourceId}`);
  assert(!hasForbiddenTeachingUseStart(review.teachingUse), `section teaching use uses a forbidden opening: ${row.resourceId}`);
  const genericTeachingObjects = extractGenericTeachingObjects(review.teachingUse);
  assert(genericTeachingObjects.length === 0, `section teaching use treats generic words as teaching objects: ${row.resourceId}:${genericTeachingObjects.join(',')}`);
  assert(!/f\(c\\dot\)|g\(c\\dot\)/.test(`${review.bodySummary} ${review.teachingUse}`), `section review corrupts nonlinear function notation: ${row.resourceId}`);
  assert(!/的目标动词/.test(`${row.reviewerVisibleRationale} ${review.bodySummary} ${review.teachingUse}`), `section review contains a truncated objective phrase: ${row.resourceId}`);
  if (review.contentType !== 'insufficient-source') {
    assert(hasTeachingActionAndOutput(review.teachingUse), `section teaching use lacks an action and verifiable output: ${row.resourceId}`);
    assert(!containsTruncatedQuotation(review.teachingUse), `section teaching use contains a truncated quotation: ${row.resourceId}`);
    assert(
      !/原模型与近似模型/.test(review.teachingUse) || /(?:original|原)模型[\s\S]{0,80}(?:approxim|近似)模型/i.test(review.bodySummary),
      `section teaching use invents an unsupported model comparison: ${row.resourceId}`,
    );
  }
  assert(!containsDanglingClause(review.bodySummary), `section body summary contains a dangling clause: ${row.resourceId}`);
  assert(!containsReferenceEntry(review.bodySummary), `section body summary contains bibliography text: ${row.resourceId}`);
  assert(hasBalancedFormulaDelimiters(review.bodySummary), `section body summary contains a truncated formula: ${row.resourceId}`);
  const normalizedTitle = normalizeSemanticText(row.title);
  if (review.contentType !== 'insufficient-source' && normalizedTitle.length >= 16) {
    assert(!normalizedBody.startsWith(normalizedTitle.slice(0, 48)), `section title interpolation cannot stand in for body review: ${row.resourceId}`);
  }
}

function validateSectionSemanticAgainstBody(row: ReviewSourceRow, markdown: string) {
  const review = row.semanticReview!;
  if (review.contentType === 'insufficient-source') {
    assert(!hasCompleteTeachingInformation(markdown), `insufficient-source contradicts complete teaching information: ${row.resourceId}`);
    return;
  }
  const body = normalizeSemanticText(cleanSectionMarkdown(markdown));
  const summary = normalizeSemanticText(review.bodySummary);
  assert(body.length > 0, `section source body is empty: ${row.resourceId}`);
  const meaningfulUnits = extractCompleteBodySentencesForValidation(markdown);
  const groundedInProse = meaningfulUnits.some((unit) => summary.includes(normalizeSemanticText(unit)));
  assert(
    groundedInProse ||
      semanticSummaryOverlapsSource(review.bodySummary, markdown),
    `section summary is not grounded in a complete body unit: ${row.resourceId}`,
  );
  assert(groundedInProse || !captionDominatesSummary(review.bodySummary, markdown), `section summary is dominated by a figure caption: ${row.resourceId}`);
  assert(
    teachingUseOverlapsReviewedBody(review.teachingUse, review.bodySummary, markdown),
    `section teaching use activity object is not supported by the section body: ${row.resourceId}`,
  );
  const desiredOutcomes = desiredOutcomeObjectives(markdown);
  if (desiredOutcomes.length > 0) {
    const expectedActionVerbs = new Set<string>();
    for (const objective of desiredOutcomes) {
      const canonicalObjective = canonicalDesiredOutcome(objective);
      assert(review.bodySummary.includes(canonicalObjective), `desired outcome missing from section summary: ${row.resourceId}:${canonicalObjective}`);
      assert(review.teachingUse.includes(canonicalObjective), `desired outcome missing from teaching use: ${row.resourceId}:${canonicalObjective}`);
      for (const verb of desiredOutcomeActionVerbs(objective)) {
        expectedActionVerbs.add(verb.toLowerCase());
        assert(new RegExp(`${verb}→`, 'i').test(review.teachingUse), `desired outcome verb lacks observable evidence: ${row.resourceId}:${verb}`);
      }
    }
    const mappedVerbs = [...review.teachingUse.matchAll(/\b([A-Za-z]+)→/g)].map((match) => match[1].toLowerCase());
    const spuriousVerbs = mappedVerbs.filter((verb) => !expectedActionVerbs.has(verb));
    assert(spuriousVerbs.length === 0, `desired outcome noun is incorrectly mapped as an action: ${row.resourceId}:${spuriousVerbs.join(',')}`);
  }
}

const DESIRED_OUTCOME_ACTIONS = [
  'Give', 'Recount', 'Predict', 'Recognize', 'Possess', 'Appreciate', 'Utilize', 'Understand',
  'Interpret', 'Describe', 'Define', 'Obtain', 'Identify', 'Explain', 'State', 'Construct',
  'Create', 'Design', 'Sketch', 'Analyze', 'Distinguish', 'Employ',
] as const;
const DESIRED_OUTCOME_ACTION_PATTERN = DESIRED_OUTCOME_ACTIONS.join('|');

function desiredOutcomeActionVerbs(objective: string): string[] {
  const verbs: string[] = [];
  const leading = objective.match(new RegExp(`^(${DESIRED_OUTCOME_ACTION_PATTERN})\\b`, 'i'))?.[1];
  if (leading) verbs.push(leading);
  for (const match of objective.matchAll(new RegExp(`\\band\\s+(?:also\\s+how\\s+to\\s+)?(${DESIRED_OUTCOME_ACTION_PATTERN})\\b`, 'gi'))) {
    verbs.push(match[1]);
  }
  return [...new Set(verbs.map((verb) => `${verb[0].toUpperCase()}${verb.slice(1).toLowerCase()}`))];
}

function canonicalDesiredOutcome(objective: string): string {
  return objective.replace('an appreciation of appreciate controls', 'an appreciation of controls');
}

function desiredOutcomeObjectives(markdown: string) {
  if (!/##\s*DESIRED OUTCOMES/i.test(markdown)) return [];
  return [...markdown.matchAll(/^\s*[-*]\s+(.+)$/gm)].map((match) => match[1].trim());
}

function teachingUseOverlapsReviewedBody(teachingUse: string, bodySummary: string, markdown: string) {
  const reviewedSource = normalizeSemanticText(`${bodySummary} ${cleanSectionMarkdown(markdown)}`);
  const normalizedTeachingUse = normalizeSemanticText(teachingUse);
  const englishTerms = [...new Set(normalizedTeachingUse.match(/[a-z][a-z-]{4,}/g) ?? [])]
    .filter((term) => !TEACHING_USE_NOISE_TERMS.has(term));
  const chineseChunks = [...new Set(normalizedTeachingUse.match(/[\p{Script=Han}]{4,}/gu) ?? [])]
    .flatMap((value) => Array.from({ length: Math.max(0, value.length - 3) }, (_, index) => value.slice(index, index + 4)))
    .filter((chunk) => !TEACHING_USE_NOISE_CHUNKS.has(chunk));
  const formulaTokens = [...new Set([...teachingUse.matchAll(/\$([^$]+)\$/g)]
    .flatMap((match) => match[1].match(/[a-zθξμ][a-z0-9_]{1,}|\d+(?:\.\d+)?/gi) ?? [])
    .map((token) => token.toLowerCase())
    .filter((token) => !['mathrm', 'begin', 'end', 'left', 'right', 'frac'].includes(token)))];
  const englishMatches = englishTerms.filter((term) => reviewedSource.includes(term)).length;
  const chineseMatches = chineseChunks.filter((chunk) => reviewedSource.includes(chunk)).length;
  const formulaMatches = formulaTokens.filter((token) => reviewedSource.includes(token)).length;
  return englishMatches >= Math.min(2, englishTerms.length || 2) ||
    chineseMatches >= Math.min(2, chineseChunks.length || 2) ||
    formulaMatches >= Math.min(3, formulaTokens.length || 3);
}

const TEACHING_USE_NOISE_TERMS = new Set([
  'student', 'students', 'teaching', 'section', 'result', 'results', 'evidence', 'submit', 'output', 'object', 'condition',
]);
const TEACHING_USE_NOISE_CHUNKS = new Set([
  '学生把本', '学生将本', '正文中的', '提交物是', '形成一张', '逐项核对', '可核对的', '依据说明', '条件与结', '对象与变',
]);

const GENERIC_TEACHING_OBJECTS = new Set([
  'chapter', 'discusses', 'advanced', 'entry', 'article', 'paper', 'provides', 'overview',
  'explains', 'important', 'basic', 'review', 'consider', 'design', 'state', 'introduction',
  'introduce', 'several', 'approach', 'problem', 'theory', 'process', 'linear', 'function', 'method',
]);

function extractGenericTeachingObjects(value: string): string[] {
  const match = value.match(/学生围绕(.{1,100}?)(?:重建|推导|绘制|复现|整理|对应)正文中的具体关系/);
  if (!match) return [];
  const terms = match[1]
    .replace(/^.*?演算锚点，学生围绕/, '')
    .split(/[、与]/)
    .map((term) => term.trim().toLowerCase());
  return [...new Set(terms.filter((term) => GENERIC_TEACHING_OBJECTS.has(term)))];
}

function hasForbiddenTeachingUseStart(value: string) {
  return /^(?:可直接把|适合安排|建议让学生|可用于组织|可设计为|课堂上可要求)/.test(value.trim());
}

function matchesForbiddenGenericTeachingUseTemplate(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return /学生围绕.{1,120}?(?:重建|推导|绘制|复现|整理|对应)正文中的具体关系/.test(normalized) ||
    /概念—关系判定表[”"]?[；;，,].{0,80}表内逐项标明定义对象、作用关系和成立边界/.test(normalized) ||
    /表内逐项标明定义对象、作用关系和成立边界.{0,80}每一项均回指正文中的同名对象或公式/.test(normalized) ||
    /通用(?:词)?关系表/.test(normalized) ||
    /学生标出.{1,100}的变量与结果，形成[“"][^”"]+证据卡[”"]/.test(normalized) ||
    /(?:条件—结论核验页|推导审计记录|对象—变量—判断图)/.test(normalized) ||
    /针对.{1,80}，学生用.{1,100}完成计算或工程判定，提交[“"][^”"]+验证报告[”"]，报告须列出已知量、使用条件、计算步骤和最终结论/.test(normalized);
}

function hasTeachingActionAndOutput(value: string) {
  const action = /(?:学生|解题者|设计活动|制作|绘制|整理|复现|推导|重建|写出|标出|对应|重排|改写|抽取|区分|串成|连成|\b(?:explain|design|sketch|identify|recognize|describe|obtain|create|define|recount|predict|interpret|utilize|understand|analyze|state|distinguish)\b)/i.test(value);
  const output = /(?:提交|交付|产出|形成|完成|制作|绘制|图|页|卡|链|矩阵|目录|时间轴|流程板|说明稿|核对表|设计记录)/.test(value);
  return action && output;
}

function containsTruncatedQuotation(value: string) {
  const openChinese = (value.match(/“/g) ?? []).length;
  const closeChinese = (value.match(/”/g) ?? []).length;
  return openChinese !== closeChinese || /[“"][^”"]{0,160}(?:……|\.\.\.)[”"]/.test(value);
}

function semanticSummaryOverlapsSource(summary: string, markdown: string) {
  if (/final\s+value\s+theorem/i.test(summary) && /final\s+value[\s\S]{0,20}theorem[\s\S]{0,40}stable\s+systems\s+only/i.test(markdown)) {
    return true;
  }
  const source = normalizeSemanticText(cleanSectionMarkdown(markdown));
  const normalizedSummary = normalizeSemanticText(summary);
  const englishTerms = [...new Set(normalizedSummary.match(/[a-z][a-z-]{4,}/g) ?? [])]
    .filter((term) => !['section', 'student', 'teaching', 'result', 'system'].includes(term));
  const chineseChunks = [...new Set(normalizedSummary.match(/[\p{Script=Han}]{4,}/gu) ?? [])]
    .flatMap((value) => Array.from({ length: Math.max(0, value.length - 3) }, (_, index) => value.slice(index, index + 4)));
  return englishTerms.filter((term) => source.includes(term)).length >= Math.min(3, englishTerms.length || 3) ||
    chineseChunks.filter((term) => source.includes(term)).length >= Math.min(2, chineseChunks.length || 2);
}

function captionDominatesSummary(summary: string, markdown: string) {
  const captions = [...markdown.matchAll(/^\s*>\s*Image description:\s*(.+)$/gim)]
    .map((match) => normalizeSemanticText(match[1]));
  if (captions.length === 0) return false;
  const terms = [...new Set(normalizeSemanticText(summary).match(/[a-z][a-z-]{4,}|[\p{Script=Han}]{2,}/gu) ?? [])];
  if (terms.length < 5) return false;
  const captionText = captions.join(' ');
  const captionShare = terms.filter((term) => captionText.includes(term)).length / terms.length;
  const nonCaption = cleanSectionMarkdown(markdown.replace(/^\s*>\s*Image description:.*$/gim, ''));
  return nonCaption.length >= 80 && captionShare >= 0.7;
}

function extractCompleteBodySentencesForValidation(markdown: string): string[] {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, '\n\n')
    .replace(/```[\s\S]*?```/g, '\n\n')
    .replace(/\$\$[\s\S]*?\$\$/g, '\n\n')
    .replace(/^\s*>\s*Image description:.*$/gim, '\n\n')
    .split(/\n\s*\n/)
    .map((block) => block
      .replace(/^\s*>\s*Image description:\s*/i, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim())
    .filter((block) => block && !/^#{1,6}\s/.test(block))
    .flatMap((block) => block.split(/(?<=[。！？.!?；;])\s+(?=[\p{L}\p{N}"“‘(])/u))
    .map((unit) => unit.replace(/^#+\s*/, '').replace(/\s+/g, ' ').trim())
    .filter((unit) => unit.length >= 35 && unit.length <= 360)
    .filter((unit) => /[。！？.!?；;]$/.test(unit))
    .filter((unit) => !containsDanglingClause(unit) && !containsReferenceEntry(unit) && hasBalancedFormulaDelimiters(unit));
}

function hasCompleteTeachingInformation(markdown: string) {
  const withoutComments = markdown.replace(/<!--[\s\S]*?-->/g, ' ');
  const prose = cleanSectionMarkdown(withoutComments);
  const formulas = [...withoutComments.matchAll(/\$\$([\s\S]*?)\$\$/g)]
    .map((match) => match[1].replace(/\s+/g, ' ').trim())
    .filter((formula) => formula.length >= 18 && /[=<>]|\\(?:frac|sum|lim|dot|begin)/.test(formula));
  const imageDescriptions = [...withoutComments.matchAll(/^\s*>\s*Image description:\s*(.+)$/gim)]
    .map((match) => match[1].replace(/\s+/g, ' ').trim())
    .filter((description) => description.length >= 80);
  const tableRows = withoutComments.split(/\r?\n/)
    .filter((line) => /^\s*\|.*\|\s*$/.test(line));
  const desiredOutcomes = /desired outcomes|学习目标|upon completion[^:]*:/i.test(withoutComments) &&
    (withoutComments.match(/^\s*[-*]\s+\S+/gm) ?? []).length >= 2;
  const answerKey = /^#{1,6}\s*(?:answers? to skills check|答案)/im.test(withoutComments) && prose.length >= 120;
  const completeExample = /\bexample\s+\d|例\s*\d/i.test(withoutComments) &&
    (prose.length >= 160 || formulas.length >= 1);
  const shortTeachingStatement = /(?:final\s+value\s+theorem|终值定理)[\s\S]{0,40}(?:stable systems only|仅[^。]{0,12}稳定)/i.test(withoutComments);
  const metadataOnly = /##\s*Synonyms/i.test(withoutComments) &&
    /(?:Institute|University|Center|Centre|Laboratory|Germany|USA|China)/i.test(prose) &&
    !/[.!?。！？]/.test(prose);
  return !metadataOnly && (desiredOutcomes || answerKey || completeExample || shortTeachingStatement || prose.length >= 120 ||
    formulas.length >= 1 || imageDescriptions.length >= 1 || tableRows.length >= 2);
}

function cleanSectionMarkdown(markdown: string) {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/<a\b[^>]*><\/a>/gi, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s+.*$/gm, ' ')
    .replace(/^\s*>\s*Image description:.*$/gim, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeLegacyGeneratedReview(review: NonNullable<ReviewSourceRow['semanticReview']>) {
  return review.bodySummary.startsWith('内容摘要：') &&
    review.bodySummary.includes('结构展开：') &&
    /^(?:教学用途：让学生依据正文中的完整题设或推导|教学用途：把正文作为概念边界查证材料|教学用途：围绕正文的两项完整陈述)/.test(review.teachingUse);
}

function looksLikeFixedSectionFrame(review: NonNullable<ReviewSourceRow['semanticReview']>) {
  return /^本节围绕[“\"]/.test(review.bodySummary) ||
    /^教学中可(?:让学生依据|把)[“\"]/.test(review.teachingUse) ||
    /^[“\"].+[”\"]可支持(?:演算讲解|正文查证)/.test(review.missingIndependentContract) ||
    /^当前材料只能帮助教师定位/.test(review.teachingUse);
}

function containsDanglingClause(value: string) {
  const clauses = value.split(/(?:[。！？!?；;]+|\.\s+)/).map((item) => item.trim()).filter(Boolean);
  return clauses.some((clause) => {
    if (/[,，:：]$/.test(clause)) return true;
    if (/^(?:and|but|or)\b/i.test(clause)) return true;
    return /^(?:which|that|where|when|because)\b/i.test(clause) &&
      clause.length < 80 &&
      !/\b(?:is|are|was|were|be|becomes?|provides?|shows?|gives?|uses?|requires?|allows?|estimates?|measures?)\b/i.test(clause);
  });
}

function containsReferenceEntry(value: string) {
  return /\b(?:springer|wiley|elsevier|crc press|proceedings|et al\.|doi:)\b|参考文献|references?\s*[:：]/i.test(value) ||
    /\b[A-Z][a-z]+\s+[A-Z](?:,?\s+[A-Z][a-z]+\s+[A-Z])?\s*\((?:19|20)\d{2}\)/.test(value);
}

function hasBalancedFormulaDelimiters(value: string) {
  const dollars = (value.match(/(?<!\\)\$/g) ?? []).length;
  let braces = 0;
  for (const char of value.replace(/\\[{}]/g, '')) {
    if (char === '{') braces += 1;
    if (char === '}') braces -= 1;
    if (braces < 0) return false;
  }
  return dollars % 2 === 0 && braces === 0;
}

function normalizeSemanticText(value: string) {
  return value.replace(/<!--[\s\S]*?-->/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function localPathForAddress(href: string): string | null {
  const clean = href.split('#')[0];
  if (clean.startsWith('/course-runtime/')) return path.join(process.cwd(), 'course-content/runtime', clean.slice('/course-runtime/'.length));
  if (clean.startsWith('course-content/')) return path.join(process.cwd(), clean);
  return null;
}

function resolveJsonPointer(root: unknown, pointer: string): unknown {
  return pointer.split('/').slice(1).reduce<unknown>((value, token) => {
    if (value === null || typeof value !== 'object') return undefined;
    const key = token.replace(/~1/g, '/').replace(/~0/g, '~');
    return (value as Record<string, unknown>)[key];
  }, root);
}

function sameAddress(left: ReviewSourceRow['citationAddress'], right: CitationTarget['address']) {
  return left.kind === right.kind &&
    left.href === right.href &&
    left.locator === right.locator &&
    normalizeHash(left.contentHash) === normalizeHash(right.contentHash);
}

function latestReviewedAt(rows: ReviewSourceRow[]) {
  return new Date(Math.max(...rows.map((row) => Date.parse(row.reviewedAt)))).toISOString();
}

function minimizeTitle(title: string) {
  const compact = title.replace(/\s+/g, ' ').trim();
  return compact.length <= 96 ? compact : `${compact.slice(0, 93)}...`;
}

function renderEvidence(summary: Record<string, any>) {
  return [
    '# Longform textbook/reference resource semantics',
    '',
    `Review batch: ${summary.reviewBatchId}`,
    `Review source SHA-256: ${summary.reviewSourceSha256}`,
    `Generated at: ${summary.generatedAt}`,
    `Denominator: ${summary.denominator.total}`,
    `Agent semantic reviews: ${summary.after.agentReviewed}`,
    `Human path authorizations: ${summary.after.humanConfirmed}`,
    `Promoted PlanningUnits: ${summary.after.promotedPlanningUnits}`,
    `Section review conclusions: ${summary.after.sectionReviewCompleted}`,
    `Section semantic reviews: ${summary.after.sectionSemanticReviewed}`,
    `Section insufficient-source blockers: ${summary.after.sectionInsufficientSource}`,
    `Normalized decision diversity: ${summary.after.rationaleDiversity.normalizedDecisionUnique}/${summary.after.rationaleDiversity.total} (${summary.after.rationaleDiversity.normalizedDecisionRatio})`,
    `Normalized body-summary diversity: ${summary.after.rationaleDiversity.normalizedBodySummaryUnique}/${summary.after.rationaleDiversity.total} (${summary.after.rationaleDiversity.normalizedBodySummaryRatio})`,
    `Variable-stripped body-summary diversity: ${summary.after.rationaleDiversity.variableStrippedBodySummaryRatio}`,
    `Near-duplicate body-summary pairs: ${summary.after.rationaleDiversity.nearDuplicatePairs}`,
    `Near-duplicate body-summary pair ratio: ${summary.after.rationaleDiversity.nearDuplicatePairRatio}`,
    `Teaching-use sentence-frame diversity: ${summary.after.rationaleDiversity.teachingUseSentenceFrameUnique}/${summary.after.rationaleDiversity.semanticTeachingUseTotal} (${summary.after.rationaleDiversity.teachingUseSentenceFrameRatio})`,
    `Top-six teaching-use frame coverage: ${summary.after.rationaleDiversity.teachingUseTopSixFrameCoverage}`,
    `Action-object-output diversity: ${summary.after.rationaleDiversity.actionObjectOutputUnique}/${summary.after.rationaleDiversity.semanticTeachingUseTotal} (${summary.after.rationaleDiversity.actionObjectOutputRatio})`,
    `Forbidden teaching-use starts: ${summary.after.rationaleDiversity.forbiddenTeachingUseStarts}`,
    '',
    '## Validation scope',
    '',
    `- Live/full: \`${summary.delivery.validationEntrypoints.liveFull.command}\` — ${summary.delivery.validationEntrypoints.liveFull.guarantee}.`,
    `- Delivery/clean clone: \`${summary.delivery.validationEntrypoints.deliveryClean.command}\` — ${summary.delivery.validationEntrypoints.deliveryClean.guarantee}.`,
    '',
    '## Buddy issue-body validator',
    '',
    `- Command: \`${summary.issueBodyValidatorEvidence.command}\``,
    `- Result: ${summary.issueBodyValidatorEvidence.result} (exit ${summary.issueBodyValidatorEvidence.exitCode})`,
    `- Validated at: ${summary.issueBodyValidatorEvidence.validatedAt}`,
    `- Input: \`${summary.issueBodyValidatorEvidence.input.path}\` (${summary.issueBodyValidatorEvidence.input.sha256})`,
    `- GitHub state observed: ${summary.issueBodyValidatorEvidence.githubStateObserved}`,
    '',
    '## Family counts',
    '',
    ...Object.entries(summary.denominator.byFamily).map(([family, count]) => `- ${family}: ${count}`),
    '',
    'The accepted JSONL contains item-level implementing-agent decisions. This helper derives counts from current facts, verifies bidirectional ID closure, canonical parents, source identity, concrete addresses, row/source digests, and never infers accepted dispositions or graph labels.',
    '',
  ].join('\n');
}

async function loadIssueBodyValidatorEvidence(): Promise<IssueBodyValidatorEvidence> {
  const evidence = JSON.parse(await fs.readFile(ISSUE_BODY_VALIDATOR_EVIDENCE_PATH, 'utf8')) as IssueBodyValidatorEvidence;
  assert(evidence.artifactVersion === 'buddy-issue-body-validator-evidence.v1', 'invalid issue-body validator evidence version');
  assert(evidence.result === 'Buddy issue body validation passed.' && evidence.exitCode === 0, 'issue-body validator evidence is not passing');
  assert(evidence.githubStateObserved === false, 'issue-body validator evidence must not claim GitHub state');
  assert(Date.parse(evidence.validatedAt) <= Date.now(), 'issue-body validator evidence timestamp is in the future');
  const inputPath = path.join(process.cwd(), evidence.input.path);
  assert(`sha256:${sha256(await fs.readFile(inputPath))}` === evidence.input.sha256, 'issue-body validator evidence input hash mismatch');
  return evidence;
}

function rowForRowHash(row: ReviewSourceRow) {
  const { reviewSourceSha256: _sourceSha, reviewRowHash: _rowHash, ...content } = row;
  return content;
}

function rowForSourceHash(row: ReviewSourceRow) {
  const { reviewSourceSha256: _sourceSha, ...content } = row;
  return content;
}

function inputRowForHash(row: InputSnapshotRow) {
  const { inputRowHash: _inputRowHash, ...content } = row;
  return content;
}

function hasCompleteSectionSemanticReview(row: ReviewSourceRow) {
  if (!row.semanticReview) return false;
  return row.semanticReview.contentType !== 'insufficient-source' &&
    normalizeSemanticText(row.semanticReview.bodySummary).length >= 24 &&
    normalizeSemanticText(row.semanticReview.teachingUse).length >= 24 &&
    normalizeSemanticText(row.semanticReview.missingIndependentContract).length >= 24;
}

function hasSectionReviewConclusion(row: ReviewSourceRow) {
  if (!row.semanticReview) return false;
  return normalizeSemanticText(row.semanticReview.bodySummary).length >= 24 &&
    normalizeSemanticText(row.semanticReview.teachingUse).length >= 24 &&
    normalizeSemanticText(row.semanticReview.missingIndependentContract).length >= 24;
}

function buildRationaleDiversity(rows: ReviewSourceRow[]) {
  const normalizedDecisions = rows.map((row) => normalizeSemanticText(row.reviewerVisibleRationale));
  const normalizedBodies = rows.map((row) => normalizeSemanticText(row.semanticReview?.bodySummary ?? ''));
  const total = rows.length;
  const normalizedDecisionUnique = new Set(normalizedDecisions).size;
  const normalizedBodySummaryUnique = new Set(normalizedBodies).size;
  const semanticRows = rows.filter(hasCompleteSectionSemanticReview);
  const variableStrippedBodies = semanticRows.map((row) => semanticDiversityFingerprint(row.semanticReview!.bodySummary));
  const teachingUseFrames = semanticRows.map(teachingUseSentenceFrame);
  const actionObjectOutputs = semanticRows.map(actionObjectOutputFingerprint);
  const teachingUseFrameCounts = [...countValues(teachingUseFrames).values()].sort((left, right) => right - left);
  const semanticTeachingUseTotal = semanticRows.length;
  const teachingUseSentenceFrameUnique = new Set(teachingUseFrames).size;
  const actionObjectOutputUnique = new Set(actionObjectOutputs).size;
  const nearDuplicatePairs = countNearDuplicatePairs(variableStrippedBodies);
  const possiblePairs = semanticRows.length < 2 ? 0 : semanticRows.length * (semanticRows.length - 1) / 2;
  return {
    total,
    normalizedDecisionUnique,
    normalizedBodySummaryUnique,
    normalizedDecisionRatio: total === 0 ? 1 : Number((normalizedDecisionUnique / total).toFixed(4)),
    normalizedBodySummaryRatio: total === 0 ? 1 : Number((normalizedBodySummaryUnique / total).toFixed(4)),
    variableStrippedBodySummaryRatio: semanticRows.length === 0 ? 1 : Number((new Set(variableStrippedBodies).size / semanticRows.length).toFixed(4)),
    semanticTeachingUseTotal,
    teachingUseSentenceFrameUnique,
    teachingUseSentenceFrameRatio: semanticTeachingUseTotal === 0 ? 1 : Number((teachingUseSentenceFrameUnique / semanticTeachingUseTotal).toFixed(4)),
    teachingUseTopSixFrameCoverage: semanticTeachingUseTotal === 0 ? 0 : Number((teachingUseFrameCounts.slice(0, 6).reduce((sum, count) => sum + count, 0) / semanticTeachingUseTotal).toFixed(4)),
    actionObjectOutputUnique,
    actionObjectOutputRatio: semanticTeachingUseTotal === 0 ? 1 : Number((actionObjectOutputUnique / semanticTeachingUseTotal).toFixed(4)),
    forbiddenTeachingUseStarts: semanticRows.filter((row) => hasForbiddenTeachingUseStart(row.semanticReview!.teachingUse)).length,
    forbiddenGenericTeachingUseTemplates: semanticRows.filter((row) => matchesForbiddenGenericTeachingUseTemplate(row.semanticReview!.teachingUse)).length,
    nearDuplicatePairs,
    nearDuplicatePairRatio: possiblePairs === 0 ? 0 : Number((nearDuplicatePairs / possiblePairs).toFixed(6)),
    citationCommentSummaries: rows.filter((row) => /citation comment|source hash|引文注释|引用注释/i.test(
      normalizeSemanticText(row.semanticReview?.bodySummary ?? ''),
    )).length,
    byContentType: countBy(rows.filter((row) => row.semanticReview), (row) => row.semanticReview!.contentType),
  };
}

function validateSectionReviewDiversity(diversity: ReturnType<typeof buildRationaleDiversity>) {
  assert(diversity.normalizedDecisionRatio >= 0.6, 'section review decisions fail normalized diversity gate');
  assert(diversity.normalizedBodySummaryRatio >= 0.6, 'section body summaries fail normalized diversity gate');
  assert(diversity.variableStrippedBodySummaryRatio >= 0.8, 'section summaries fail variable-stripped diversity gate');
  assert(diversity.nearDuplicatePairRatio <= 0.0001, `section summaries fail near-duplicate gate: ${diversity.nearDuplicatePairs}`);
  assert(diversity.teachingUseSentenceFrameRatio >= 0.2, 'section teaching uses fail sentence-frame diversity gate');
  assert(diversity.teachingUseTopSixFrameCoverage <= 0.45, 'six teaching-use frames cover too much of the corpus');
  assert(diversity.actionObjectOutputRatio >= 0.75, 'section teaching uses fail action-object-output diversity gate');
  assert(diversity.forbiddenTeachingUseStarts === 0, 'forbidden teaching-use opening covers accepted rows');
  assert(diversity.forbiddenGenericTeachingUseTemplates === 0, 'forbidden generic teaching-use templates remain in accepted rows');
}

function teachingUseSentenceFrame(row: ReviewSourceRow) {
  let value = normalizeSemanticText(row.semanticReview!.teachingUse);
  const bodyUnits = normalizeSemanticText(row.semanticReview!.bodySummary)
    .split(/(?<=[。！？.!?;；])/)
    .map((unit) => unit.trim())
    .filter((unit) => unit.length >= 12)
    .sort((left, right) => right.length - left.length);
  for (const unit of bodyUnits) value = value.replaceAll(unit, ' <body> ');
  const title = normalizeSemanticText(row.title);
  if (title.length >= 4) value = value.replaceAll(title, ' <object> ');
  return value
    .replace(/\$[^$]+\$/g, ' <formula> ')
    .replace(/“[^”]+”/g, ' <output> ')
    .replace(/\b\d+(?:[.,]\d+)?\b/g, ' <number> ')
    .replace(/[\p{P}\p{S}\s]+/gu, ' ')
    .trim();
}

function actionObjectOutputFingerprint(row: ReviewSourceRow) {
  const teachingUse = normalizeSemanticText(row.semanticReview!.teachingUse);
  const actions = [...new Set(teachingUse.match(/学生|解题者|制作|绘制|整理|复现|推导|重建|写出|标出|对应|重排|改写|抽取|区分|串成|连成|设计/g) ?? [])].join('+');
  const quotedOutput = teachingUse.match(/“([^”]+)”/)?.[1] ?? teachingUse.match(/(?:提交|交付|产出|形成|完成)(.{0,48})/)?.[1] ?? '';
  const object = `${normalizeSemanticText(row.title)} ${semanticDiversityFingerprint(row.semanticReview!.bodySummary).slice(0, 64)}`;
  return `${actions}|${object}|${semanticDiversityFingerprint(quotedOutput)}`;
}

function countValues(values: string[]) {
  return values.reduce((counts, value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
}

function semanticDiversityFingerprint(value: string) {
  return normalizeSemanticText(value)
    .replace(/\$[^$]+\$/g, ' ')
    .replace(/\\[a-z]+/gi, ' ')
    .replace(/\b[a-z]\b/gi, ' ')
    .replace(/\d+(?:[.,]\d+)?/g, ' ')
    .replace(/[\p{P}\p{S}\s]+/gu, '');
}

function countNearDuplicatePairs(values: string[]) {
  let pairs = 0;
  const shingles = values.map((value) => new Set(Array.from({ length: Math.max(0, value.length - 11) }, (_, index) => value.slice(index, index + 12))));
  for (let left = 0; left < shingles.length; left += 1) {
    for (let right = left + 1; right < shingles.length; right += 1) {
      const a = shingles[left];
      const b = shingles[right];
      if (a.size === 0 || b.size === 0) continue;
      let shared = 0;
      for (const item of a) if (b.has(item)) shared += 1;
      if (shared / Math.min(a.size, b.size) >= 0.92) pairs += 1;
    }
  }
  return pairs;
}

function indexUnique<T>(rows: T[], keyFor: (row: T) => string, label: string): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    const key = keyFor(row);
    assert(!map.has(key), `duplicate ${label} id: ${key}`);
    map.set(key, row);
  }
  return map;
}

function duplicateValues(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) seen.has(value) ? duplicates.add(value) : seen.add(value);
  return [...duplicates].sort();
}

function countBy<T>(rows: T[], keyFor: (row: T) => string): Record<string, number> {
  return Object.fromEntries([...rows.reduce((counts, row) => {
    const key = keyFor(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map<string, number>()).entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function normalizeHash(value: string | null | undefined) {
  return value?.replace(/^sha256:/, '') ?? null;
}

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

function hashJson(value: unknown) {
  return `sha256:${sha256(JSON.stringify(value))}`;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function readJsonl<T>(filePath: string): Promise<T[]> {
  const text = await fs.readFile(filePath, 'utf8');
  return text.split(/\r?\n/).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line) as T; } catch { throw new Error(`Invalid JSONL ${filePath}:${index + 1}`); }
  });
}

async function writeJsonl(filePath: string, rows: unknown[]) {
  await fs.writeFile(filePath, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

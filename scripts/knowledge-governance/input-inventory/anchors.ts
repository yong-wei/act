import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalJson, compareCodePoints, normalizePath, normalizeText, taggedDigest } from './normalize';
import { makeAnchor, type AdmittedAnchor, type AnchorCandidate, type AnchorReviewDecision, type AnchorReviewEvidence, type AnchorScope, type AnchorType } from './records';
import type { Json } from './types';

export const ANCHOR_CONTRACT_VERSION = 'course-scope-anchor-candidate/v1';
export const ANCHOR_MODEL_VERSION = 'course-scope-anchor-review/v1';
export const ANCHOR_RULE_VERSION = 'authoritative-markdown-selectors/v1';
export const ANCHOR_ARTIFACT_VERSION = 'course-scope-anchor-artifact/v1';

export const AUTHORITATIVE_ANCHOR_MARKDOWN = [
  'course-content/syllabus-refactor/blueprint.md',
  'course-content/syllabus-refactor/main.md',
  'course-content/syllabus-refactor/module-skeletons.md',
  'course-content/syllabus-refactor/unit-design-details/module1.md',
  'course-content/syllabus-refactor/unit-design-details/module2.md',
  'course-content/syllabus-refactor/unit-design-details/module3.md',
  'course-content/syllabus-refactor/unit-design-details/module4.md',
  'course-content/syllabus-refactor/unit-design-details/module5.md',
] as const;

interface Selection {
  anchor_type: AnchorType;
  anchor_scope: AnchorScope;
  module_number: string | null;
  lesson_number: string | null;
  heading_locator: string;
  row_locator: string;
  quote: string;
}

export interface AnchorCandidateArtifact {
  schema_version: typeof ANCHOR_ARTIFACT_VERSION;
  artifact_kind: 'candidate';
  extraction_run: string;
  candidates: AnchorCandidate[];
  artifact_digest: string;
}

export interface AnchorReviewArtifact {
  schema_version: typeof ANCHOR_ARTIFACT_VERSION;
  artifact_kind: 'review';
  review_run: string;
  decisions: AnchorReviewDecision[];
  artifact_digest: string;
}

export interface AdmittedAnchorArtifact {
  schema_version: typeof ANCHOR_ARTIFACT_VERSION;
  artifact_kind: 'admitted';
  admitted: AdmittedAnchor[];
  pending_candidate_digests: string[];
  rejected_candidate_digests: string[];
  artifact_digest: string;
}

export interface AnchorReviewAttestation {
  schema_version: 'course-scope-anchor-review-attestation/v1';
  source_revision: string;
  extraction_run: string;
  review_run: string;
  candidate_artifact_digest: string;
  review_artifact_digest: string;
  admitted_artifact_digest: string;
  accepted_candidate_digests: string[];
  evidence: AnchorReviewEvidence;
  reason: string;
}

function digestArtifact(value: Omit<AnchorCandidateArtifact | AnchorReviewArtifact | AdmittedAnchorArtifact, 'artifact_digest'>): string {
  return taggedDigest('course-scope-anchor-artifact/v1', canonicalJson(value as unknown as Json));
}

function normalizeQuote(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/gu, ' ');
}

function headingLabel(stack: Array<{ level: number; text: string; line: number }>): string {
  return stack.map((item) => `L${item.line}:${item.text}`).join(' > ');
}

function scopeFromText(value: string, subjectOnly: boolean): { scope: AnchorScope; module: string | null; lesson: string | null } | null {
  const lessonPattern = subjectOnly
    ? /^(?:[#>*+\-\s|]*)(?:\*\*)?`?([1-5])-([1-9]\d*)[^`|\s]*`?(?:（[^）]+）)?(?:\*\*)?(?:\s|\||：|:)/u
    : /`([1-5])-([1-9]\d*)[^`]*`/u;
  const lesson = lessonPattern.exec(value);
  if (lesson) return { scope: 'lesson', module: lesson[1]!, lesson: `${lesson[1]}-${lesson[2]}` };
  const modulePattern = subjectOnly
    ? /^(?:[#>*+\-\s|]*)(?:\*\*)?模块\s*`?([1-5])`?/u
    : /模块\s*`?([1-5])`?/u;
  const module = modulePattern.exec(value);
  return module ? { scope: 'module', module: module[1]!, lesson: null } : null;
}

function explicitScope(line: string, stack: Array<{ level: number; text: string; line: number }>): { scope: AnchorScope; module: string | null; lesson: string | null } | null {
  const lineSubject = scopeFromText(line, true);
  if (lineSubject) return lineSubject;
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    const structural = scopeFromText(stack[index]!.text, false);
    if (structural) return structural;
  }
  return scopeFromText(line, false);
}

function isExplicitExtensionContext(quote: string): boolean {
  if (/拓展/u.test(quote)) return true;
  if (!/扩展/u.test(quote)) return false;
  return /(?:模块|单元|课程|主线|例题|讲义|附录|板书|资源|使用边界|不进入|不重讲|提前|专题|变式题|教学)/u.test(quote);
}

function selectMarkdown(logicalPath: string, text: string): Selection[] {
  const lines = text.split('\n');
  const headings: Array<{ level: number; text: string; line: number }> = [];
  const selections: Selection[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index]!;
    const heading = /^(#{1,6})\s+(.+?)\s*$/u.exec(raw);
    if (heading) {
      const level = heading[1]!.length;
      while (headings.at(-1)?.level! >= level) headings.pop();
      headings.push({ level, text: normalizeQuote(heading[2]!), line: index + 1 });
    }
    const quote = normalizeQuote(raw);
    if (!quote) continue;
    const locator = headingLabel(headings);

    if (logicalPath.endsWith('/blueprint.md') && headings.some((item) => /教学目标$/u.test(item.text))) {
      const objective = /^\|\s*\*\*([KAV]-(?:[1-4]))\*\*\s*\|\s*(.+?)\s*\|/u.exec(raw);
      if (objective && /^(?:K-[1-4]|A-[1-4]|V-[1-3])$/u.test(objective[1]!)) {
        selections.push({ anchor_type: 'formal_objective', anchor_scope: 'course', module_number: null, lesson_number: null, heading_locator: locator, row_locator: `line:${index + 1};objective:${objective[1]}`, quote });
        continue;
      }
    }

    if (logicalPath.endsWith('/blueprint.md') && /^\|\s*\*\*先修课程\*\*\s*\|/u.test(raw)) {
      selections.push({ anchor_type: 'necessary_prerequisite', anchor_scope: 'course', module_number: null, lesson_number: null, heading_locator: locator, row_locator: `line:${index + 1};field:先修课程`, quote });
      continue;
    }

    if (isExplicitExtensionContext(quote)) {
      const scope = explicitScope(quote, headings);
      if (scope) selections.push({ anchor_type: 'explicit_extension', anchor_scope: scope.scope, module_number: scope.module, lesson_number: scope.lesson, heading_locator: locator, row_locator: `line:${index + 1};selector:explicit-extension`, quote });
    }
  }
  return selections;
}

function identity(tag: string, value: Json): string {
  return taggedDigest(tag, canonicalJson(value));
}

function candidateWithoutDigest(candidate: Omit<AnchorCandidate, 'candidate_digest'>): Omit<AnchorCandidate, 'candidate_digest'> {
  return candidate;
}

export async function extractAuthoritativeAnchorCandidates(options: { root: string; repositoryRevision: string; extractionRun: string }): Promise<AnchorCandidateArtifact> {
  if (!options.repositoryRevision.trim() || !options.extractionRun.trim()) throw new Error('repositoryRevision and extractionRun are required');
  const blueprint = normalizeText(await readFile(path.join(options.root, AUTHORITATIVE_ANCHOR_MARKDOWN[0])));
  const courseName = /^\|\s*\*\*课程名称\*\*\s*\|\s*(.+?)\s*\|\s*$/mu.exec(blueprint)?.[1];
  const courseNumber = /^\|\s*\*\*(?:课程编号|课程代码)\*\*\s*\|\s*(.+?)\s*\|\s*$/mu.exec(blueprint)?.[1];
  if (!courseName) throw new Error('authoritative blueprint has no explicit course name');
  const course_id = identity('course-identity/v1', { course_name: normalizeQuote(courseName), course_number: courseNumber ? normalizeQuote(courseNumber) : null });
  const candidates: AnchorCandidate[] = [];
  for (const registeredPath of AUTHORITATIVE_ANCHOR_MARKDOWN) {
    const logicalPath = normalizePath(registeredPath);
    const text = normalizeText(await readFile(path.join(options.root, logicalPath)));
    const sourceDigest = taggedDigest('repository-text-file/v1', Buffer.from(text, 'utf8'));
    for (const selected of selectMarkdown(logicalPath, text)) {
      const module_id = selected.module_number ? identity('course-module-identity/v1', { course_id, module_number: selected.module_number }) : null;
      const lesson_id = selected.lesson_number ? identity('course-lesson-identity/v1', { course_id, lesson_number: selected.lesson_number }) : null;
      const quoteDigest = taggedDigest('anchor-quote/v1', selected.quote);
      const body = candidateWithoutDigest({
        anchor_scope: selected.anchor_scope,
        anchor_type: selected.anchor_type,
        course_id,
        module_id,
        lesson_id,
        identity_basis: {
          course_name: normalizeQuote(courseName),
          course_number: courseNumber ? normalizeQuote(courseNumber) : null,
          module_number: selected.module_number,
          lesson_number: selected.lesson_number,
        },
        source: {
          source_root: '.', logical_path: logicalPath, repository_revision: options.repositoryRevision,
          source_digest: sourceDigest, heading_locator: selected.heading_locator,
          row_locator: selected.row_locator, quote_normalized: selected.quote, quote_digest: quoteDigest,
        },
        contract_version: ANCHOR_CONTRACT_VERSION,
        model_version: ANCHOR_MODEL_VERSION,
        rule_version: ANCHOR_RULE_VERSION,
        extraction_run: options.extractionRun,
      });
      candidates.push({ candidate_digest: taggedDigest('anchor-candidate/v1', canonicalJson(body as unknown as Json)), ...body });
    }
  }
  candidates.sort((a, b) => compareCodePoints(a.candidate_digest, b.candidate_digest));
  const base: Omit<AnchorCandidateArtifact, 'artifact_digest'> = { schema_version: ANCHOR_ARTIFACT_VERSION, artifact_kind: 'candidate', extraction_run: options.extractionRun, candidates };
  return { ...base, artifact_digest: digestArtifact(base) };
}

function verifyCandidate(candidate: AnchorCandidate, extractionRun: string): void {
  if (candidate.extraction_run !== extractionRun) throw new Error('candidate extraction run mismatch');
  if (candidate.contract_version !== ANCHOR_CONTRACT_VERSION || candidate.model_version !== ANCHOR_MODEL_VERSION || candidate.rule_version !== ANCHOR_RULE_VERSION) throw new Error('candidate contract version mismatch');
  if (candidate.source.source_root !== '.' || !AUTHORITATIVE_ANCHOR_MARKDOWN.includes(candidate.source.logical_path as typeof AUTHORITATIVE_ANCHOR_MARKDOWN[number])) throw new Error('candidate source is outside the authoritative registry');
  if (!candidate.source.repository_revision.trim() || !candidate.source.heading_locator.trim() || !candidate.source.row_locator.trim() || !candidate.source.quote_normalized.trim()) throw new Error('candidate provenance is incomplete');
  if (!/^sha256:[0-9a-f]{64}$/u.test(candidate.source.source_digest)) throw new Error('invalid source digest');
  if (candidate.source.quote_digest !== taggedDigest('anchor-quote/v1', candidate.source.quote_normalized)) throw new Error('candidate quote digest mismatch');
  const basis = candidate.identity_basis;
  if (!basis.course_name.trim() || basis.course_name !== normalizeQuote(basis.course_name)) throw new Error('invalid course identity basis');
  const courseId = identity('course-identity/v1', { course_name: basis.course_name, course_number: basis.course_number });
  const moduleId = basis.module_number ? identity('course-module-identity/v1', { course_id: courseId, module_number: basis.module_number }) : null;
  const lessonId = basis.lesson_number ? identity('course-lesson-identity/v1', { course_id: courseId, lesson_number: basis.lesson_number }) : null;
  if (candidate.course_id !== courseId || candidate.module_id !== moduleId || candidate.lesson_id !== lessonId) throw new Error('candidate identity digest mismatch');
  if (candidate.anchor_type === 'formal_objective' && !(candidate.source.logical_path.endsWith('/blueprint.md') && /;objective:(?:K-[1-4]|A-[1-4]|V-[1-3])$/u.test(candidate.source.row_locator) && candidate.source.heading_locator.includes('教学目标'))) throw new Error('candidate is outside the formal objective selector');
  if (candidate.anchor_type === 'necessary_prerequisite' && !(candidate.source.logical_path.endsWith('/blueprint.md') && candidate.source.row_locator.endsWith(';field:先修课程'))) throw new Error('candidate is outside the prerequisite selector');
  if (candidate.anchor_type === 'explicit_extension' && !(/(?:拓展|扩展)/u.test(candidate.source.quote_normalized) && candidate.source.row_locator.endsWith(';selector:explicit-extension') && candidate.anchor_scope !== 'course')) throw new Error('candidate is outside the explicit extension selector');
  makeAnchor({ anchor_scope: candidate.anchor_scope, anchor_type: candidate.anchor_type, course_id: candidate.course_id, module_id: candidate.module_id, lesson_id: candidate.lesson_id, source_locator: `${candidate.source.logical_path}#${candidate.source.row_locator}`, text_digest: candidate.source.quote_digest });
  const { candidate_digest, ...body } = candidate;
  if (candidate_digest !== taggedDigest('anchor-candidate/v1', canonicalJson(body as unknown as Json))) throw new Error('candidate digest mismatch');
}

export function makeAnchorReviewDecision(candidate: AnchorCandidate, input: { decision: 'ACCEPT' | 'REJECT'; evidence: AnchorReviewEvidence; reason: string; reviewRun: string }): AnchorReviewDecision {
  if (!input.reviewRun.trim() || input.reviewRun === candidate.extraction_run) throw new Error('review must be an independent run');
  if (!input.reason.trim() || Object.values(input.evidence).some((value) => !value.trim())) throw new Error('complete review evidence and reason are required');
  const body = { candidate_digest: candidate.candidate_digest, decision: input.decision, evidence: input.evidence, reason: normalizeQuote(input.reason), review_run: input.reviewRun };
  return { decision_digest: taggedDigest('anchor-review-decision/v1', canonicalJson(body as unknown as Json)), ...body };
}

export function makeAnchorReviewArtifact(reviewRun: string, decisions: AnchorReviewDecision[]): AnchorReviewArtifact {
  if (!reviewRun.trim() || decisions.some((item) => item.review_run !== reviewRun)) throw new Error('review artifact contains mismatched runs');
  const ordered = [...decisions].sort((a, b) => compareCodePoints(a.candidate_digest, b.candidate_digest));
  if (new Set(ordered.map((item) => item.candidate_digest)).size !== ordered.length) throw new Error('duplicate review decision');
  const base: Omit<AnchorReviewArtifact, 'artifact_digest'> = { schema_version: ANCHOR_ARTIFACT_VERSION, artifact_kind: 'review', review_run: reviewRun, decisions: ordered };
  return { ...base, artifact_digest: digestArtifact(base) };
}

export function verifyAndAdmitAnchors(candidateArtifact: AnchorCandidateArtifact, reviewArtifact: AnchorReviewArtifact): AdmittedAnchorArtifact {
  if (candidateArtifact.schema_version !== ANCHOR_ARTIFACT_VERSION || candidateArtifact.artifact_kind !== 'candidate') throw new Error('invalid candidate artifact contract');
  if (reviewArtifact.schema_version !== ANCHOR_ARTIFACT_VERSION || reviewArtifact.artifact_kind !== 'review') throw new Error('invalid review artifact contract');
  const candidateBase = { schema_version: candidateArtifact.schema_version, artifact_kind: candidateArtifact.artifact_kind, extraction_run: candidateArtifact.extraction_run, candidates: candidateArtifact.candidates };
  if (candidateArtifact.artifact_digest !== digestArtifact(candidateBase)) throw new Error('candidate artifact digest mismatch');
  if (new Set(candidateArtifact.candidates.map((item) => item.candidate_digest)).size !== candidateArtifact.candidates.length) throw new Error('duplicate anchor candidate');
  for (const candidate of candidateArtifact.candidates) verifyCandidate(candidate, candidateArtifact.extraction_run);
  const reviewBase = { schema_version: reviewArtifact.schema_version, artifact_kind: reviewArtifact.artifact_kind, review_run: reviewArtifact.review_run, decisions: reviewArtifact.decisions };
  if (reviewArtifact.artifact_digest !== digestArtifact(reviewBase)) throw new Error('review artifact digest mismatch');
  if (reviewArtifact.review_run === candidateArtifact.extraction_run) throw new Error('review and extraction runs must differ');
  const byCandidate = new Map(candidateArtifact.candidates.map((item) => [item.candidate_digest, item]));
  const decisions = new Map<string, AnchorReviewDecision>();
  for (const decision of reviewArtifact.decisions) {
    if (!byCandidate.has(decision.candidate_digest)) throw new Error(`review references unknown candidate: ${decision.candidate_digest}`);
    if (decision.review_run !== reviewArtifact.review_run) throw new Error('review run mismatch');
    const evidence = decision.evidence;
    if (!['ACCEPT', 'REJECT'].includes(decision.decision) || decision.reason !== normalizeQuote(decision.reason) || !decision.reason || !evidence || [evidence.provenance, evidence.type, evidence.scope, evidence.fidelity].some((value) => typeof value !== 'string' || !value.trim())) throw new Error('invalid review evidence');
    if (decisions.has(decision.candidate_digest)) throw new Error('duplicate review decision');
    const { decision_digest, ...body } = decision;
    if (decision_digest !== taggedDigest('anchor-review-decision/v1', canonicalJson(body as unknown as Json))) throw new Error('review decision digest mismatch');
    decisions.set(decision.candidate_digest, decision);
  }
  const admitted: AdmittedAnchor[] = [];
  const pending: string[] = [];
  const rejected: string[] = [];
  for (const candidate of candidateArtifact.candidates) {
    const decision = decisions.get(candidate.candidate_digest);
    if (!decision) { pending.push(candidate.candidate_digest); continue; }
    if (decision.decision === 'REJECT') { rejected.push(candidate.candidate_digest); continue; }
    const anchor = makeAnchor({
      anchor_scope: candidate.anchor_scope, anchor_type: candidate.anchor_type,
      course_id: candidate.course_id, module_id: candidate.module_id, lesson_id: candidate.lesson_id,
      source_locator: `${candidate.source.logical_path}#${candidate.source.row_locator}`,
      text_digest: candidate.source.quote_digest,
    });
    admitted.push({ ...anchor, candidate_digest: candidate.candidate_digest, review_decision_digest: decision.decision_digest, extraction_run: candidate.extraction_run, review_run: decision.review_run });
  }
  admitted.sort((a, b) => compareCodePoints(a.anchor_id, b.anchor_id));
  const base: Omit<AdmittedAnchorArtifact, 'artifact_digest'> = { schema_version: ANCHOR_ARTIFACT_VERSION, artifact_kind: 'admitted', admitted, pending_candidate_digests: pending, rejected_candidate_digests: rejected };
  return { ...base, artifact_digest: digestArtifact(base) };
}

export async function verifyAnchorReviewAttestation(root: string, attestationPath: string): Promise<{ candidates: AnchorCandidateArtifact; review: AnchorReviewArtifact; admitted: AdmittedAnchorArtifact }> {
  const safePath = normalizePath(attestationPath);
  const attestation = JSON.parse(normalizeText(await readFile(path.join(root, safePath)))) as AnchorReviewAttestation;
  if (attestation.schema_version !== 'course-scope-anchor-review-attestation/v1') throw new Error('unsupported anchor review attestation');
  if (!/^[0-9a-f]{40}$/u.test(attestation.source_revision) || !attestation.extraction_run.trim() || !attestation.review_run.trim()) throw new Error('invalid anchor review attestation provenance');
  const expectedDigests = [attestation.candidate_artifact_digest, attestation.review_artifact_digest, attestation.admitted_artifact_digest];
  if (expectedDigests.some((digest) => !/^sha256:[0-9a-f]{64}$/u.test(digest))) throw new Error('invalid anchor review attestation digest');
  if (!Array.isArray(attestation.accepted_candidate_digests) || new Set(attestation.accepted_candidate_digests).size !== attestation.accepted_candidate_digests.length) throw new Error('duplicate accepted anchor candidate');
  const candidates = await extractAuthoritativeAnchorCandidates({ root, repositoryRevision: attestation.source_revision, extractionRun: attestation.extraction_run });
  if (candidates.artifact_digest !== attestation.candidate_artifact_digest) throw new Error('attested candidate artifact digest mismatch');
  const observed = candidates.candidates.map((item) => item.candidate_digest).sort(compareCodePoints);
  const accepted = [...attestation.accepted_candidate_digests].sort(compareCodePoints);
  if (canonicalJson(observed as unknown as Json) !== canonicalJson(accepted as unknown as Json)) throw new Error('attested candidate set mismatch');
  const decisions = candidates.candidates.map((candidate) => makeAnchorReviewDecision(candidate, {
    decision: 'ACCEPT', evidence: attestation.evidence, reason: attestation.reason, reviewRun: attestation.review_run,
  }));
  const review = makeAnchorReviewArtifact(attestation.review_run, decisions);
  if (review.artifact_digest !== attestation.review_artifact_digest) throw new Error('attested review artifact digest mismatch');
  const admitted = verifyAndAdmitAnchors(candidates, review);
  if (admitted.artifact_digest !== attestation.admitted_artifact_digest) throw new Error('attested admitted artifact digest mismatch');
  return { candidates, review, admitted };
}

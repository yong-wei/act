import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  loadLongformReviewSource,
  loadLongformValidationFacts,
  sealLongformReviewRows,
  validateLongformReviewSource,
  type ReviewSourceRow,
} from '../db/generate-longform-textbook-reference-resource-semantics';

type Row = Record<string, any>;

const governance = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const generatorPath = path.join(process.cwd(), 'scripts/db/generate-longform-textbook-reference-resource-semantics.ts');
const deliverables = [
  'longform-textbook-reference-resource-semantics-review-source.jsonl',
  'longform-textbook-reference-resource-semantics-workqueue-items.jsonl',
  'longform-textbook-reference-resource-semantics-review-items.jsonl',
  'longform-textbook-reference-resource-semantics-summary.json',
  'longform-textbook-reference-resource-semantics-evidence.md',
];
const cleanInputFiles = [
  path.join(process.cwd(), 'openspec/changes/complete-longform-textbook-reference-resource-semantics/evidence/longform-textbook-reference-resource-input-snapshot.jsonl'),
  path.join(process.cwd(), 'openspec/changes/complete-longform-textbook-reference-resource-semantics/evidence/longform-textbook-reference-resource-input-snapshot.seal.json'),
];

async function main() {
const source = await loadLongformReviewSource();
const facts = await loadLongformValidationFacts();
const validation = await validateLongformReviewSource(source, facts);
assert(source.length === facts.currentFacts.size, 'reviewed IDs must exactly close over current fact IDs');
assert([...facts.currentFacts.values()].filter((fact) => fact.preOverlaySnapshot.reviewStatus === 'not-materialized').length === 949, 'tracked sealed input must independently reproduce 949 not-materialized rows');
assert(validation.diagnostics.missing.length === 0 && validation.diagnostics.extra.length === 0, 'ID closure diagnostics must be empty');
assert(new Set(source.map((row) => row.resourceId)).size === source.length, 'source ids must be unique');
assert(source.every((row) => row.reviewStatus === 'agent-reviewed' && row.reviewerRole === 'implementing-agent'), 'agent provenance mismatch');
assert(source.every((row) => !row.promotedAsPlanningUnit && !row.currentPathEligible), 'agent review cannot promote PlanningUnits');
assert(source.every((row) => row.reviewStatus !== 'human-confirmed'), 'implementing-agent rows must never be human-confirmed');
assert(source.every((row) => !row.independentEvidenceRef.includes('longform-textbook-reference-resource-semantics-review-source')), 'independent evidence cannot self-reference review source');
assert(source.every((row) => row.privacyScope === 'teacher-scoped' && row.lifecycleScope === 'audit-only'), 'all agent-reviewed longform rows must remain teacher-scoped/audit-only');

const authoring = source.filter((row) => row.sourceFamily.startsWith('authoring-textbook-'));
assert(authoring.length === 1105, `authoring denominator mismatch: ${authoring.length}`);
assert(authoring.every((row) => row.privacyScope === 'teacher-scoped' && row.lifecycleScope === 'audit-only' && !row.addressReady), 'authoring rows must be teacher-scoped/audit-only/non-clickable');
for (const sourceLine of [96, 148, 416, 468]) {
  const row = source[sourceLine - 1];
  assert(row?.sourceFamily === 'authoring-textbook-caption' && row.disposition === 'excluded-with-rationale' && row.limitationCode === 'empty-caption-no-citation-text' && !row.addressReady, `empty caption record must be excluded: review-source line ${sourceLine}`);
}

await expectFailure([...source, source[0]], facts, 'duplicate reviewed IDs');
const closure = cloneRows(source);
closure.pop();
closure.push({ ...closure[0], resourceId: 'textbook:unexpected-review-id' });
await expectFailure(sealLongformReviewRows(closure), facts, 'reviewed ID closure mismatch');

const wrongParent = cloneRows(source);
const captionIndex = wrongParent.findIndex((row) => row.sourceFamily === 'authoring-textbook-caption');
wrongParent[captionIndex].parentResourceId = source.find((row) => row.sourceFamily === 'authoring-textbook-figure' && !row.resourceId.includes(':chapter-01:'))!.resourceId;
await expectFailure(sealLongformReviewRows(wrongParent), facts, 'canonical parent mismatch');

const wrongSameChapterFigureParent = cloneRows(source);
const sameChapterFigureIndex = wrongSameChapterFigureParent.findIndex((row) => row.sourceFamily === 'authoring-textbook-figure');
const sameChapterFigure = wrongSameChapterFigureParent[sameChapterFigureIndex];
const [, bookId, chapterId] = sameChapterFigure.resourceId.split(':');
sameChapterFigure.parentResourceId = source.find((row) =>
  row.sourceFamily === 'authoring-textbook-section' &&
  row.resourceId.startsWith(`authoring-textbook-section:${bookId}:${chapterId}:`)
)!.resourceId;
await expectFailure(sealLongformReviewRows(wrongSameChapterFigureParent), facts, 'canonical parent mismatch');

const invalidPointer = cloneRows(source);
const pointerIndex = invalidPointer.findIndex((row) => row.sourceFamily === 'authoring-textbook-caption');
invalidPointer[pointerIndex].citationAddress.locator = 'json-pointer:/images/999999/caption';
await expectFailure(sealLongformReviewRows(invalidPointer), facts, 'citation target identity mismatch');

const invalidLine = cloneRows(source);
const lineIndex = invalidLine.findIndex((row) => row.sourceFamily === 'authoring-textbook-section');
invalidLine[lineIndex].citationAddress.locator = 'markdown-line:999999';
await expectFailure(sealLongformReviewRows(invalidLine), facts, 'citation target identity mismatch');

const irrelevantCitation = cloneRows(source);
const figureIndex = irrelevantCitation.findIndex((row) => row.sourceFamily === 'authoring-textbook-figure');
irrelevantCitation[figureIndex].citationAddress.href = 'package.json';
irrelevantCitation[figureIndex].citationAddress.contentHash = `sha256:${sha256(readFileSync(path.join(process.cwd(), 'package.json')))}`;
await expectFailure(sealLongformReviewRows(irrelevantCitation), facts, 'citation target identity mismatch');

const staleRationale = cloneRows(source);
staleRationale[0].reviewerVisibleRationale += ' changed';
await expectFailure(staleRationale, facts, 'stale review row hash');

const futureReview = cloneRows(source);
futureReview[0].reviewedAt = '2999-01-01T00:00:00.000Z';
await expectFailure(sealLongformReviewRows(futureReview), facts, 'invalid or future reviewedAt');

const wrongSourceHash = cloneRows(source);
wrongSourceHash[0].sourceHash = 'sha256:stale';
wrongSourceHash[0].reviewedContextHash = 'sha256:stale';
await expectFailure(sealLongformReviewRows(wrongSourceHash), facts, 'review source hash mismatch');

const forgedPreOverlay = cloneRows(source);
forgedPreOverlay[0].preOverlaySnapshot.reviewStatus = 'human-confirmed';
forgedPreOverlay[0].preOverlaySnapshot.blockerCodes = [];
await expectFailure(sealLongformReviewRows(forgedPreOverlay), facts, 'pre-overlay snapshot mismatch');

const semanticAttackIndex = source.findIndex((row) => row.sourceFamily === 'textbook-section' && row.semanticReview?.contentType !== 'insufficient-source');
for (const [label, bodySummary, expected] of [
  ['dangling conjunction', '本节说明一个完整结论。and the remaining condition is detached from its subject.', 'dangling clause'],
  ['comma fragment', '本节说明该模型用于比较闭环响应，但缺少完整谓语，', 'dangling clause'],
  ['bibliography text', '本节正文结论来自 Springer, New York，并以 References: 作为摘要。', 'bibliography text'],
  ['truncated formula', '本节比较模型 $G(s)=\\frac{1}{s+1} 与闭环响应。', 'truncated formula'],
] as const) {
  const attacked = cloneRows(source);
  attacked[semanticAttackIndex].semanticReview!.bodySummary = bodySummary;
  await expectFailure(sealLongformReviewRows(attacked), facts, expected);
  assert(label.length > 0, 'attack label must be retained');
}

const generatedCorpus = cloneRows(source);
for (const row of generatedCorpus.filter((item) => item.sourceFamily === 'textbook-section')) {
  row.semanticReview = {
    contentType: 'mixed',
    bodySummary: '内容摘要：系统由对象、检测元件和控制器构成。 结构展开：闭环结构根据偏差调节输入。',
    teachingUse: '教学用途：围绕正文的两项完整陈述组织概念解释与条件辨析，先分析系统组成，再检查反馈边界。',
    missingIndependentContract: '合同判断：正文可作为概念与方法说明，但缺少活动、完成判据、证据、先修条件和终结验证。',
  };
}
await expectFailure(sealLongformReviewRows(generatedCorpus), facts, 'forbidden generated template');

for (const resourceId of [
  'textbook-section:dorf-modern-control-systems:ch01-desired-outcomes-002',
  'textbook-section:dorf-modern-control-systems:ch02-example-0202',
  'textbook-section:hu-shousong-auto-control-7th:ch03-overview-001',
  'textbook-section:dorf-modern-control-systems:ch05-example-0511',
]) {
  const attacked = cloneRows(source);
  const row = attacked.find((item) => item.resourceId === resourceId)!;
  row.semanticReview = {
    contentType: 'insufficient-source',
    bodySummary: `${row.title}只有定位信息，不能形成教学结论。`,
    teachingUse: `${row.title}只能用于定位来源，不能安排可核对的学习活动。`,
    missingIndependentContract: `${row.title}缺少正文、任务、完成判据和证据合同，不能成为 PlanningUnit。`,
  };
  await expectFailure(sealLongformReviewRows(attacked), facts, 'insufficient-source contradicts complete teaching information');
}

const fixedFrame = cloneRows(source);
fixedFrame[semanticAttackIndex].semanticReview!.bodySummary = `本节围绕“${fixedFrame[semanticAttackIndex].title}”给出一项可复核的正文结论。`;
await expectFailure(sealLongformReviewRows(fixedFrame), facts, 'fixed sentence frame');

const fixedTeachingFrame = cloneRows(source);
fixedTeachingFrame[semanticAttackIndex].semanticReview!.teachingUse = `教学中可让学生依据“${fixedTeachingFrame[semanticAttackIndex].title}”复述模型与条件，并解释正文结论。`;
await expectFailure(sealLongformReviewRows(fixedTeachingFrame), facts, 'fixed sentence frame');

for (const opening of ['可直接把', '适合安排', '建议让学生', '可用于组织', '可设计为', '课堂上可要求']) {
  const attacked = cloneRows(source);
  attacked[semanticAttackIndex].semanticReview!.teachingUse = `${opening}本节对象整理为核对页，学生提交带条件与结果的记录。`;
  await expectFailure(sealLongformReviewRows(attacked), facts, 'forbidden opening');
}

const pseudoDiverseTeachingUses = cloneRows(source);
let acceptedIndex = 0;
for (const row of pseudoDiverseTeachingUses.filter((item) => (
  item.sourceFamily === 'textbook-section' &&
  item.semanticReview?.contentType !== 'insufficient-source' &&
  !item.resourceId.includes('-desired-outcomes-')
))) {
  const lead = row.semanticReview!.bodySummary;
  row.semanticReview!.teachingUse = acceptedIndex % 2 === 0
    ? `${lead} 学生整理${row.title}的对象与条件，提交“${row.title}核对页”。`
    : `${lead} 学生标出${row.title}的变量与结果，形成“${row.title}变量结果摘要页”。`;
  acceptedIndex += 1;
}
await expectFailure(sealLongformReviewRows(pseudoDiverseTeachingUses), facts, 'sentence-frame diversity');

const mismatchedActivityObject = cloneRows(source);
mismatchedActivityObject[semanticAttackIndex].semanticReview!.teachingUse = '学生根据倒立摆小车位移、摆角和轨道推力重建状态方程，提交“倒立摆状态反馈核对页”。';
await expectFailure(sealLongformReviewRows(mismatchedActivityObject), facts, 'activity object is not supported by the section body');

const captionDominated = cloneRows(source);
const captionDominatedRow = captionDominated.find((row) => row.resourceId === 'textbook-section:dorf-modern-control-systems:ch05-example-0511')!;
captionDominatedRow.semanticReview!.bodySummary = 'Two curves are plotted: a solid orange line labeled as the Third-order system and a dashed blue line labeled as the Second-order approximation. Both curves start at zero and approach one.';
await expectFailure(sealLongformReviewRows(captionDominated), facts, 'dominated by a figure caption');

const sectionRows = source.filter((row) => row.sourceFamily === 'textbook-section');
const acceptedSectionRows = sectionRows.filter((row) => row.semanticReview?.contentType !== 'insufficient-source');
assert(sectionRows.length === 1007 && acceptedSectionRows.length === 988 && sectionRows.length - acceptedSectionRows.length === 19, 'section accepted/insufficient counts must remain 988/19');
assert(new Set(acceptedSectionRows.map((row) => row.semanticReview!.teachingUse)).size === 988, 'all accepted teachingUse values must be item-specific');
const feedbackExample22 = source.find((row) => row.resourceId === 'textbook-section:feedback-control-of-dynamic-systems:ch02-example-0202')!;
assert(/quarter of a vehicle|fourth-order transfer function/i.test(feedbackExample22.semanticReview!.bodySummary) && /m_1[\s\S]*m_2[\s\S]*Y\(s\)\/R\(s\)/.test(feedbackExample22.semanticReview!.teachingUse), 'Feedback Control Example 2.2 must retain the quarter-car two-mass equation-to-transfer-function chain');
const dorfExample22 = source.find((row) => row.resourceId === 'textbook-section:dorf-modern-control-systems:ch02-example-0202')!;
assert(/Y\(s\)[\s\S]*partial fractions[\s\S]*y\(t\)[\s\S]*2\/3/i.test(dorfExample22.semanticReview!.bodySummary), 'Dorf Example 2.2 must retain Y(s), partial fractions, y(t), and steady-state 2/3');

const nonlinearModel = source.find((row) => row.resourceId === 'textbook-section:hu-shousong-auto-control-7th:ch08-sec01')!;
assert(
  /f\(t,\\ldots,y\)=g\(t,\\ldots,r\)/.test(`${nonlinearModel.semanticReview!.bodySummary} ${nonlinearModel.semanticReview!.teachingUse}`) &&
  !/f\(c\\dot\)|g\(c\\dot\)/.test(JSON.stringify(nonlinearModel)),
  'Hu Shousong nonlinear model must preserve f(t,...,y)=g(t,...,r) without corrupting function arguments',
);
const corruptedNonlinearModel = cloneRows(source);
const corruptedNonlinearRow = corruptedNonlinearModel.find((row) => row.resourceId === nonlinearModel.resourceId)!;
corruptedNonlinearRow.semanticReview!.bodySummary = corruptedNonlinearRow.semanticReview!.bodySummary.replace(
  '$f(t,\\ldots,y)=g(t,\\ldots,r)$',
  '$f(c\\dot)=g(c\\dot)$',
);
await expectFailure(sealLongformReviewRows(corruptedNonlinearModel), facts, 'corrupts nonlinear function notation');

const desiredOutcomeRows = source.filter((row) => (
  /^textbook-section:dorf-modern-control-systems:ch\d{2}-desired-outcomes-002$/.test(row.resourceId)
));
assert(desiredOutcomeRows.length === 13, 'all 13 Dorf Desired Outcomes rows must be reviewed');
for (const row of desiredOutcomeRows) {
  const chapter = row.resourceId.match(/:ch(\d{2})-/)![1];
  const markdown = readFileSync(path.join(
    process.cwd(),
    `course-content/runtime/resources/textbooks/dorf-modern-control-systems/sections/ch${chapter}-desired-outcomes-002.md`,
  ), 'utf8');
  const objectives = [...markdown.matchAll(/^\s*-\s+(.+)$/gm)].map((match) => match[1].trim());
  assert(objectives.length >= 3, `Dorf chapter ${chapter} must expose its complete Desired Outcomes list`);
  for (const objective of objectives) {
    const canonicalObjective = objective.replace('an appreciation of appreciate controls', 'an appreciation of controls');
    assert(row.semanticReview!.bodySummary.includes(canonicalObjective), `Dorf chapter ${chapter} summary omits an objective`);
    assert(row.semanticReview!.teachingUse.includes(canonicalObjective), `Dorf chapter ${chapter} teachingUse omits an objective`);
    for (const verb of desiredOutcomeActionVerbs(objective)) {
      assert(new RegExp(`${verb}→`, 'i').test(row.semanticReview!.teachingUse), `Dorf chapter ${chapter} ${verb} lacks observable evidence`);
    }
  }
  assert(!/的目标动词/.test(JSON.stringify(row)), `Dorf chapter ${chapter} retains a truncated objective phrase`);
}
const chapter1Outcomes = desiredOutcomeRows.find((row) => row.resourceId.includes(':ch01-desired-outcomes-'))!;
assert(!/appreciation of appreciate/i.test(JSON.stringify(chapter1Outcomes)), 'Dorf chapter 1 must remove the duplicated appreciation/appreciate wording');
const chapter3Outcomes = desiredOutcomeRows.find((row) => row.resourceId.includes(':ch03-desired-outcomes-'))!;
assert(!/(?:State|Design)→/.test(chapter3Outcomes.semanticReview!.teachingUse), 'state and control system design nouns must not be mapped as chapter 3 actions');
const chapter4Outcomes = desiredOutcomeRows.find((row) => row.resourceId.includes(':ch04-desired-outcomes-'))!;
assert(/State→/.test(chapter4Outcomes.semanticReview!.teachingUse) && !/Design→/.test(chapter4Outcomes.semanticReview!.teachingUse), 'chapter 4 must map leading State but not the design noun');

const genericTeachingObject = cloneRows(source);
genericTeachingObject[semanticAttackIndex].semanticReview!.teachingUse = '学生围绕chapter、discusses与advanced重建正文中的具体关系，形成“通用词关系表”，并提交逐项核对结果。';
await expectFailure(sealLongformReviewRows(genericTeachingObject), facts, 'matches a forbidden generic template');

for (const [label, teachingUse] of [
  ['generic relation-decision table', '学生围绕 feedback、system 与 stability 重建正文中的具体关系，形成“feedback-system 概念—关系判定表”；表内逐项标明定义对象、作用关系和成立边界，每一项均回指正文中的同名对象或公式。'],
  ['generic evidence card', `学生标出${source[semanticAttackIndex].title}的变量与结果，形成“${source[semanticAttackIndex].title}证据卡”。`],
  ['generic condition-result page', `学生依据${source[semanticAttackIndex].title}核对变量定义、成立条件和结论，提交“${source[semanticAttackIndex].title}条件—结论核验页”。`],
] as const) {
  const attacked = cloneRows(source);
  attacked[semanticAttackIndex].semanticReview!.teachingUse = teachingUse;
  await expectFailure(sealLongformReviewRows(attacked), facts, 'matches a forbidden generic template');
  assert(label.length > 0, 'generic-template attack label must be retained');
}
const incompleteDesiredOutcomes = cloneRows(source);
const chapter2Outcomes = incompleteDesiredOutcomes.find((row) => row.resourceId === 'textbook-section:dorf-modern-control-systems:ch02-desired-outcomes-002')!;
chapter2Outcomes.semanticReview!.teachingUse = chapter2Outcomes.semanticReview!.teachingUse.replace(/；5\.[\s\S]*$/, '');
await expectFailure(sealLongformReviewRows(incompleteDesiredOutcomes), facts, 'desired outcome missing from teaching use');

const truncatedDesiredOutcomes = cloneRows(source);
truncatedDesiredOutcomes.find((row) => row.resourceId === 'textbook-section:dorf-modern-control-systems:ch01-desired-outcomes-002')!
  .semanticReview!.teachingUse += '；describe their r的目标动词';
await expectFailure(sealLongformReviewRows(truncatedDesiredOutcomes), facts, 'truncated objective phrase');

const generatorSource = readFileSync(generatorPath, 'utf8');
assert(generatorSource.includes('--validate-explicit-source'), 'generator must expose explicit source validation');
assert(!generatorSource.includes('writeJsonl(SOURCE_PATH') && !generatorSource.includes('writeFile(SOURCE_PATH'), 'generator must not write accepted review decisions');

execFileSync('npx', ['tsx', generatorPath], { stdio: 'pipe' });
const first = Object.fromEntries(deliverables.slice(1, 5).map((file) => [file, readFileSync(path.join(governance, file))]));
execFileSync('npx', ['tsx', generatorPath], { stdio: 'pipe' });
for (const file of deliverables.slice(1, 5)) {
  assert(Buffer.compare(first[file], readFileSync(path.join(governance, file))) === 0, `second generator run is not byte-identical: ${file}`);
}
assert(deliverables.every((file) => existsSync(path.join(governance, file))) && cleanInputFiles.every(existsSync), 'all five generated outputs and two tracked clean-input files must exist');

const summary = readJson(path.join(governance, 'longform-textbook-reference-resource-semantics-summary.json'));
const workqueue = readJsonl(path.join(governance, 'longform-textbook-reference-resource-semantics-workqueue-items.jsonl'));
const reviewItems = readJsonl(path.join(governance, 'longform-textbook-reference-resource-semantics-review-items.jsonl'));
const auditRows = readJsonl(path.join(governance, 'resource-field-completion-audit.jsonl'))
  .filter((row) => source.some((item) => item.resourceId === row.resourceId));
const projectionRows = readJsonl(path.join(governance, 'runtime-resource-projections.jsonl'))
  .filter((row) => source.some((item) => item.resourceId === row.id));
assert(summary.denominator.total === source.length && summary.after.agentReviewed === source.length, 'materialized denominator mismatch');
assert(summary.after.humanConfirmed === 0 && summary.after.promotedPlanningUnits === 0, 'provenance/path guardrail mismatch');
assert(summary.after.sectionReviewCompleted === 1007, 'all section candidates need explicit review conclusions');
const insufficientSourceCount = sectionRows.filter((row) => row.semanticReview?.contentType === 'insufficient-source').length;
assert(summary.after.sectionSemanticReviewed === sectionRows.length - insufficientSourceCount, 'section semantic count must derive from explicit review conclusions');
assert(summary.after.sectionInsufficientSource === insufficientSourceCount, 'insufficient-source count must derive from explicit review conclusions');
assert(summary.after.semanticReviewed === source.length - insufficientSourceCount, 'batch semanticReviewed total must exclude exactly the factual insufficient-source rows');
assert(summary.after.rationaleDiversity.normalizedDecisionRatio >= 0.6, 'normalized section decisions are too repetitive');
assert(summary.after.rationaleDiversity.normalizedBodySummaryRatio >= 0.6, 'normalized section summaries are too repetitive');
assert(summary.after.rationaleDiversity.variableStrippedBodySummaryRatio >= 0.8, 'variable-stripped section summaries are too repetitive');
assert(summary.after.rationaleDiversity.nearDuplicatePairRatio <= 0.0001, 'near-duplicate section summaries must stay below the fail-closed threshold');
assert(summary.after.rationaleDiversity.semanticTeachingUseTotal === 988, 'accepted teaching-use denominator must remain 988');
assert(summary.after.rationaleDiversity.teachingUseSentenceFrameRatio >= 0.2, 'body-stripped teaching-use sentence frames are too repetitive');
assert(summary.after.rationaleDiversity.teachingUseTopSixFrameCoverage <= 0.45, 'top six teaching-use frames cover too much of the accepted corpus');
assert(summary.after.rationaleDiversity.actionObjectOutputRatio >= 0.75, 'action-object-output combinations are too repetitive');
assert(summary.after.rationaleDiversity.forbiddenTeachingUseStarts === 0, 'forbidden six openings must not cover accepted teaching uses');
assert(summary.after.rationaleDiversity.citationCommentSummaries === 0, 'citation comments cannot count as section summaries');
assert(summary.guardrails.addressHashParentVerified && summary.guardrails.beforeAfterIndependent, 'address or pre-overlay guardrail failed');
assert(summary.guardrails.authoringTeacherScopedAuditOnly && summary.guardrails.privacyMinimized, 'authoring privacy guardrail failed');
assert(workqueue.length === source.length && reviewItems.length === source.length, 'materialized item denominator mismatch');
assert(workqueue.every((row) => row.startingReviewStatus !== 'agent-reviewed'), 'before/workqueue must not read post-overlay review status');
assert(workqueue.every((row) => row.rawContentIncluded === false && row.privacyMinimized === true && row.title.length <= 96), 'workqueue privacy/title minimization mismatch');
assert(reviewItems.every((row) => row.reviewSourceSha256 === summary.reviewSourceSha256 && row.reviewRowHash), 'derived artifacts must retain source and row hashes');
assert(summary.delivery.files.length === 8 && summary.delivery.cleanDeliveryInput.validationMode === 'full', 'delivery manifest must list sealed clean-input and validator evidence files in full cross-check mode');
assert(summary.delivery.validationEntrypoints.liveFull.guarantee.includes('live runtime textbook section bodies'), 'live/full entrypoint must promise body cross-checking');
assert(summary.delivery.validationEntrypoints.deliveryClean.guarantee.includes('does not claim live textbook-body coverage'), 'delivery/clean entrypoint must not claim full live validation');
assert(auditRows.length === source.length && projectionRows.length === source.length, 'audit/projection longform denominators must close over review source');
assert(auditRows.every((row) =>
  row.reviewStatus === 'agent-reviewed' &&
  row.reviewAudit.reviewSourceSha256 === summary.reviewSourceSha256 &&
  row.reviewAudit.reviewRowHash &&
  row.reviewAudit.reviewArtifactVersion &&
  !row.reviewAudit.independentEvidenceRef.includes('longform-textbook-reference-resource-semantics-review-source') &&
  row.pathEligibility.current === false &&
  row.pathEligibility.masteryAffecting === false &&
  row.reviewConcluded === true &&
  row.semanticConfirmed === (source.find((item) => item.resourceId === row.resourceId)?.semanticReview?.contentType !== 'insufficient-source')
), 'audit rows must retain independent agent provenance without path/mastery authorization');
assert(projectionRows.every((row) =>
  row.reviewAudit.reviewSourceSha256 === summary.reviewSourceSha256 &&
  row.reviewAudit.reviewRowHash &&
  row.projectionLevel === 'ResourceSegment' &&
  row.reviewConcluded === true
), 'projection rows must retain review digests and remain non-PlanningUnit segments');
assert(projectionRows.every((row) =>
  row.lifecycleScope === 'audit-only' &&
  row.privacyScope === 'teacher-scoped' &&
  row.teacherPolicy === 'teacher-only' &&
  row.resourceNodeId === null &&
  row.routeTarget === null &&
  row.renderTarget === null &&
  row.citationTargets.length === 0 &&
  Object.values(row.graphNodeRefs).every((refs: unknown) => Array.isArray(refs) && refs.length === 0) &&
  row.evidenceContract === null &&
  row.retrievalChunk === null &&
  row.pathEligibility.current === false &&
  row.pathEligibility.afterCompletion === false &&
  row.pathEligibility.masteryAffecting === false &&
  row.groundingEligibility.retrievalReady === false &&
  row.groundingEligibility.citationReady === false
), 'agent-reviewed longform projections must remain strict teacher-only audit segments');
assert(Date.parse(summary.generatedAt) >= Math.max(...source.map((row) => Date.parse(row.reviewedAt))), 'generatedAt must not precede reviewedAt');
assert(Date.parse(summary.generatedAt) <= Date.now(), 'generatedAt cannot be a future placeholder');

console.log('Longform textbook/reference resource semantics live/full tests passed.');
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function expectFailure(rows: ReviewSourceRow[], currentFacts: Awaited<ReturnType<typeof loadLongformValidationFacts>>, expected: string) {
  try {
    await validateLongformReviewSource(rows, currentFacts);
  } catch (error) {
    assert(error instanceof Error && error.message.includes(expected), `expected failure “${expected}”, got “${String(error)}”`);
    return;
  }
  throw new Error(`expected validation failure: ${expected}`);
}

function cloneRows(rows: ReviewSourceRow[]): ReviewSourceRow[] {
  return structuredClone(rows);
}

function readJsonl(filePath: string): Row[] {
  return readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function readJson(filePath: string): Row {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

function desiredOutcomeActionVerbs(objective: string): string[] {
  const actions = 'Give|Recount|Predict|Recognize|Possess|Appreciate|Utilize|Understand|Interpret|Describe|Define|Obtain|Identify|Explain|State|Construct|Create|Design|Sketch|Analyze|Distinguish|Employ';
  return [
    objective.match(new RegExp(`^(${actions})\\b`, 'i'))?.[1],
    ...[...objective.matchAll(new RegExp(`\\band\\s+(?:also\\s+how\\s+to\\s+)?(${actions})\\b`, 'gi'))].map((match) => match[1]),
  ].filter((verb): verb is string => Boolean(verb));
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

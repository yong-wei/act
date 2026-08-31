import 'dotenv/config';
if (process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:5432(\/|$)/, ':5433$1');

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createAssignmentDraft, publishAssignmentRevision } from '../../src/lib/assignments/assignment-service';
import { assignmentPublicationIdempotencyKey } from '../../src/lib/assignments/assignment-service';
import { completeAssignmentContentAssetUpload, signAssignmentContentAssetUpload } from '../../src/lib/assignments/assignment-content-assets';
import { createSubmissionObjectStore } from '../../src/lib/assignments/submission-object-store';
import { createSubmissionContentScanner } from '../../src/lib/assignments/submission-scanner';
import { createPrismaClient } from '../../src/lib/prisma-client';

const prisma = createPrismaClient({ log: ['warn', 'error'] });
const sourcePath = path.resolve(process.env.T2S20_PATH ?? '../../脱敏样本/T2(max)-formal-preparation-v1/contents/T2S-20.md');
const assetRoot = path.dirname(sourcePath);

function digest(value: string) { return `sha256:${createHash('sha256').update(value).digest('hex')}`; }
function section(source: string, id: string) {
  const start = source.search(new RegExp(`^##\\s+${id}\\b`, 'm'));
  if (start < 0) throw new Error(`missing-section:${id}`);
  const next = source.slice(start + 1).search(/^##\s+/m);
  return source.slice(start, next < 0 ? source.length : start + 1 + next).replace(/\s+$/, '');
}
function questionFrom(source: string, id: string, points: number, criteriaCount: number, criterionPoints: number[]) {
  const raw = section(source, id);
  const headings = [...raw.matchAll(/^###\s+.*$/gm)].map((match) => match.index ?? 0);
  if (headings.length < 3) throw new Error(`missing-heading:${id}`);
  const block = (index: number) => raw.slice(headings[index], headings[index + 1] ?? raw.length).replace(/^###\s+.*$/m, '').trim();
  const prompt = block(0);
  const answer = block(1);
  const rubricText = raw.slice(headings[2]).trim();
  const criteria = criterionPoints.map((maxPoints, index) => ({
    id: `${id}-criterion-${index + 1}`,
    label: `T2S-20 ${id} 评分项 ${index + 1}`,
    goalDimension: (['controlModeling', 'parameterDesign', 'crossDomainTransfer', 'engineeringDecision', 'inquiryReflection', 'selfDirectedLearning'] as const)[index % 6],
    maxPoints,
    scoringStandard: `${rubricText.slice(0, 1800)}（第 ${index + 1} 项，按原评分标准核验）`,
    detailedRubricEnabled: false,
    evidenceDescription: '依据学生提交文件中的对应推导、图表或解释进行核验。',
    feedbackGuidance: '指出与权威参考答案及评分标准的对应证据。',
    studentVisibleGuidance: '按题目要求给出完整推导、标注和结论。',
    levels: [],
  }));
  if (criteria.length !== criteriaCount || criteria.reduce((sum, item) => sum + item.maxPoints, 0) !== points) throw new Error(`rubric-total-mismatch:${id}`);
  return { stableQuestionId: id, responseType: 'SUBJECTIVE_FILE' as const, points, prompt, referenceAnswer: answer, rubric: { schemaVersion: 'assignment-scoring-rubric.v2' as const, criteria }, source: { family: 'MANUAL' as const, authoringMarker: 'assignment-authoring' as const } };
}
async function uploadAsset(assignmentId: string, teacherId: string, fileName: string, mimeType: 'image/png') {
  const bytes = await readFile(path.join(assetRoot, 'assets', 'T2', fileName));
  const checksum = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  const signed = await signAssignmentContentAssetUpload(prisma, { actorId: teacherId, actorRole: 'TEACHER', assignmentId, upload: { fileName, mimeType, sizeBytes: bytes.byteLength, checksum } });
  const response = await fetch(signed.upload.url, { method: 'PUT', headers: signed.upload.requiredHeaders, body: bytes });
  if (!response.ok) throw new Error(`asset-upload-failed:${fileName}:${response.status}`);
  const completed = await completeAssignmentContentAssetUpload(prisma, { actorId: teacherId, actorRole: 'TEACHER', assignmentId, assetId: signed.assetId });
  return { assetId: signed.assetId, href: completed.href };
}

async function main() {
  const source = await readFile(sourcePath, 'utf8');
  const sourceDigest = digest(source);
  const targetClass = await prisma.class.findUniqueOrThrow({ where: { code: 'D94J24' }, select: { id: true, teacherId: true, isActive: true } });
  if (!targetClass.isActive) throw new Error('target-class-inactive');
  const now = new Date();
  const draft = {
    title: `阶段 A 专用闭环验收｜T2S-20｜${now.toISOString().slice(0, 16)}`,
    instructions: `仅用于阶段 A 受控验收。权威题目、参考答案和评分标准冻结自 T2S-20.md（${sourceDigest}）。提交文件不得包含真实身份信息。`,
    totalPoints: 100,
    latePolicy: { version: 1 as const, mode: 'CLOSED' as const },
    responsePolicy: { version: 1 as const, allowedResponseTypes: ['SUBJECTIVE_FILE' as const] },
    resubmissionPolicy: { version: 1 as const, maxAttempts: 1, untilDueAt: false },
    solutionReleasePolicy: { version: 1 as const, mode: 'TEACHER_CONFIRMED_RESULT' as const },
    questions: [
      questionFrom(source, 'T2-1', 20, 4, [2, 6, 4, 8]),
      questionFrom(source, 'T2-2', 20, 6, [2, 4, 3, 4, 3, 4]),
      questionFrom(source, 'T2-3', 20, 6, [4, 4, 3, 3, 3, 3]),
      questionFrom(source, 'O2', 40, 5, [10, 10, 8, 8, 4]),
    ],
  };
  const assignment = await createAssignmentDraft(prisma, { actor: { id: targetClass.teacherId, role: 'TEACHER' }, courseContext: `stage-a:T2S-20:${sourceDigest}`, draft });
  const initial = assignment.revisions[0]; if (!initial) throw new Error('revision-missing');
  const block = await uploadAsset(assignment.id, targetClass.teacherId, 'T2-2-block-diagram.png', 'image/png');
  const motor = await uploadAsset(assignment.id, targetClass.teacherId, 'T2-O2-dc-motor-example.png', 'image/png');
  const withAssets = {
    ...draft,
    questions: draft.questions.map((question) => question.stableQuestionId === 'T2-2'
      ? { ...question, prompt: `${question.prompt.replace(/!\[[^\]]*\]\([^)]*\)/g, '')}\n\n![T2-2 结构图](${block.href} "asset:${block.assetId}")` }
      : question.stableQuestionId === 'O2'
        ? { ...question, prompt: `${question.prompt.replace(/!\[[^\]]*\]\([^)]*\)/g, '')}\n\n![O2 示例图](${motor.href} "asset:${motor.assetId}")`, referenceAnswer: `${question.referenceAnswer.replace(/!\[[^\]]*\]\([^)]*\)/g, '')}\n\n![O2 示例图](${motor.href} "asset:${motor.assetId}")` }
        : question),
  };
  const revision = await (await import('../../src/lib/assignments/assignment-service')).updateAssignmentDraft(prisma, { actor: { id: targetClass.teacherId, role: 'TEACHER' }, assignmentId: assignment.id, revisionId: initial.id, expectedVersion: initial.version, draft: withAssets });
  const dueAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const publicationInput = { actor: { id: targetClass.teacherId, role: 'TEACHER' as const }, assignmentId: assignment.id, revisionId: revision.id, expectedVersion: revision.version, contentDigest: revision.contentHash, audiences: [{ classId: targetClass.id, availableAt: now.toISOString(), dueAt: dueAt.toISOString() }] };
  const publication = await publishAssignmentRevision(prisma, { ...publicationInput, idempotencyKey: assignmentPublicationIdempotencyKey(publicationInput) });
  const audienceCount = await prisma.assignmentAudience.count({ where: { assignmentRevisionId: revision.id } });
  console.log(JSON.stringify({ assignmentId: digest(assignment.id), revisionId: digest(revision.id), revisionVersion: revision.version, questionCount: revision.questions.length, totalPoints: Number(revision.totalPoints), audienceCount, dueAt: dueAt.toISOString(), sourceDigest, assetCount: 2, publicationState: publication.revision.state }));
}
void main().finally(() => prisma.$disconnect());

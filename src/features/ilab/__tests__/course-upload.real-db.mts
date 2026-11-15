import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { setTimeout } from 'node:timers/promises';

import { prisma } from '@/lib/prisma';
import { VESSEL_COURSE_VERSION } from '@/resources/simulations/experiments/destroyer-course';

import { emptyAiLedger } from '../ai-data';
import { uploadCourseReportToIlab } from '../adapters/ilab-course-upload';
import { summarizeVesselReview, vesselCourseStepReviewLimits } from '../course-report-review-contract';

config({ path: '.env.local', quiet: true });
config({ quiet: true });
assert(['127.0.0.1', 'localhost'].includes(new URL(process.env.DATABASE_URL!).hostname));

const state = { scoreFailures: 0, attachmentFailures: 0, delayedScoreFailure: false,
  scoreCalls: 0, attachmentCalls: 0, refreshCalls: 0, scores: new Set<number>(), origins: new Set<string>() };
const server = http.createServer(async (request, response) => {
  response.setHeader('content-type', 'application/json');
  const url = new URL(request.url!, 'http://127.0.0.1');
  const reply = (code: number) => response.end(JSON.stringify({ code, msg: `local fixture ${code}` }));
  if (url.pathname.endsWith('/token/refresh')) {
    state.refreshCalls++;
    response.end(JSON.stringify({ code: 0, access_token: 'refreshed-local-fixture', un: 'local-upload-fixture',
      expires_time: Date.now() + 3600_000 }));
    return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  if (url.pathname.endsWith('/data_upload')) {
    state.scoreCalls++;
    const payload = JSON.parse(Buffer.concat(chunks).toString());
    assert.equal(payload.steps.length, 20);
    state.scores.add(payload.score);
    state.origins.add(payload.originId);
    if (state.delayedScoreFailure) {
      state.delayedScoreFailure = false;
      await setTimeout(500);
      reply(77);
    } else if (state.scoreFailures-- > 0) reply(77);
    else reply(0);
    return;
  }
  if (url.pathname.endsWith('/attachment_upload')) {
    state.attachmentCalls++;
    assert(Buffer.concat(chunks).toString().includes('本地协议回归报告'));
    reply(state.attachmentFailures-- > 0 ? 77 : 0);
    return;
  }
  response.writeHead(404);
  reply(404);
});
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
assert(address && typeof address === 'object');
process.env.ILAB_BASE_URL = `http://127.0.0.1:${address.port}`;
process.env.ILAB_APP_ID = 'local-upload-fixture';
process.env.ILAB_SECRET = 'local-fixture-only';
delete process.env.ILAB_DEV_BYPASS;
const user = await prisma.user.create({ data: { name: 'Course upload protocol fixture', accountSource: 'ILAB' } });
try {
  const steps = Array.from({ length: 20 }, (_, index) => ({
    stepSequence: index + 1, attemptId: `fixture-${index + 1}`, feedback: '保留本次未达到的性能结果',
    ...vesselCourseStepReviewLimits('cruise', index + 1), performance: 0,
  }));
  const score = summarizeVesselReview(steps).finalScore;
  assert.equal(typeof score, 'number');
  const report = await prisma.virtualSimulationReport.create({ data: {
    userId: user.id, clientRef: randomUUID(), experimentKey: 'cruise-comfort',
    experimentVersion: VESSEL_COURSE_VERSION, status: 'submitted', title: 'Local protocol regression',
    score: score!, maxScore: 100, reportHtml: '<html><body>本地协议回归报告</body></html>',
    stepScores: [], rubric: { steps },
  } });
  const run = await prisma.ilabExperimentRun.create({ data: {
    originId: `vcrz_fx_${randomUUID().replaceAll('-', '')}`, userId: user.id, reportId: report.id,
    vesselId: 'fleet-cruise-adora', experimentVersion: VESSEL_COURSE_VERSION,
    appId: 'local-upload-fixture', ilabUsername: 'local-upload-fixture', accessToken: 'expired-local-fixture',
    tokenExpiresAt: new Date(Date.now() - 1000), startTimeMs: BigInt(Date.now() - 60_000),
    steps: [], aiLedger: emptyAiLedger(),
  } });
  const upload = () => uploadCourseReportToIlab({ reportId: report.id, actorUserId: user.id, originId: run.originId });
  const pending = await upload();
  assert(!pending.uploaded && !pending.retryableUpload);
  assert.equal(state.scoreCalls, 0);
  await prisma.virtualSimulationReport.update({ where: { id: report.id },
    data: { status: 'finalized', finalizedAt: new Date() } });
  state.scoreFailures = 1;
  assert((await upload()).retryableUpload);
  assert.equal((await prisma.ilabExperimentRun.findUniqueOrThrow({ where: { id: run.id } })).uploadStatus, 'failed');
  state.attachmentFailures = 1;
  assert((await upload()).retryableUpload);
  assert.equal((await prisma.ilabExperimentRun.findUniqueOrThrow({ where: { id: run.id } })).uploadStatus, 'score-uploaded');
  const scoreCalls = state.scoreCalls;
  assert((await upload()).uploaded);
  assert.equal(state.scoreCalls, scoreCalls, 'Attachment retry must preserve confirmed score');
  const attachmentCalls = state.attachmentCalls;
  assert((await upload()).uploaded);
  assert.equal(state.attachmentCalls, attachmentCalls, 'Lost-response retry must reuse completed transmission');
  assert.deepEqual([...state.scores], [score]);
  assert.equal(state.origins.size, 1);
  assert(state.refreshCalls > 0);
  const savedReport = await prisma.virtualSimulationReport.findUniqueOrThrow({ where: { id: report.id } });
  assert.equal(savedReport.status, 'finalized');
  assert.equal(savedReport.reportHtml, report.reportHtml);

  const nextReport = await prisma.virtualSimulationReport.create({ data: {
    userId: user.id, clientRef: randomUUID(), experimentKey: 'cruise-comfort',
    experimentVersion: VESSEL_COURSE_VERSION, status: 'draft', title: 'Next round fixture',
    score: 0, maxScore: 100, reportHtml: '', stepScores: [],
  } });
  const nextRun = await prisma.ilabExperimentRun.create({ data: {
    originId: `vcrz_fx_${randomUUID().replaceAll('-', '')}`, userId: user.id, reportId: nextReport.id,
    vesselId: run.vesselId, experimentVersion: VESSEL_COURSE_VERSION,
    appId: run.appId, ilabUsername: run.ilabUsername, accessToken: 'valid-local-fixture',
    startTimeMs: BigInt(Date.now()), steps: [], aiLedger: emptyAiLedger(),
  } });
  const priorCalls = state.scoreCalls;
  assert((await uploadCourseReportToIlab({ reportId: report.id, actorUserId: user.id, originId: nextRun.originId })).uploaded);
  assert.equal((await prisma.ilabExperimentRun.findUniqueOrThrow({ where: { id: nextRun.id } })).reportId,
    nextReport.id, 'Finishing an older report must preserve the new round');
  assert.equal(state.scoreCalls, priorCalls);

  await prisma.ilabExperimentRun.update({ where: { id: run.id }, data: { status: 2, uploadStatus: 'pending' } });
  state.delayedScoreFailure = true;
  await Promise.all([upload(), upload()]);
  const concurrent = await prisma.ilabExperimentRun.findUniqueOrThrow({ where: { id: run.id } });
  assert.equal(concurrent.uploadStatus, 'uploaded', 'A delayed concurrent failure must preserve confirmed success');
  assert.equal(concurrent.status, 1);
  assert.equal(concurrent.score, score);
  console.log(JSON.stringify({ pendingUntilFinalized: true, score, steps: 20,
    refreshCalls: state.refreshCalls, scoreCalls: state.scoreCalls, attachmentCalls: state.attachmentCalls,
    attachmentRetrySkippedScore: true, completedRetrySkippedAttachment: true, concurrentStatus: concurrent.uploadStatus }));
} finally {
  await prisma.ilabExperimentRun.deleteMany({ where: { userId: user.id } });
  await prisma.virtualSimulationReport.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await prisma.$disconnect();
}

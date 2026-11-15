import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { prisma } from '@/lib/prisma';
import { VESSEL_COURSE_VERSION } from '@/resources/simulations/experiments/destroyer-course';

import { openDestroyerSession } from '../destroyer-session';
import { openVesselSession } from '../vessel-session';
import { saveIlabRunDraft } from '../adapters/ilab-session-lifecycle';
import { loadCourseSessionRecovery } from '../adapters/course-session-recovery';

config({ path: '.env.local', quiet: true });
config({ quiet: true });
assert(['127.0.0.1', 'localhost'].includes(new URL(process.env.DATABASE_URL!).hostname));

const user = await prisma.user.create({ data: { name: 'Concurrent session recovery fixture' } });
try {
  const count = 12;
  const originsByVessel: number[] = [];
  for (const experimentKey of ['cruise-comfort', 'destroyer']) {
    const sessions = await Promise.all(Array.from({ length: count }, () => experimentKey === 'destroyer'
      ? openDestroyerSession({ platformUser: user, experimentVersion: VESSEL_COURSE_VERSION })
      : openVesselSession({ experimentKey, platformUser: user, experimentVersion: VESSEL_COURSE_VERSION })));
    const origins = sessions.map((session) => {
      assert(session.connected);
      return session.session.originId;
    });
    originsByVessel.push(new Set(origins).size);
    await Promise.all(Array.from({ length: count }, (_, index) => saveIlabRunDraft({
      originId: origins[0], actor: { userId: user.id }, seq: index + 1,
      readings: { prediction: `Saved prediction ${index + 1}` },
    })));
    const saved = await prisma.ilabExperimentRun.findUniqueOrThrow({ where: { originId: origins[0] } });
    const drafts = saved.stepDrafts as { bySeq?: Record<string, unknown> };
    console.log(JSON.stringify({ experimentKey, concurrentRequests: count,
      distinctOrigins: new Set(origins).size, savedDraftSteps: Object.keys(drafts.bySeq ?? {}).length }));
    assert.equal(Object.keys(drafts.bySeq ?? {}).length, count, 'Concurrent step drafts must each be preserved');
    assert.equal(new Set(origins).size, 1, 'Concurrent initializations must resume one active experiment');
    const restart = experimentKey === 'destroyer'
      ? await openDestroyerSession({ platformUser: user, experimentVersion: VESSEL_COURSE_VERSION, forceNew: true })
      : await openVesselSession({ experimentKey, platformUser: user, experimentVersion: VESSEL_COURSE_VERSION, forceNew: true });
    assert(restart.connected);
    assert.notEqual(restart.session.originId, origins[0]);
    assert(restart.session.reportClientRef);
    const firstSession = sessions[0];
    assert(firstSession.connected && firstSession.session.reportClientRef);
    const firstRef = firstSession.session.reportClientRef;
    const secondRef = restart.session.reportClientRef;
    assert.notEqual(firstRef, secondRef);
    const courseKey = experimentKey === 'destroyer' ? 'destroyer' : 'cruise';
    const report = await prisma.virtualSimulationReport.create({ data: {
      userId: user.id, clientRef: firstRef, experimentKey: courseKey, experimentVersion: VESSEL_COURSE_VERSION,
      title: 'Historical round recovery fixture', score: 0, maxScore: 100, stepScores: [], reportHtml: '',
    } });
    await prisma.ilabExperimentRun.update({ where: { originId: origins[0] }, data: { reportId: report.id,
      stepDrafts: { activeSeq: 1, bySeq: { '1': { prediction: 'Saved before round binding' } } } } });
    await saveIlabRunDraft({ originId: origins[0], actor: { userId: user.id }, activeSeq: 3, seq: 3,
      readings: { prediction: 'Historical A only' }, courseState: { reportClientRef: firstRef } });
    const current = await loadCourseSessionRecovery({ userId: user.id, courseKey, courseVersion: VESSEL_COURSE_VERSION });
    assert.equal(current.ilabRun?.originId, restart.session.originId, 'Historical edits must not change default round');
    assert.equal(current.reportClientRef, secondRef);
    const historic = await loadCourseSessionRecovery({ userId: user.id, courseKey, courseVersion: VESSEL_COURSE_VERSION,
      reportClientRef: firstRef });
    assert.equal(historic.ilabRun?.originId, origins[0]);
    assert.equal(historic.ilabRun?.draftActiveSeq, 3);
    assert.equal(historic.ilabRun?.stepDrafts['1'].prediction, 'Saved before round binding');
    await assert.rejects(saveIlabRunDraft({ originId: restart.session.originId, actor: { userId: user.id },
      courseState: { reportClientRef: firstRef } }),
    (error: unknown) => error instanceof Error && 'status' in error && error.status === 409);
    await assert.rejects(loadCourseSessionRecovery({ userId: user.id, courseKey, originId: restart.session.originId,
      courseVersion: VESSEL_COURSE_VERSION, reportClientRef: firstRef }),
    (error: unknown) => error instanceof Error && 'status' in error && error.status === 409);
    await assert.rejects(loadCourseSessionRecovery({ userId: randomUUID(), courseKey, originId: origins[0] }),
    (error: unknown) => error instanceof Error && 'status' in error && error.status === 404);
    await assert.rejects(saveIlabRunDraft({ originId: restart.session.originId,
      actor: { userId: 'another-user' }, seq: 1, readings: { prediction: 'Must be rejected' } }),
    (error: unknown) => error instanceof Error && 'status' in error && error.status === 403);
  }
  console.log(JSON.stringify({ distinctOriginsPerVessel: originsByVessel, forceNew: 'separate', crossAccountDraft: 'rejected',
    historicalRoundPinned: true, currentRoundStable: true, crossRoundDraft: '409', crossRoundRecovery: '409' }));
} finally {
  await prisma.ilabExperimentRun.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
}

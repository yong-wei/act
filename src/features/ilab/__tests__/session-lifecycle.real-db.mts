import { config } from 'dotenv';
import assert from 'node:assert/strict';

import { prisma } from '@/lib/prisma';
import { VESSEL_COURSE_VERSION } from '@/resources/simulations/experiments/destroyer-course';

import { openDestroyerSession } from '../destroyer-session';
import { openVesselSession } from '../vessel-session';
import { saveIlabRunDraft } from '../adapters/ilab-session-lifecycle';

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
    await assert.rejects(saveIlabRunDraft({ originId: restart.session.originId,
      actor: { userId: 'another-user' }, seq: 1, readings: { prediction: 'Must be rejected' } }),
    (error: unknown) => error instanceof Error && 'status' in error && error.status === 403);
  }
  console.log(JSON.stringify({ distinctOriginsPerVessel: originsByVessel, forceNew: 'separate', crossAccountDraft: 'rejected' }));
} finally {
  await prisma.ilabExperimentRun.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
}

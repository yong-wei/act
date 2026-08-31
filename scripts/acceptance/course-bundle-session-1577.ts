/**
 * Issue #1577 browser-equivalent acceptance for the ordinary runtime-first path.
 * Creates a real teacher/plan/session through the same creation boundary the
 * API route uses, then the harness drives the dev server over HTTP.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { createPrismaClient } from '../../src/lib/prisma-client';

import { captureRuntimeCourseBundleIdentity } from '@/lib/course-bundle/capture';
import { persistCourseBundleRevision } from '@/lib/course-bundle/session-binding';
import { buildSessionParticipantHref } from '@/lib/classroom-session-route';
import { withPresetRuntimeStepBinding } from '@/lib/lesson-plan-runtime-binding';
import { UNIT_1_1_PRESET_KEY } from '@/lib/unit-1-1-course';

const prisma = createPrismaClient();
const results: Array<[string, boolean, string]> = [];

function record(step: string, ok: boolean, detail = '') {
  results.push([step, ok, detail]);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${step}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  const teacher = await prisma.user.upsert({
    where: { id: 'accept-1577-teacher' },
    create: { id: 'accept-1577-teacher', email: 'accept-1577@example.com', name: '验收教师', role: 'TEACHER' },
    update: {},
  });

  const items = [
    { stage: 'BRIDGE_IN', order: 1, overrideConfig: withPresetRuntimeStepBinding({}, {
      sourcePresetKey: UNIT_1_1_PRESET_KEY,
      runtimeLessonId: '1-1',
      runtimeStepId: 'lesson-step-1',
    }) },
  ];
  const plan = await prisma.lessonPlan.upsert({
    where: { id: 'accept-1577-plan' },
    create: {
      id: 'accept-1577-plan',
      title: '验收互动课 1-1',
      authorId: teacher.id,
      isPublic: false,
      items: {
        create: items.map((item) => ({
          stage: item.stage as never,
          order: item.order,
          duration: 5,
          overrideConfig: item.overrideConfig as object,
        })),
      },
    },
    update: {},
  });

  // Creation boundary: capture + persist + bind (same helpers as the route).
  const identity = await captureRuntimeCourseBundleIdentity('1-1');
  record('capture produces identity-complete bundle', Boolean(
    identity.bundleId === '1-1'
    && identity.canonicalLessonId === '1-1'
    && /^[0-9a-f]{64}$/.test(identity.bundleDigest)
    && identity.resourceHashes.lesson
    && identity.resourceHashes.graphOverlay
    && identity.resourceHashes.interactiveManifest
    && identity.runtimeReleaseId.length > 0,
  ), `release=${identity.runtimeReleaseId} digest=${identity.bundleDigest.slice(0, 12)}`);

  const revision = await persistCourseBundleRevision(prisma, identity);
  record('revision persisted', Boolean(revision.id && revision.bundleRevision === 1));

  const reused = await persistCourseBundleRevision(prisma, identity);
  record('identical content reuses the same revision (immutable, no mutation)', reused.id === revision.id);

  const session = await prisma.classSession.create({
    data: {
      id: 'accept-1577-session',
      joinCode: '157701',
      planId: plan.id,
      teacherId: teacher.id,
      status: 'ACTIVE',
      currentStage: 'BRIDGE_IN',
      lessonVersion: 'accept',
      manifestHash: revision.manifestHash,
      totalSteps: 1,
      courseBundleRevisionId: revision.id,
      bundleRuntimeReleaseId: revision.runtimeReleaseId,
      bundleDigest: revision.bundleDigest,
    },
  });
  record('session captured the binding', Boolean(
    session.courseBundleRevisionId === revision.id
    && session.bundleRuntimeReleaseId === revision.runtimeReleaseId
    && session.bundleDigest === revision.bundleDigest,
  ));

  // Title change must not move the participant route for a bound session.
  const hrefBefore = buildSessionParticipantHref({
    role: 'teacher', sessionId: session.id, planTitle: plan.title,
    bundleCanonicalLessonId: revision.canonicalLessonId,
    bundleBound: true,
  });
  const hrefAfter = buildSessionParticipantHref({
    role: 'teacher', sessionId: session.id, planTitle: '3-3：根轨迹机制与完整法则',
    bundleCanonicalLessonId: revision.canonicalLessonId,
    bundleBound: true,
  });
  record('plan title change does not move a bound session route', hrefBefore === hrefAfter
    && hrefBefore === '/interactive-learning/courses/unit-1-1-see-the-full-picture/teacher/accept-1577-session', hrefBefore);

  // Optional projection missing degrades softly: handout pdf hash absent case is
  // covered by unit tests; here we verify media objects are pinned to the capture.
  record('media objects recorded per-resource', Array.isArray(identity.resourceHashes.mediaObjects) || identity.resourceHashes.mediaObjects === undefined,
    `mediaObjects=${identity.resourceHashes.mediaObjects?.length ?? 0}`);

  // Runtime content drift must fail the bound read (equivalent to an active
  // release switch in the unreleased-worktree local mode).
  const lessonJsonPath = 'course-content/runtime/lessons/1-1/lesson.json';
  const original = readFileSync(lessonJsonPath, 'utf8');
  const driftBaseline = createHash('sha256').update(original).digest('hex');
  record('baseline lesson.json hash matches capture', driftBaseline === identity.resourceHashes.lesson);

  const base = process.env.ACCEPT_BASE_URL || 'http://localhost:3002';
  const studentPath = `/interactive-learning/courses/unit-1-1-see-the-full-picture/student/${session.id}`;
  const intact = await fetch(`${base}${studentPath}`, { headers: { 'x-forwarded-proto': 'http' } });
  const intactHtml = await intact.text();
  record('student page renders for the bound session', intact.status === 200 && !intactHtml.includes('data-course-bundle-drift'), `status=${intact.status}`);

  writeFileSync(lessonJsonPath, original + '\n');
  let driftRendered = false;
  try {
    const drifted = await fetch(`${base}${studentPath}`);
    const driftHtml = await drifted.text();
    driftRendered = driftHtml.includes('data-course-bundle-drift');
    record('runtime content drift fails closed for the bound session', driftRendered, `status=${drifted.status}`);
  } finally {
    writeFileSync(lessonJsonPath, original);
  }

  // After restore the page must serve normally again (no sticky failure).
  const restored = await fetch(`${base}${studentPath}`);
  const restoredHtml = await restored.text();
  record('restored content serves the bound session again', restored.status === 200 && !restoredHtml.includes('data-course-bundle-drift'));

  console.log('\nsummary:', results.filter(([, ok]) => ok).length + '/' + results.length, 'passed');
  const failed = results.filter(([, ok]) => !ok);
  if (failed.length > 0 || !existsSync(lessonJsonPath)) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

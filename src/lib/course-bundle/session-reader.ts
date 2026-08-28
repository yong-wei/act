import 'server-only';

import { prisma } from '@/lib/prisma';
import { loadLessonRuntimeEntry, type RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import type { CourseBundleRevision } from '@prisma/client';
import {
  classifySessionBundleBinding,
  sessionBundleBindingFromRevision,
  verifySessionCourseBundleBinding,
} from './session-binding';
import { buildSessionParticipantHref } from '@/lib/classroom-session-route';

export type SessionBoundLessonRuntimeResult =
  | {
    status: 'bound';
    lessonRuntime: RuntimeLessonEntryBundle;
    revision: CourseBundleRevision;
  }
  | {
    status: 'legacy';
    lessonRuntime: RuntimeLessonEntryBundle;
  }
  | {
    status: 'route-mismatch';
    expectedCanonicalId: string;
    boundCanonicalId: string;
    redirectHref: string;
    role: 'teacher' | 'student';
  }
  | {
    status: 'drift';
    code: string;
    sessionId: string;
  };

/**
 * Single session-bound runtime reader for course role pages. Bound sessions
 * load through the captured bundle binding (hash verification, no active
 * release / authoring / title fallback); legacy sessions keep the previous
 * direct read, classified as such.
 */
export async function loadSessionBoundLessonRuntime(options: {
  sessionId: string;
  expectedCanonicalId: string;
  role: 'teacher' | 'student';
}): Promise<SessionBoundLessonRuntimeResult> {
  const session = await prisma.classSession.findUnique({
    where: { id: options.sessionId },
    select: {
      id: true,
      courseBundleRevisionId: true,
      bundleRuntimeReleaseId: true,
      bundleDigest: true,
      manifestHash: true,
      courseBundleRevision: {
        select: {
          id: true,
          bundleId: true,
          canonicalLessonId: true,
          bundleRevision: true,
          runtimeReleaseId: true,
          runtimeTreeSha256: true,
          runtimeManifestSha256: true,
          runtimeSourceRevision: true,
          runtimeObjectLocator: true,
          bundleDigest: true,
          identityProjectionHash: true,
          manifestHash: true,
          resourceHashes: true,
          qualification: true,
          capturedAt: true,
        },
      },
    },
  });
  if (!session) {
    // No session row: keep the pre-binding render behavior (the client layer
    // reports session state) and classify the read as unbound.
    return {
      status: 'legacy',
      lessonRuntime: await loadLessonRuntimeEntry(options.expectedCanonicalId),
    };
  }

  const classification = classifySessionBundleBinding(session);
  if (classification === 'legacy-incomplete') {
    return {
      status: 'legacy',
      lessonRuntime: await loadLessonRuntimeEntry(options.expectedCanonicalId),
    };
  }

  let revision: CourseBundleRevision;
  try {
    revision = await verifySessionCourseBundleBinding(prisma, session);
  } catch (error) {
    return {
      status: 'drift',
      code: error instanceof Error ? error.message : 'course-bundle-binding-drift',
      sessionId: session.id,
    };
  }

  if (revision.canonicalLessonId !== options.expectedCanonicalId) {
    return {
      status: 'route-mismatch',
      expectedCanonicalId: options.expectedCanonicalId,
      boundCanonicalId: revision.canonicalLessonId,
      role: options.role,
      redirectHref: buildSessionParticipantHref({
        role: options.role,
        sessionId: session.id,
        planTitle: null,
        bundleCanonicalLessonId: revision.canonicalLessonId,
        bundleBound: true,
      }),
    };
  }

  try {
    return {
      status: 'bound',
      revision,
      lessonRuntime: await loadLessonRuntimeEntry(options.expectedCanonicalId, {
        binding: sessionBundleBindingFromRevision(revision),
      }),
    };
  } catch (error) {
    return {
      status: 'drift',
      code: error instanceof Error ? error.message : 'course-bundle-resource-drift',
      sessionId: session.id,
    };
  }
}

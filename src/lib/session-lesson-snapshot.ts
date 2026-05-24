import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { resolveSessionRouteFromPlanTitle } from '@/lib/classroom-session-route';

export interface SessionLessonSnapshot {
  lessonVersion: string | null;
  manifestHash: string | null;
  totalSteps: number | null;
}

export function resolveRuntimeLessonKeyFromRouteSegment(routeSegment: string | null): string | null {
  if (!routeSegment) {
    return null;
  }

  const unitMatch = routeSegment.match(/^unit-(\d+)-(\d+)-/);
  if (unitMatch) {
    return `${unitMatch[1]}-${unitMatch[2]}`;
  }

  if (routeSegment === 'cruise-comfort-boppps') {
    return 'legacy/cruise-comfort-boppps';
  }

  return null;
}

export function summarizeRuntimeLessonManifest(manifestContent: string): SessionLessonSnapshot {
  const manifest = JSON.parse(manifestContent) as {
    contract_version?: unknown;
    version?: unknown;
    steps?: unknown;
  };
  const steps = manifest.steps && typeof manifest.steps === 'object'
    ? Object.keys(manifest.steps).length
    : null;
  const version = typeof manifest.contract_version === 'string'
    ? manifest.contract_version
    : typeof manifest.version === 'string'
      ? manifest.version
      : null;

  return {
    lessonVersion: version,
    manifestHash: createHash('sha256').update(manifestContent).digest('hex'),
    totalSteps: steps,
  };
}

export function loadSessionLessonSnapshot(planTitle: string | null | undefined): SessionLessonSnapshot {
  const { routeSegment } = resolveSessionRouteFromPlanTitle(planTitle);
  const lessonKey = resolveRuntimeLessonKeyFromRouteSegment(routeSegment);

  if (!lessonKey) {
    return { lessonVersion: null, manifestHash: null, totalSteps: null };
  }

  const manifestPath = join(
    process.cwd(),
    'course-content',
    'runtime',
    'lessons',
    lessonKey,
    'interactive-manifest.json',
  );

  if (!existsSync(manifestPath)) {
    return { lessonVersion: null, manifestHash: null, totalSteps: null };
  }

  return summarizeRuntimeLessonManifest(readFileSync(manifestPath, 'utf8'));
}

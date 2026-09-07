import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { buildLessonHandoutPrintPath } from './handout-pdf';
import { INTERACTIVE_LESSON_IDENTITY_REGISTRY } from './interactive-lesson-identity';
import {
  getAllRegisteredResourceMetadata,
  type RegisteredResourceMetadata,
} from './resource-registry-metadata';

export function createTeachingLaunchRouteRecord(href: string): RegisteredResourceMetadata {
  return {
    id: `teaching-launch-route:${createHash('sha256').update(href).digest('hex').slice(0, 16)}`,
    label: 'Teaching launch route',
    type: 'INTERACTIVE_COMP',
    launchTarget: href,
    renderTarget: href,
  };
}

/** Course/handout/step/sim routes owned by live RegistryIndex only — not resource-node inventory. */
export function getTeachingLaunchRouteRecords(): RegisteredResourceMetadata[] {
  const resources = getAllRegisteredResourceMetadata();
  const hrefs = new Set<string>(['/interactive-learning/control-odyssey']);
  for (const resource of resources) {
    if (resource.renderTarget?.startsWith('/') && !resource.renderTarget.startsWith('//')) {
      hrefs.add(resource.renderTarget);
    }
    if (resource.launchTarget?.startsWith('/') && !resource.launchTarget.startsWith('//')) {
      hrefs.add(resource.launchTarget);
    }
    if (resource.id.startsWith('sim-scene-')) {
      hrefs.add(`/simulations/${resource.id.slice('sim-scene-'.length)}`);
    }
  }
  for (const identity of INTERACTIVE_LESSON_IDENTITY_REGISTRY) {
    for (const routeSegment of identity.routeSegments) {
      hrefs.add(`/interactive-learning/courses/${routeSegment}`);
      const manifestPath = path.join(
        process.cwd(),
        'course-content/runtime/lessons',
        identity.runtimeLessonDir,
        'interactive-manifest.json',
      );
      if (!existsSync(/*turbopackIgnore: true*/ manifestPath)) continue;
      try {
        const manifest = JSON.parse(
          readFileSync(/*turbopackIgnore: true*/ manifestPath, 'utf8'),
        ) as { steps?: unknown };
        const stepIds = Array.isArray(manifest.steps)
          ? manifest.steps.flatMap((step) => (
            typeof step === 'string'
              ? [step]
              : step && typeof step === 'object' && typeof (step as { id?: unknown }).id === 'string'
                ? [(step as { id: string }).id]
                : []
          ))
          : manifest.steps && typeof manifest.steps === 'object'
            ? Object.keys(manifest.steps)
            : [];
        for (const stepId of stepIds) {
          hrefs.add(`/interactive-learning/courses/${routeSegment}/student/demo?step=${stepId}`);
        }
      } catch {
        // Missing or malformed optional manifests do not create guessed routes.
      }
    }
    hrefs.add(buildLessonHandoutPrintPath(identity.runtimeLessonDir));
  }
  return [...hrefs].sort().map(createTeachingLaunchRouteRecord);
}

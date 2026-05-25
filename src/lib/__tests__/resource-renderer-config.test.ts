import { describe, expect, it } from 'vitest';

import {
  buildResourceRendererLaunchContext,
  resolveInteractiveResourceConfig,
} from '@/features/lesson-engine/resource-renderer-config';

describe('resource renderer config resolution', () => {
  it('resolves component props in registry default, resource config, lesson override order', () => {
    const config = resolveInteractiveResourceConfig({
      registryDefaultConfig: {
        sceneId: 'cruise',
        telemetryPolicy: 'registry-policy',
        launchMode: 'route',
      },
      resourceConfig: {
        sceneId: 'destroyer',
        telemetryPolicy: 'resource-policy',
        props: {
          launchMode: 'embedded',
          resourceOnly: true,
        },
        tracking: {
          syncInterval: 60,
        },
      },
      overrideConfig: {
        sceneId: 'lng',
        props: {
          telemetryPolicy: 'override-policy',
          overrideOnly: true,
        },
        tracking: {
          syncInterval: 15,
        },
      },
    });

    expect(config.props).toMatchObject({
      sceneId: 'lng',
      launchMode: 'embedded',
      telemetryPolicy: 'override-policy',
      resourceOnly: true,
      overrideOnly: true,
    });
    expect(config.tracking).toEqual({ syncInterval: 15 });
  });

  it('marks DB BOPPPS launches as course-bound when session context is present', () => {
    const context = buildResourceRendererLaunchContext({
      resourceId: 'resource-1',
      registryId: 'sim-scene-cruise',
      sessionId: 'session-1',
      lessonItemId: 'item-1',
      lessonPlanId: 'plan-1',
      classId: 'class-1',
      stage: 'PARTICIPATORY',
    });

    expect(context).toMatchObject({
      provenance: 'db-boppps',
      contextState: 'course-bound',
      sessionId: 'session-1',
      lessonItemId: 'item-1',
      lessonPlanId: 'plan-1',
      classId: 'class-1',
      stage: 'PARTICIPATORY',
    });
  });

  it('uses context-limited standalone provenance when no course context is available', () => {
    const context = buildResourceRendererLaunchContext({
      resourceId: 'resource-standalone',
      registryId: 'sim-scene-cruise',
    });

    expect(context.provenance).toBe('standalone');
    expect(context.contextState).toBe('context-limited');
    expect(context.sessionId).toBeNull();
  });
});

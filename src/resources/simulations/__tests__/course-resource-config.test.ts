import { describe, expect, it } from 'vitest';

import {
  buildSimulationCourseEvidencePayload,
  buildSimulationCourseLaunchHref,
  ELIGIBLE_SIMULATION_SCENES,
  getSimulationCourseCompletionEventType,
  getSimulationCourseLaunchEventType,
  requiresPersistedSimulationRun,
  resolveSimulationCourseResourceConfig,
} from '../course-resource-config';
import { getAllRegisteredResources, getRegisteredResource } from '@/lib/resource-registry';
import { getEventMetadata } from '@/lib/data-governance/event-types';
import type { ResourceRendererLaunchContext } from '@/features/lesson-engine/resource-renderer-config';
import { resolveClassroomSessionIdFromPathname } from '../persisted-run-client';

const courseLaunchContext: ResourceRendererLaunchContext = {
  provenance: 'db-boppps',
  contextState: 'course-bound',
  resourceId: 'resource-1',
  registryId: 'sim-scene-cruise',
  sessionId: 'session-1',
  lessonItemId: 'item-1',
  lessonPlanId: 'plan-1',
  classId: 'class-1',
  stage: 'PARTICIPATORY',
};

describe('simulation course resource config', () => {
  it('defines the eligible standalone simulation scenes', () => {
    expect(Object.keys(ELIGIBLE_SIMULATION_SCENES)).toEqual([
      'cruise',
      'destroyer',
      'dredger',
      'drilling',
      'icebreaker',
      'lng',
      'container',
    ]);
  });

  it('registers simulation scenes and Arena workbench resources as SIMULATION_APP entries', () => {
    const ids = getAllRegisteredResources()
      .filter((resource) => resource.type === 'SIMULATION_APP')
      .map((resource) => resource.id);

    expect(ids).toEqual(expect.arrayContaining([
      'sim-scene-cruise',
      'sim-scene-destroyer',
      'sim-scene-dredger',
      'sim-scene-drilling',
      'sim-scene-icebreaker',
      'sim-scene-lng',
      'sim-scene-container',
      'arena-challenge-workbench',
      'arena-cruise-blackbox-workbench',
    ]));
    expect(getRegisteredResource('sim-scene-cruise')?.defaultConfig).toMatchObject({
      sceneId: 'cruise',
      telemetryPolicy: 'course-context',
    });
  });

  it('builds course launch hrefs with resource, scene, class, session, and lesson item context', () => {
    const config = resolveSimulationCourseResourceConfig({
      resourceKind: 'simulation-scene',
      sceneId: 'cruise',
      telemetryPolicy: 'course-context',
    });
    const href = buildSimulationCourseLaunchHref(config, courseLaunchContext, 'completion-channel-1');

    expect(href).toContain('/simulations/cruise?');
    expect(href).toContain('courseResource=1');
    expect(href).toContain('launchContext=db-boppps');
    expect(href).toContain('sessionId=session-1');
    expect(href).toContain('lessonItemId=item-1');
    expect(href).toContain('classId=class-1');
    expect(href).toContain('sceneId=cruise');
    expect(href).toContain('completionChannelId=completion-channel-1');
  });

  it('builds Arena workbench launch hrefs from override task ids', () => {
    const config = resolveSimulationCourseResourceConfig({
      resourceKind: 'arena-workbench',
      arenaTaskId: 'task-cruise-roll-blackbox-identification',
    });
    const href = buildSimulationCourseLaunchHref(config, {
      ...courseLaunchContext,
      registryId: 'arena-challenge-workbench',
    });

    expect(href).toContain('/arena/challenges/task-cruise-roll-blackbox-identification?');
    expect(href).toContain('arenaTask=task-cruise-roll-blackbox-identification');
  });

  it('preserves existing route query while appending course launch context', () => {
    const config = resolveSimulationCourseResourceConfig({
      resourceKind: 'arena-workbench',
      arenaTaskId: 'task-cruise-roll-blackbox-identification',
      routeHref: '/arena/challenges/task-cruise-roll-blackbox-identification?publicationId=pub-1&tab=brief',
      governanceContext: {
        seasonId: 'season-1',
      },
    });
    const href = buildSimulationCourseLaunchHref(config, courseLaunchContext);
    const url = new URL(href, 'https://example.edu');

    expect(url.pathname).toBe('/arena/challenges/task-cruise-roll-blackbox-identification');
    expect(url.searchParams.get('publicationId')).toBe('pub-1');
    expect(url.searchParams.get('seasonId')).toBe('season-1');
    expect(url.searchParams.get('tab')).toBe('brief');
    expect(url.searchParams.get('arenaTask')).toBe('task-cruise-roll-blackbox-identification');
    expect(url.searchParams.get('sessionId')).toBe('session-1');
  });

  it('uses structured launch config over stale arena task query values', () => {
    const config = resolveSimulationCourseResourceConfig({
      resourceKind: 'arena-workbench',
      arenaTaskId: 'task-second-order-lead-pid',
      routeHref: '/interactive-learning/control-workbench?arenaTask=forged-task&preset=old',
      governanceContext: {
        publicationId: 'publication-1',
        seasonId: 'season-2026',
      },
    });
    const href = buildSimulationCourseLaunchHref(config, courseLaunchContext);
    const url = new URL(href, 'https://example.edu');

    expect(url.searchParams.get('arenaTask')).toBe('task-second-order-lead-pid');
    expect(url.searchParams.get('publicationId')).toBe('publication-1');
    expect(url.searchParams.get('seasonId')).toBe('season-2026');
    expect(url.searchParams.get('preset')).toBe('old');
  });

  it('preserves route hash when adding launch query parameters', () => {
    const config = resolveSimulationCourseResourceConfig({
      sceneId: 'cruise',
      routeHref: '/simulations/cruise?view=compact#analysis',
    });
    const href = buildSimulationCourseLaunchHref(config, courseLaunchContext);
    const url = new URL(href, 'https://example.edu');

    expect(url.searchParams.get('view')).toBe('compact');
    expect(url.searchParams.get('sceneId')).toBe('cruise');
    expect(url.hash).toBe('#analysis');
  });

  it('keeps standalone launches context-limited instead of inventing course context', () => {
    const config = resolveSimulationCourseResourceConfig({ sceneId: 'destroyer' });
    const payload = buildSimulationCourseEvidencePayload(config, {
      provenance: 'standalone',
      contextState: 'context-limited',
      resourceId: 'resource-2',
      registryId: 'sim-scene-destroyer',
      sessionId: null,
      lessonItemId: null,
      lessonPlanId: null,
      classId: null,
      stage: null,
    });

    expect(payload.launchContext).toMatchObject({
      provenance: 'standalone',
      contextState: 'context-limited',
      sessionId: null,
      classId: null,
    });
  });

  it('exposes canonical registered event types for launch and completion evidence', () => {
    const simulationConfig = resolveSimulationCourseResourceConfig({ sceneId: 'cruise' });
    const arenaConfig = resolveSimulationCourseResourceConfig({
      resourceKind: 'arena-workbench',
      arenaTaskId: 'task-second-order-lead-pid',
      governanceContext: {
        publicationId: 'publication-1',
        seasonId: 'season-2026',
      },
    });

    expect(getSimulationCourseLaunchEventType(simulationConfig)).toBe('resource_open');
    expect(getSimulationCourseCompletionEventType(simulationConfig)).toBe('simulation_finish');
    expect(getSimulationCourseLaunchEventType(arenaConfig)).toBe('arena_workspace_start');
    expect(getSimulationCourseCompletionEventType(arenaConfig)).toBe('resource_complete');

    for (const eventType of [
      getSimulationCourseLaunchEventType(simulationConfig),
      getSimulationCourseCompletionEventType(simulationConfig),
      getSimulationCourseLaunchEventType(arenaConfig),
      getSimulationCourseCompletionEventType(arenaConfig),
    ]) {
      expect(getEventMetadata(eventType)).toBeDefined();
    }

    const payload = buildSimulationCourseEvidencePayload(arenaConfig, courseLaunchContext);
    expect(payload).toMatchObject({
      taskId: 'task-second-order-lead-pid',
      publicationId: 'publication-1',
      seasonId: 'season-2026',
      classId: 'class-1',
      sessionId: 'session-1',
    });
    expect(payload).not.toHaveProperty('score');
  });

  it('requires a trusted persisted run only for the scene that implements that protocol', () => {
    expect(requiresPersistedSimulationRun(
      resolveSimulationCourseResourceConfig({ sceneId: 'cruise' }),
    )).toBe(true);
    for (const sceneId of ['destroyer', 'dredger', 'drilling', 'icebreaker', 'lng', 'container']) {
      expect(requiresPersistedSimulationRun(
        resolveSimulationCourseResourceConfig({ sceneId }),
      )).toBe(false);
    }
  });

  it('extracts only a non-demo student classroom session as the server lookup key', () => {
    expect(resolveClassroomSessionIdFromPathname(
      '/interactive-learning/courses/unit-1-4/student/session-1',
    )).toBe('session-1');
    expect(resolveClassroomSessionIdFromPathname(
      '/interactive-learning/courses/unit-1-4/student/demo',
    )).toBeUndefined();
    expect(resolveClassroomSessionIdFromPathname(
      '/interactive-learning/control-workbench',
    )).toBeUndefined();
  });
});

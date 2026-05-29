import { describe, expect, it } from 'vitest';

import {
  buildInteractiveCompletionPayload,
  readWidgetResultData,
  resolveInteractiveCompletionEventType,
} from '../completion-event';

describe('interactive completion event payload', () => {
  it('uses a registered result event type and keeps evidence fields at payload top level', () => {
    const result = {
      success: true,
      score: 100,
      data: {
        eventType: 'simulation_finish',
        simulationId: 'cruise',
        taskId: 'task-cruise-roll-blackbox-identification',
        publicationId: 'publication-1',
        classId: 'class-1',
        pageType: 'forged-page',
      },
    };
    const resultData = readWidgetResultData(result);
    const payload = buildInteractiveCompletionPayload({
      result,
      resultData,
      isStandaloneResource: false,
      standaloneCompletionEventType: 'resource_complete',
      basePayload: {
        pageType: 'classroom',
        targetId: 'sim-scene-cruise',
      },
    });

    expect(payload).toMatchObject({
      eventType: 'simulation_finish',
      simulationId: 'cruise',
      taskId: 'task-cruise-roll-blackbox-identification',
      publicationId: 'publication-1',
      classId: 'class-1',
      pageType: 'classroom',
      targetId: 'sim-scene-cruise',
      result,
    });
  });

  it('falls back to classroom or standalone completion types when result eventType is absent or unregistered', () => {
    expect(resolveInteractiveCompletionEventType({
      resultData: {},
      isStandaloneResource: false,
      standaloneCompletionEventType: 'simulation_finish',
    })).toBe('assessment_complete');

    expect(resolveInteractiveCompletionEventType({
      resultData: { eventType: 'not_registered' },
      isStandaloneResource: true,
      standaloneCompletionEventType: 'simulation_finish',
    })).toBe('simulation_finish');
  });
});

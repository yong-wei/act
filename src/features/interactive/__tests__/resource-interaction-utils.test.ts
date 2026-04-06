import { describe, expect, it } from 'vitest';

import {
  inferStandaloneCompletionEventType,
  slugifyTrackingTarget,
} from '@/features/interactive/hooks/resource-interaction-utils';

describe('resource interaction utils', () => {
  it('classifies standalone completion events by resource semantics', () => {
    expect(
      inferStandaloneCompletionEventType({
        registryId: 'lesson13-cruise-typhoon-sim',
        surface: 'interactive_resource',
      }),
    ).toBe('simulation_finish');

    expect(
      inferStandaloneCompletionEventType({
        registryId: 'lesson12-bode-post-quiz',
        surface: 'interactive_resource',
      }),
    ).toBe('assessment_complete');

    expect(
      inferStandaloneCompletionEventType({
        registryId: 'unit-2-1-modeling-language',
        surface: 'lesson_entry',
      }),
    ).toBe('resource_complete');
  });

  it('builds stable tracking slugs from display labels', () => {
    expect(slugifyTrackingTarget('知识卡片：Bode 图')).toBe('bode');
    expect(slugifyTrackingTarget('  多表征联动可视化引擎  ')).toBe('unknown');
    expect(slugifyTrackingTarget('Step Response Intro')).toBe('step-response-intro');
  });
});

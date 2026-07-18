// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createManifestStudentActivityRegistry,
  renderStudentInteractiveActivity,
  type ManifestStepResponse,
} from '@/features/interactive/shared/manifest-runtime/activity-renderers';
import {
  normalizeInteractiveRuntimeManifest,
  type InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function manifestStep({
  cards,
  revealAnswer,
  studentAccess = {},
}: {
  cards: Array<{ id: string; prompt: string; referenceAnswer: string }>;
  revealAnswer?: string;
  studentAccess?: Record<string, unknown>;
}) {
  const manifest = normalizeInteractiveRuntimeManifest({
    lesson_id: 'confirmation-test',
    steps: {
      'step-test': {
        title: '确认语义测试',
        layout: { template: 'stacked_regions', regions: [] },
        modules: [],
        content_blocks: {},
        interaction_spec: {
          interaction_kind: 'activity_card_set',
          activity_cards: cards.map((card) => ({
            id: card.id,
            prompt: card.prompt,
            response_kind: 'choice.single',
            options: ['A', 'B'],
            reference_answer: card.referenceAnswer,
            submit_scope: 'per_card',
          })),
          ...(revealAnswer ? { reveal_answer: revealAnswer } : {}),
        },
        student_access: studentAccess,
      },
    },
  });
  return manifest!.steps[0]!;
}

function ActivityHarness({
  stepManifest,
  browseEnabled = true,
  answerVisible = false,
  onSubmit,
}: {
  stepManifest: InteractiveRuntimeStepManifest;
  browseEnabled?: boolean;
  answerVisible?: boolean;
  onSubmit: (response: ManifestStepResponse) => void | Promise<void>;
}) {
  return renderStudentInteractiveActivity({
    registry: createManifestStudentActivityRegistry(),
    step: { id: stepManifest.id },
    stepManifest,
    released: true,
    browseEnabled,
    answerVisible,
    revealProgress: 0,
    onSubmit,
  });
}

describe('manifest StudentCards confirmation behavior', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('does not confirm or reveal a failed live save and allows a successful retry without double submission', async () => {
    const pendingRetry = deferred<void>();
    const onSubmit = vi.fn()
      .mockRejectedValueOnce(new Error('save failed'))
      .mockImplementationOnce(() => pendingRetry.promise);
    const stepManifest = manifestStep({
      cards: [{ id: 'card-a', prompt: '选择 A。', referenceAnswer: '答案 A' }],
      revealAnswer: 'after_submit_or_teacher_reveal',
    });

    await act(async () => root.render(
      <ActivityHarness stepManifest={stepManifest} onSubmit={onSubmit} />,
    ));
    const option = container.querySelector<HTMLInputElement>('input[value="A"]')!;
    await act(async () => option.click());

    const submit = container.querySelector<HTMLButtonElement>('button')!;
    await act(async () => submit.click());

    expect(container.textContent).toContain('提交失败，请重试');
    expect(container.textContent).not.toContain('本卡已提交');
    expect(container.textContent).not.toContain('答案 A');

    await act(async () => {
      submit.click();
      submit.click();
    });
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(submit.disabled).toBe(true);
    expect(container.textContent).not.toContain('答案 A');

    await act(async () => pendingRetry.resolve());

    expect(container.textContent).toContain('本卡已提交');
    expect(container.textContent).toContain('答案 A');
  });

  it('reveals all reference answers only after every card is confirmed', async () => {
    const stepManifest = manifestStep({
      cards: [
        { id: 'card-a', prompt: '第一题。', referenceAnswer: '参考一' },
        { id: 'card-b', prompt: '第二题。', referenceAnswer: '参考二' },
      ],
      revealAnswer: 'after_all_submitted_or_teacher_reveal',
    });

    await act(async () => root.render(
      <ActivityHarness stepManifest={stepManifest} onSubmit={async () => undefined} />,
    ));
    const options = container.querySelectorAll<HTMLInputElement>('input[value="A"]');
    const buttons = container.querySelectorAll<HTMLButtonElement>('button');

    await act(async () => options[0]!.click());
    await act(async () => buttons[0]!.click());
    expect(container.textContent).not.toContain('参考一');
    expect(container.textContent).not.toContain('参考二');

    await act(async () => options[1]!.click());
    await act(async () => buttons[1]!.click());
    expect(container.textContent).toContain('参考一');
    expect(container.textContent).toContain('参考二');
  });

  it('allows the teacher to reveal all answers before submissions', async () => {
    const stepManifest = manifestStep({
      cards: [
        { id: 'card-a', prompt: '第一题。', referenceAnswer: '教师揭示一' },
        { id: 'card-b', prompt: '第二题。', referenceAnswer: '教师揭示二' },
      ],
      revealAnswer: 'after_all_submitted_or_teacher_reveal',
    });

    await act(async () => root.render(
      <ActivityHarness
        stepManifest={stepManifest}
        answerVisible
        onSubmit={async () => undefined}
      />,
    ));

    expect(container.textContent).toContain('教师揭示一');
    expect(container.textContent).toContain('教师揭示二');
  });

  it('keeps the historical after-submit reveal behavior when no answer policy is specified', async () => {
    const stepManifest = manifestStep({
      cards: [{ id: 'card-a', prompt: '演示作答。', referenceAnswer: '仅教师揭示' }],
    });

    await act(async () => root.render(
      <ActivityHarness stepManifest={stepManifest} onSubmit={() => undefined} />,
    ));
    await act(async () => container.querySelector<HTMLInputElement>('input[value="A"]')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('button')!.click());

    expect(container.textContent).toContain('本卡已提交');
    expect(container.textContent).toContain('仅教师揭示');
  });

  it('keeps the released 1-4 page 9 activity available while browse-only content remains locked', async () => {
    const rawManifest = JSON.parse(readFileSync(
      join(process.cwd(), 'course-content/runtime/lessons/1-4/interactive-manifest.json'),
      'utf8',
    ));
    const manifest = normalizeInteractiveRuntimeManifest(rawManifest)!;
    const stepManifest = manifest.steps.find((step) => step.id === 'step-09')!;

    expect(stepManifest.studentAccess.browse_required).toBe(true);
    expect(stepManifest.studentAccess.can_submit_without_browse).toBe(true);

    await act(async () => root.render(
      <ActivityHarness
        stepManifest={stepManifest}
        browseEnabled={false}
        onSubmit={async () => undefined}
      />,
    ));

    expect(container.textContent).not.toContain('教师尚未开放浏览');
    expect(container.querySelector('button')).not.toBeNull();
  });
});

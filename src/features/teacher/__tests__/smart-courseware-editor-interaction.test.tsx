// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SmartCoursewareEditor, type SmartCoursewareTeacherEnvelope } from '../smart-courseware-editor';
import { validateCoursewareComposition } from '@/lib/smart-courseware';
import { validCompositionInput, validPlan } from '@/lib/smart-courseware/__tests__/fixtures';

function withReadOnlyModuleHashes(metadata: ReturnType<typeof validCompositionInput>['moduleMetadata']) {
  return metadata.map((item) => ({ ...item, moduleContentHash: `readonly-${item.moduleId}` }));
}

describe('smart courseware editor activity creation', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('reports a retryable queue delivery failure instead of claiming the task was queued', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => '00000000-0000-4000-8000-000000000001' });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        job: { id: 'job-1', draftId: 'draft-1', state: 'RETRYABLE', firstIncompleteUnitKey: 'bridge-in', units: [] },
        delivery: { queued: false, errorCode: 'courseware-queue-unavailable' },
      }),
    } as Response)));
    const envelope: SmartCoursewareTeacherEnvelope = {
      draftId: 'draft-1', planRevisionId: 'plan-1', state: 'waiting-for-generation', version: 1,
      manifest: null, stalePlan: false, teacherModules: {}, compositionMetadata: [],
      planLimitations: [], aiReview: null, generationAudit: [],
    };
    await act(async () => root.render(createElement(SmartCoursewareEditor, { initialEnvelope: envelope })));
    const start = [...container.querySelectorAll('button')].find((button) => button.textContent === '开始生成课件')!;
    await act(async () => start.click());

    expect(container.textContent).toContain('队列投递失败');
    expect(container.textContent).toContain('courseware-queue-unavailable');
    expect(container.textContent).toContain('生成任务 RETRYABLE');
    expect(container.textContent).not.toContain('已进入队列');
  });

  it('reports a retryable MODULE delivery failure instead of claiming regeneration was queued', async () => {
    const composition = validCompositionInput();
    vi.stubGlobal('crypto', { randomUUID: () => '00000000-0000-4000-8000-000000000002' });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        job: { id: 'module-job-1', draftId: 'draft-1', state: 'RETRYABLE', mode: 'MODULE', targetModuleId: 'module-1' },
        delivery: { queued: false, errorCode: 'courseware-queue-unavailable' },
      }),
    } as Response)));
    const envelope: SmartCoursewareTeacherEnvelope = {
      draftId: 'draft-1', planRevisionId: 'plan-1', state: 'ready', version: 1,
      manifest: composition.runtimeManifest, stalePlan: false, teacherModules: {},
      compositionMetadata: withReadOnlyModuleHashes(composition.moduleMetadata),
      planLimitations: [], aiReview: null, generationAudit: [],
    };
    await act(async () => root.render(createElement(SmartCoursewareEditor, { initialEnvelope: envelope })));
    const regenerate = [...container.querySelectorAll('button')].find((button) => button.textContent === '重新生成所选模块')!;
    await act(async () => regenerate.click());

    expect(container.textContent).toContain('队列投递失败');
    expect(container.textContent).toContain('courseware-queue-unavailable');
    expect(container.textContent).toContain('生成任务 RETRYABLE');
    expect(container.textContent).not.toContain('模块重生成任务已进入队列');
  });

  it('submits a newly added activity with editable teacher evidence accepted by the server contract', async () => {
    const composition = validCompositionInput();
    const runtimeManifest = {
      ...composition.runtimeManifest,
      stages: composition.runtimeManifest.stages.map((stage, index) => index === 0 ? {
        ...stage,
        steps: stage.steps.map((step) => ({
          ...step,
          layoutId: 'two-column' as const,
          modules: step.modules.map((module) => ({ ...module, slotId: 'left', sizeId: 'half' })),
        })),
      } : stage),
    };
    let submitted: ReturnType<typeof validCompositionInput> | null = null;
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        submitted = JSON.parse(String(init.body));
        const validated = validateCoursewareComposition(submitted, validPlan());
        return {
          ok: true,
          json: async () => ({
            preview: {
              draftId: 'draft-1', version: 2, planRevisionId: 'plan-1',
              runtimeManifest: validated.runtimeManifest,
              moduleMetadata: validated.moduleMetadata.map((metadata) => ({ ...metadata, provenance: 'teacher_created' })),
              planLimitations: [], aiReview: null, generationAudit: [],
              validation: validated.validation,
            },
          }),
        } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    });
    vi.stubGlobal('fetch', fetch);
    const envelope: SmartCoursewareTeacherEnvelope = {
      draftId: 'draft-1', planRevisionId: 'plan-1', state: 'ready', version: 1,
      manifest: runtimeManifest, stalePlan: false, teacherModules: {},
      compositionMetadata: withReadOnlyModuleHashes(composition.moduleMetadata),
      planLimitations: [], aiReview: null, generationAudit: [],
    };
    await act(async () => root.render(createElement(SmartCoursewareEditor, { initialEnvelope: envelope })));

    const typeSelect = [...container.querySelectorAll('select')]
      .find((select) => select.parentElement?.textContent?.includes('新增模块类型'))!;
    await act(async () => {
      typeSelect.value = 'activity.panel';
      typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const add = [...container.querySelectorAll('button')].find((button) => button.textContent === '添加模块')!;
    await act(async () => add.click());

    const added = submitted!.moduleMetadata.find((metadata) => !composition.moduleMetadata.some((item) => item.moduleId === metadata.moduleId));
    expect(submitted!.moduleMetadata.every((metadata) => !('moduleContentHash' in metadata))).toBe(true);
    expect(submitted!.moduleMetadata[0]).toEqual(composition.moduleMetadata[0]);
    expect(added?.teacherFields).toMatchObject({
      expectedOutput: expect.any(String),
      reviewPoints: [expect.any(String)],
    });
    expect(container.textContent).toContain('所选内容可视编辑');
    expect(container.textContent).toContain('组合已保存');
  });

  it('edits activity responseKind, payload, and teacherFields in one PATCH and clears stale evidence', async () => {
    const composition = validCompositionInput();
    Object.assign(composition.moduleMetadata[2].teacherFields, {
      expectedOutput: '旧开放题输出',
      reviewPoints: ['旧开放题标准'],
    });
    let submitted: ReturnType<typeof validCompositionInput> | null = null;
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        submitted = JSON.parse(String(init.body));
        const validated = validateCoursewareComposition(submitted, validPlan());
        return {
          ok: true,
          json: async () => ({ preview: {
            draftId: 'draft-1', version: 2, planRevisionId: 'plan-1',
            runtimeManifest: validated.runtimeManifest,
            moduleMetadata: validated.moduleMetadata.map((metadata) => ({ ...metadata, provenance: 'teacher_created' })),
            planLimitations: [], aiReview: null, generationAudit: [], validation: validated.validation,
          } }),
        } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    });
    vi.stubGlobal('fetch', fetch);
    const envelope: SmartCoursewareTeacherEnvelope = {
      draftId: 'draft-1', planRevisionId: 'plan-1', state: 'ready', version: 1,
      manifest: composition.runtimeManifest, stalePlan: false, teacherModules: {},
      compositionMetadata: withReadOnlyModuleHashes(composition.moduleMetadata),
      planLimitations: [], aiReview: null, generationAudit: [],
    };
    await act(async () => root.render(createElement(SmartCoursewareEditor, { initialEnvelope: envelope })));

    const stepSelect = [...container.querySelectorAll('select')]
      .find((select) => select.parentElement?.textContent?.startsWith('步骤'))!;
    await act(async () => {
      stepSelect.value = 'step-3';
      stepSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const responseKind = [...container.querySelectorAll('select')]
      .find((select) => select.parentElement?.textContent?.startsWith('作答类型'))!;
    const prompt = [...container.querySelectorAll('textarea')]
      .find((textarea) => textarea.parentElement?.textContent?.startsWith('prompt'))!;
    await act(async () => {
      responseKind.value = 'choice.multi';
      responseKind.dispatchEvent(new Event('change', { bubbles: true }));
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(prompt, '选择全部稳定条件。');
      prompt.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const approve = [...container.querySelectorAll('button')].find((button) => button.textContent === '批准整课版本')!;
    expect(approve.disabled).toBe(true);
    const save = [...container.querySelectorAll('button')].find((button) => button.textContent === '保存所选内容')!;
    await act(async () => save.click());

    expect(fetch.mock.calls.filter(([, init]) => init?.method === 'PATCH')).toHaveLength(1);
    const activity = submitted!.runtimeManifest.stages[2].steps[0].modules[0];
    expect(activity).toMatchObject({ responseKind: 'choice.multi', payload: expect.objectContaining({ prompt: '选择全部稳定条件。' }) });
    expect(submitted!.moduleMetadata[2].teacherFields).toEqual({
      referenceAnswer: 'a',
      explanation: '教师专用解释',
      scoring: { strategy: 'exact-match', maxPoints: 1 },
      inclusionRationale: '该来源直接支撑本模块的教学内容。',
    });
    expect(approve.disabled).toBe(false);
  });

  it('selects the first copied module after splitting so module actions target the new step', async () => {
    const composition = validCompositionInput();
    const requestedUrls: string[] = [];
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      requestedUrls.push(url);
      if (init?.method === 'PATCH') {
        const submitted = JSON.parse(String(init.body));
        const validated = validateCoursewareComposition(submitted, validPlan());
        return {
          ok: true,
          json: async () => ({
            preview: {
              draftId: 'draft-1', version: 2, planRevisionId: 'plan-1',
              runtimeManifest: validated.runtimeManifest,
              moduleMetadata: validated.moduleMetadata.map((metadata) => ({ ...metadata, provenance: 'teacher_created' })),
              planLimitations: [], aiReview: null, generationAudit: [], validation: validated.validation,
            },
          }),
        } as Response;
      }
      if (init?.method === 'POST' && url.endsWith('/regeneration')) {
        return {
          ok: true,
          json: async () => ({ job: { id: 'module-job-1', draftId: 'draft-1', state: 'QUEUED', mode: 'MODULE' } }),
        } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    });
    vi.stubGlobal('fetch', fetch);
    const envelope: SmartCoursewareTeacherEnvelope = {
      draftId: 'draft-1', planRevisionId: 'plan-1', state: 'ready', version: 1,
      manifest: composition.runtimeManifest, stalePlan: false, teacherModules: {},
      compositionMetadata: withReadOnlyModuleHashes(composition.moduleMetadata),
      planLimitations: [], aiReview: null, generationAudit: [],
    };
    await act(async () => root.render(createElement(SmartCoursewareEditor, { initialEnvelope: envelope })));

    const split = [...container.querySelectorAll('button')].find((button) => button.textContent === '拆分当前步骤')!;
    await act(async () => split.click());
    const moduleSelect = [...container.querySelectorAll('select')]
      .find((select) => select.parentElement?.textContent?.startsWith('模块'))!;
    const copiedModuleId = moduleSelect.value;
    expect(copiedModuleId).toMatch(/^module-/);
    expect(copiedModuleId).not.toBe('module-1');

    const regenerate = [...container.querySelectorAll('button')].find((button) => button.textContent === '重新生成所选模块')!;
    await act(async () => regenerate.click());
    expect(requestedUrls).toContain(`/api/teacher/smart-courseware/drafts/draft-1/modules/${copiedModuleId}/regeneration`);
  });

  it('persists slot and registered size atomically without exposing incompatible local state', async () => {
    const composition = validCompositionInput();
    const submissions: ReturnType<typeof validCompositionInput>[] = [];
    let version = 1;
    let rejectNextPatch = false;
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        const submitted = JSON.parse(String(init.body)) as ReturnType<typeof validCompositionInput>;
        submissions.push(submitted);
        if (rejectNextPatch) {
          rejectNextPatch = false;
          return { ok: false, json: async () => ({ error: 'rejected' }) } as Response;
        }
        const validated = validateCoursewareComposition(submitted, validPlan());
        version += 1;
        return {
          ok: true,
          json: async () => ({ preview: {
            draftId: 'draft-1', version, planRevisionId: 'plan-1',
            runtimeManifest: validated.runtimeManifest,
            moduleMetadata: validated.moduleMetadata.map((metadata) => ({ ...metadata, provenance: 'teacher_created' })),
            planLimitations: [], aiReview: null, generationAudit: [], validation: validated.validation,
          } }),
        } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    });
    vi.stubGlobal('fetch', fetch);
    const envelope: SmartCoursewareTeacherEnvelope = {
      draftId: 'draft-1', planRevisionId: 'plan-1', state: 'ready', version,
      manifest: composition.runtimeManifest, stalePlan: false, teacherModules: {},
      compositionMetadata: withReadOnlyModuleHashes(composition.moduleMetadata),
      planLimitations: [], aiReview: null, generationAudit: [],
    };
    await act(async () => root.render(createElement(SmartCoursewareEditor, { initialEnvelope: envelope })));

    const selectFor = (label: string) => [...container.querySelectorAll('select')]
      .find((select) => select.parentElement?.textContent?.startsWith(label))!;
    const change = async (select: HTMLSelectElement, value: string) => {
      await act(async () => {
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
    };
    const placement = (submission: ReturnType<typeof validCompositionInput>) => {
      const runtimeModule = submission.runtimeManifest.stages[0].steps[0].modules[0];
      return { layoutId: submission.runtimeManifest.stages[0].steps[0].layoutId, slotId: runtimeModule.slotId, sizeId: runtimeModule.sizeId };
    };

    expect(selectFor('slot').value).toBe('main');
    expect(selectFor('注册尺寸').value).toBe('full');
    expect(selectFor('注册尺寸').disabled).toBe(true);

    const move = [...container.querySelectorAll('button')].find((button) => button.textContent === '步骤后移')!;
    await act(async () => move.click());
    expect(submissions).toHaveLength(1);
    expect(submissions[0].moduleMetadata.every((metadata) => !('moduleContentHash' in metadata))).toBe(true);

    await change(selectFor('布局'), 'main-sidebar');
    expect(placement(submissions.at(-1)!)).toEqual({ layoutId: 'main-sidebar', slotId: 'main', sizeId: 'two-thirds' });
    const beforeSidebar = submissions.length;
    await change(selectFor('slot'), 'sidebar');
    expect(submissions).toHaveLength(beforeSidebar + 1);
    expect(placement(submissions.at(-1)!)).toEqual({ layoutId: 'main-sidebar', slotId: 'sidebar', sizeId: 'third' });
    expect(selectFor('注册尺寸').value).toBe('third');

    await change(selectFor('布局'), 'single');
    expect(placement(submissions.at(-1)!)).toEqual({ layoutId: 'single', slotId: 'main', sizeId: 'full' });

    await change(selectFor('布局'), 'two-column');
    const beforeSameSize = submissions.length;
    await change(selectFor('slot'), 'right');
    expect(submissions).toHaveLength(beforeSameSize + 1);
    expect(placement(submissions.at(-1)!)).toEqual({ layoutId: 'two-column', slotId: 'right', sizeId: 'half' });

    const slotSelect = selectFor('slot');
    slotSelect.append(new Option('invalid', 'invalid'));
    const beforeInvalid = submissions.length;
    await change(slotSelect, 'invalid');
    expect(submissions).toHaveLength(beforeInvalid);
    expect(selectFor('slot').value).toBe('right');
    expect(selectFor('注册尺寸').value).toBe('half');
    expect(container.textContent).toContain('当前布局不存在该 slot');

    rejectNextPatch = true;
    const beforeFailure = submissions.length;
    await change(selectFor('slot'), 'left');
    expect(submissions).toHaveLength(beforeFailure + 1);
    expect(placement(submissions.at(-1)!)).toEqual({ layoutId: 'two-column', slotId: 'left', sizeId: 'half' });
    expect(selectFor('slot').value).toBe('right');
    expect(selectFor('注册尺寸').value).toBe('half');
    expect(submissions.every((submission) => submission.moduleMetadata.every(
      (metadata) => !('moduleContentHash' in metadata),
    ))).toBe(true);
  });
});

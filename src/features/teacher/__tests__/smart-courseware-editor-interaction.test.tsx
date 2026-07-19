// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SmartCoursewareEditor, type SmartCoursewareTeacherEnvelope } from '../smart-courseware-editor';
import { validateCoursewareComposition } from '@/lib/smart-courseware';
import { validCompositionInput, validPlan } from '@/lib/smart-courseware/__tests__/fixtures';

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
      compositionMetadata: composition.moduleMetadata,
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
    expect(added?.teacherFields).toMatchObject({
      expectedOutput: expect.any(String),
      reviewPoints: [expect.any(String)],
    });
    expect(container.textContent).toContain('编辑活动');
    expect(container.textContent).toContain('组合已保存');
  });

  it('edits activity responseKind, payload, and teacherFields in one PATCH and clears stale evidence', async () => {
    const composition = validCompositionInput();
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
    vi.spyOn(window, 'prompt').mockReturnValue(JSON.stringify({
      responseKind: 'choice.multi',
      payload: {
        prompt: '选择全部稳定条件。',
        options: [{ value: 'a', label: '条件 A' }, { value: 'b', label: '条件 B' }],
      },
      teacherFields: {
        referenceAnswer: 'a,b', explanation: '两个条件都需要满足。', scoring: { maxPoints: 2 },
        expectedOutput: '旧开放题输出', reviewPoints: ['旧开放题标准'], inclusionRationale: '覆盖目标。',
      },
    }));
    const envelope: SmartCoursewareTeacherEnvelope = {
      draftId: 'draft-1', planRevisionId: 'plan-1', state: 'ready', version: 1,
      manifest: composition.runtimeManifest, stalePlan: false, teacherModules: {},
      compositionMetadata: composition.moduleMetadata,
      planLimitations: [], aiReview: null, generationAudit: [],
    };
    await act(async () => root.render(createElement(SmartCoursewareEditor, { initialEnvelope: envelope })));

    const stepSelect = [...container.querySelectorAll('select')]
      .find((select) => select.parentElement?.textContent?.startsWith('步骤'))!;
    await act(async () => {
      stepSelect.value = 'step-3';
      stepSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const edit = [...container.querySelectorAll('button')].find((button) => button.textContent === '编辑活动')!;
    await act(async () => edit.click());

    expect(fetch.mock.calls.filter(([, init]) => init?.method === 'PATCH')).toHaveLength(1);
    const activity = submitted!.runtimeManifest.stages[2].steps[0].modules[0];
    expect(activity).toMatchObject({ responseKind: 'choice.multi', payload: expect.objectContaining({ prompt: '选择全部稳定条件。' }) });
    expect(submitted!.moduleMetadata[2].teacherFields).toEqual({
      referenceAnswer: 'a,b', explanation: '两个条件都需要满足。', scoring: { maxPoints: 2 }, inclusionRationale: '覆盖目标。',
    });
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
      compositionMetadata: composition.moduleMetadata,
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
});

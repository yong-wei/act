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
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() { return values.size; },
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, String(value)),
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    window.localStorage.clear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('restores courseware fields and adopts a new server baseline after a version conflict', async () => {
    vi.useFakeTimers();
    const composition = validCompositionInput();
    const step = composition.runtimeManifest.stages[0].steps[0];
    const selectedModule = step.modules[0];
    window.localStorage.setItem(
      `preparation-editor:courseware:draft-1:${step.id}:${selectedModule.id}`,
      JSON.stringify({
        stepTitle: '本地恢复步骤',
        payload: { ...selectedModule.payload, text: '本地恢复内容' },
        teacherFields: composition.moduleMetadata[0].teacherFields,
        responseKind: selectedModule.responseKind ?? 'text.long',
        baseVersion: 1,
        savedAt: '2026-07-25T00:00:00.000Z',
      }),
    );
    const validated = validateCoursewareComposition(composition, validPlan());
    let patchCount = 0;
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        patchCount += 1;
        if (patchCount > 1) {
          const submitted = JSON.parse(String(init.body));
          return {
            ok: true,
            json: async () => ({ preview: {
              draftId: 'draft-1', version: 3, planRevisionId: 'plan-1',
              runtimeManifest: submitted.runtimeManifest,
              moduleMetadata: submitted.moduleMetadata.map((metadata: Record<string, unknown>) => ({ ...metadata, provenance: 'teacher_created' })),
              planLimitations: [], aiReview: null, generationAudit: [], validation: validated.validation,
            } }),
          } as Response;
        }
        return {
          ok: false,
          status: 409,
          json: async () => ({ error: 'draft-version-conflict' }),
        } as Response;
      }
      if (url.endsWith('/previews/teacher')) {
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
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });
    vi.stubGlobal('fetch', fetch);
    const envelope: SmartCoursewareTeacherEnvelope = {
      draftId: 'draft-1', planRevisionId: 'plan-1', state: 'ready', version: 2,
      manifest: composition.runtimeManifest, stalePlan: false, teacherModules: {},
      compositionMetadata: withReadOnlyModuleHashes(composition.moduleMetadata),
      planLimitations: [], aiReview: null, generationAudit: [],
    };

    await act(async () => root.render(createElement(SmartCoursewareEditor, { initialEnvelope: envelope })));
    expect([...container.querySelectorAll('input')].some((input) => input.value === '本地恢复步骤')).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();
    });

    const patch = fetch.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(JSON.parse(String(patch?.[1]?.body)).expectedVersion).toBe(1);
    expect(container.textContent).toContain('存在版本冲突');
    expect(window.localStorage.getItem(`preparation-editor:courseware:draft-1:${step.id}:${selectedModule.id}`)).not.toBeNull();

    const adopt = [...container.querySelectorAll('button')]
      .find((button) => button.textContent === '读取服务器新基线并保留本地修改')!;
    await act(async () => adopt.click());
    expect(container.textContent).toContain('服务器版本 2');
    const preserved = [...container.querySelectorAll('input')]
      .find((input) => input.value === '本地恢复步骤');
    expect(preserved).toBeTruthy();

    const save = [...container.querySelectorAll('button')]
      .find((button) => button.textContent === '保存所选内容')!;
    await act(async () => save.click());
    const patches = fetch.mock.calls.filter(([, init]) => init?.method === 'PATCH');
    expect(JSON.parse(String(patches[1][1]?.body)).expectedVersion).toBe(2);
    expect(window.localStorage.getItem(`preparation-editor:courseware:draft-1:${step.id}:${selectedModule.id}`)).toBeNull();
  });

  it('clears a discarded local module draft before switching away', async () => {
    const composition = validCompositionInput();
    const firstStep = composition.runtimeManifest.stages[0].steps[0];
    const firstModule = firstStep.modules[0];
    const storageKey = `preparation-editor:courseware:draft-1:${firstStep.id}:${firstModule.id}`;
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) } as Response)));
    const envelope: SmartCoursewareTeacherEnvelope = {
      draftId: 'draft-1', planRevisionId: 'plan-1', state: 'ready', version: 1,
      manifest: composition.runtimeManifest, stalePlan: false, teacherModules: {},
      compositionMetadata: withReadOnlyModuleHashes(composition.moduleMetadata),
      planLimitations: [], aiReview: null, generationAudit: [],
    };

    await act(async () => root.render(createElement(SmartCoursewareEditor, { initialEnvelope: envelope })));
    const text = [...container.querySelectorAll('textarea')]
      .find((textarea) => textarea.closest('[data-courseware-visual-editor]'))!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(text, '应当放弃的本地内容');
      text.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(window.localStorage.getItem(storageKey)).not.toBeNull();

    const stepSelect = [...container.querySelectorAll('select')]
      .find((select) => select.parentElement?.textContent?.startsWith('步骤'))!;
    const secondStepId = [...stepSelect.options].find((option) => option.value !== firstStep.id)!.value;
    await act(async () => {
      stepSelect.value = secondStepId;
      stepSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(window.localStorage.getItem(storageKey)).toBeNull();

    await act(async () => {
      stepSelect.value = firstStep.id;
      stepSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect([...container.querySelectorAll('textarea')].some((textarea) => textarea.value === '应当放弃的本地内容')).toBe(false);
  });

  it('keeps a local module draft retryable when the PATCH request throws', async () => {
    const composition = validCompositionInput();
    const step = composition.runtimeManifest.stages[0].steps[0];
    const selectedModule = step.modules[0];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') throw new TypeError('network unavailable');
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    }));
    const envelope: SmartCoursewareTeacherEnvelope = {
      draftId: 'draft-1', planRevisionId: 'plan-1', state: 'ready', version: 1,
      manifest: composition.runtimeManifest, stalePlan: false, teacherModules: {},
      compositionMetadata: withReadOnlyModuleHashes(composition.moduleMetadata),
      planLimitations: [], aiReview: null, generationAudit: [],
    };
    await act(async () => root.render(createElement(SmartCoursewareEditor, { initialEnvelope: envelope })));
    const text = [...container.querySelectorAll('textarea')]
      .find((textarea) => textarea.closest('[data-courseware-visual-editor]'))!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(text, '断网时保留的课件内容');
      text.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const save = [...container.querySelectorAll('button')].find((button) => button.textContent === '保存所选内容')!;
    await act(async () => save.click());

    expect(container.textContent).toContain('保存请求失败，本地修改仍保留，请重试');
    expect(container.textContent).toContain('保存失败');
    expect(window.localStorage.getItem(
      `preparation-editor:courseware:draft-1:${step.id}:${selectedModule.id}`,
    )).not.toBeNull();
  });

  it('commits a saved module revision even when student preview refresh throws', async () => {
    const composition = validCompositionInput();
    const step = composition.runtimeManifest.stages[0].steps[0];
    const selectedModule = step.modules[0];
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        const submitted = JSON.parse(String(init.body));
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
      if (url.endsWith('/previews/student')) throw new TypeError('preview unavailable');
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    });
    vi.stubGlobal('fetch', fetch);
    const envelope: SmartCoursewareTeacherEnvelope = {
      draftId: 'draft-1', planRevisionId: 'plan-1', state: 'ready', version: 1,
      manifest: composition.runtimeManifest, stalePlan: false, teacherModules: {},
      compositionMetadata: withReadOnlyModuleHashes(composition.moduleMetadata),
      planLimitations: [], aiReview: null, generationAudit: [],
    };
    await act(async () => root.render(createElement(SmartCoursewareEditor, { initialEnvelope: envelope })));
    const text = [...container.querySelectorAll('textarea')]
      .find((textarea) => textarea.closest('[data-courseware-visual-editor]'))!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(text, '已保存但预览失败的内容');
      text.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const save = [...container.querySelectorAll('button')].find((button) => button.textContent === '保存所选内容')!;
    await act(async () => save.click());

    expect(container.textContent).toContain('组合已保存；学生预览暂时无法刷新');
    expect(container.textContent).toContain('已保存');
    expect(window.localStorage.getItem(
      `preparation-editor:courseware:draft-1:${step.id}:${selectedModule.id}`,
    )).toBeNull();
  });

  it('edits nested table rows through the visual editor', async () => {
    const composition = validCompositionInput();
    const tableModule = composition.runtimeManifest.stages[0].steps[0].modules[0];
    tableModule.canonicalClass = 'content.table';
    tableModule.payload = { columns: ['参数', '数值'], rows: [['增益', '1']] };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) } as Response)));
    const envelope: SmartCoursewareTeacherEnvelope = {
      draftId: 'draft-1', planRevisionId: 'plan-1', state: 'ready', version: 1,
      manifest: composition.runtimeManifest, stalePlan: false, teacherModules: {},
      compositionMetadata: withReadOnlyModuleHashes(composition.moduleMetadata),
      planLimitations: [], aiReview: null, generationAudit: [],
    };
    await act(async () => root.render(createElement(SmartCoursewareEditor, { initialEnvelope: envelope })));
    const cell = container.querySelector<HTMLInputElement>('input[aria-label="rows 第1行第2列"]')!;
    expect(cell.value).toBe('1');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(cell, '2');
      cell.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const local = JSON.parse(window.localStorage.getItem(
      `preparation-editor:courseware:draft-1:${composition.runtimeManifest.stages[0].steps[0].id}:${tableModule.id}`,
    )!);
    expect(local.payload.rows).toEqual([['增益', '2']]);
  });

  it('edits formula table cells without flattening their math structure', async () => {
    const composition = validCompositionInput();
    const tableModule = composition.runtimeManifest.stages[0].steps[0].modules[0];
    tableModule.canonicalClass = 'content.table';
    tableModule.payload = { columns: ['参数', '公式'], rows: [['增益', { kind: 'math', value: 'K_p' }]] };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) } as Response)));
    const envelope: SmartCoursewareTeacherEnvelope = {
      draftId: 'draft-1', planRevisionId: 'plan-1', state: 'ready', version: 1,
      manifest: composition.runtimeManifest, stalePlan: false, teacherModules: {},
      compositionMetadata: withReadOnlyModuleHashes(composition.moduleMetadata),
      planLimitations: [], aiReview: null, generationAudit: [],
    };
    await act(async () => root.render(createElement(SmartCoursewareEditor, { initialEnvelope: envelope })));
    const cell = container.querySelector<HTMLInputElement>('input[aria-label="rows 第1行第2列"]')!;
    expect(cell.dataset.tableCellKind).toBe('math');
    expect(cell.value).toBe('K_p');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(cell, 'K_p + K_i/s');
      cell.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const local = JSON.parse(window.localStorage.getItem(
      `preparation-editor:courseware:draft-1:${composition.runtimeManifest.stages[0].steps[0].id}:${tableModule.id}`,
    )!);
    expect(local.payload.rows).toEqual([['增益', { kind: 'math', value: 'K_p + K_i/s' }]]);
  });

  it('persists ignored courseware AI findings for the current revision', async () => {
    const composition = validCompositionInput();
    const suggestionKey = 'preparation-editor:courseware:draft-1:1:suggestions';
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) } as Response)));
    const envelope: SmartCoursewareTeacherEnvelope = {
      draftId: 'draft-1', planRevisionId: 'plan-1', state: 'ready', version: 1,
      manifest: composition.runtimeManifest, stalePlan: false, teacherModules: {},
      compositionMetadata: withReadOnlyModuleHashes(composition.moduleMetadata),
      planLimitations: [],
      aiReview: {
        findings: [{ category: 'structure', severity: 'warning', message: '补充课堂小结', path: 'stages.0' }],
        suggestions: [],
      },
      generationAudit: [],
    };
    await act(async () => root.render(createElement(SmartCoursewareEditor, { initialEnvelope: envelope })));
    const finding = [...container.querySelectorAll('article')]
      .find((article) => article.textContent?.includes('补充课堂小结'))!;
    expect(finding.textContent).toContain('该建议未包含可应用的修改');
    const ignore = [...finding.querySelectorAll('button')].find((button) => button.textContent === '忽略')!;
    await act(async () => ignore.click());

    expect(finding.textContent).toContain('已忽略');
    expect(JSON.parse(window.localStorage.getItem(suggestionKey)!)).toEqual({ 'finding:0': 'ignored' });
  });

  it('rejects forged accepted state for courseware suggestions without replacements', async () => {
    const composition = validCompositionInput();
    window.localStorage.setItem(
      'preparation-editor:courseware:draft-1:1:suggestions',
      JSON.stringify({ 'finding:0': 'accepted' }),
    );
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) } as Response)));
    const envelope: SmartCoursewareTeacherEnvelope = {
      draftId: 'draft-1', planRevisionId: 'plan-1', state: 'ready', version: 1,
      manifest: composition.runtimeManifest, stalePlan: false, teacherModules: {},
      compositionMetadata: withReadOnlyModuleHashes(composition.moduleMetadata),
      planLimitations: [],
      aiReview: {
        findings: [{ category: 'structure', severity: 'warning', message: '不可伪造接受', path: 'stages.0' }],
        suggestions: [],
      },
      generationAudit: [],
    };
    await act(async () => root.render(createElement(SmartCoursewareEditor, { initialEnvelope: envelope })));
    const finding = [...container.querySelectorAll('article')]
      .find((article) => article.textContent?.includes('不可伪造接受'))!;

    expect(finding.textContent).not.toContain('已接受');
    expect(finding.textContent).toContain('该建议未包含可应用的修改');
    expect([...finding.querySelectorAll('button')].some((button) => button.textContent === '忽略')).toBe(true);
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

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@/components/providers/theme-provider';
import { FEATURED_LESSONS, INTERACTIVE_COURSE_MODULES, PREMIUM_LESSONS } from '@/features/interactive/learning-catalog';
import { ALL_PRESETS } from '@/features/teacher/preset-lessons/presets';
import { resolveSessionRouteFromPlanTitle } from '@/lib/classroom-session-route';
import { COURSE_AI_CONTEXT_REGISTRY, getStepQuickQuestions } from '@/lib/course-ai-contexts';
import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import { resolveInteractiveLessonIdentity } from '@/lib/interactive-lesson-identity';
import {
  createUNIT_1_4AIContext,
  getUNIT_1_4RequiredResponseKeys,
} from '@/lib/unit-1-4-ai-contexts';
import {
  buildUNIT_1_4ParameterSnapshots,
  isUNIT_1_4StudentState,
  isUNIT_1_4TeacherSyncState,
  UNIT_1_4_COURSE_TITLE,
  UNIT_1_4_LESSON_STEPS,
  UNIT_1_4_PRESET_KEY,
  UNIT_1_4_RESOURCE_KEY,
  UNIT_1_4_ROUTE_SEGMENT,
} from '@/lib/unit-1-4-course';
import { UNIT_1_4_TIME_FREQUENCY_VIEWS_PRESET as PUBLIC_UNIT_1_4_PRESET } from '@/features/teacher/preset-lessons';
import { buildCourseEntryLoginHref, isJoinAuthenticationFailure } from '@/features/interactive/shared/course-entry-shell';
import { commitConfirmedState, persistCourseStateUpdate } from '@/features/interactive/shared/confirmed-state';

const mockedControlEngineState = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@/resources/control-system/analysis/use-control-engine', () => ({
  useControlEngine: () => mockedControlEngineState.current,
}));

const repoRoot = process.cwd();
const manifestPath = join(repoRoot, 'course-content/runtime/lessons/1-4/interactive-manifest.json');
const graphOverlayPath = join(repoRoot, 'course-content/runtime/lessons/1-4/graph-overlay.json');
const runtimeShellPath = join(repoRoot, 'src/features/interactive/shared/lesson-runtime-shell.tsx');
const studentPagePath = join(repoRoot, 'src/features/interactive/unit-1-4-time-frequency-views/student-page.tsx');
const teacherPagePath = join(repoRoot, 'src/features/interactive/unit-1-4-time-frequency-views/teacher-page.tsx');
const teacherRoutePath = join(repoRoot, 'src/features/interactive/shared/batch-a-classroom-pages.tsx');
const bopppsPath = join(repoRoot, 'course-content/authoring/lessons/1-4/design/1-4-boppps.md');

function readManifest() {
  const manifest = normalizeInteractiveRuntimeManifest(JSON.parse(readFileSync(manifestPath, 'utf8')));
  if (!manifest) throw new Error('1-4 interactive manifest is invalid');
  return manifest;
}

describe('unit 1-4 time frequency views course', () => {
  it('gives the previous and next page controls accessible names', () => {
    const source = readFileSync(runtimeShellPath, 'utf8');

    expect(source).toContain('上一页');
    expect(source).toContain('下一页');
  });

  it('commits teacher controls and student submissions only after persistence succeeds', async () => {
    const commit = vi.fn();
    await expect(commitConfirmedState({
      nextState: { open: true },
      persist: async () => { throw new Error('同步失败'); },
      commit,
    })).rejects.toThrow('同步失败');
    expect(commit).not.toHaveBeenCalled();

    await expect(persistCourseStateUpdate({
      currentState: { responses: {} as Record<string, string> },
      update: (current) => ({ responses: { ...current.responses, 'step-03': 'answer' } }),
      persist: async () => { throw new Error('保存失败'); },
    })).rejects.toThrow('保存失败');
  });

  it('builds a guest login recovery URL that preserves the course entry and classroom code', () => {
    expect(isJoinAuthenticationFailure(401)).toBe(true);
    expect(isJoinAuthenticationFailure(403)).toBe(true);
    expect(buildCourseEntryLoginHref('unit-1-4-time-frequency-views', '123456')).toBe(
      '/login?callbackUrl=%2Finteractive-learning%2Fcourses%2Funit-1-4-time-frequency-views%3Fcode%3D123456',
    );
  });

  it('exports the canonical route and complete 12-step runtime manifest', () => {
    const manifest = readManifest();

    expect(manifest.lessonId).toBe('1-4');
    expect(manifest.courseTitle).toBe('1-4：时域与频域——同一个系统的两种观察视角');
    expect(manifest.courseRouteSegment).toBe('unit-1-4-time-frequency-views');
    expect(manifest.steps.map((step) => step.id)).toEqual(
      Array.from({ length: 12 }, (_, index) => `step-${String(index + 1).padStart(2, '0')}`),
    );
  });

  it('keeps knowledge cards mapped to their intended runtime steps without duplicate groups', () => {
    const graphOverlay = JSON.parse(readFileSync(graphOverlayPath, 'utf8')) as {
      card_order: string[];
      groups: Array<{ step_ids: string[]; node_ids: string[] }>;
    };
    const expectedNodeIdsByStep: Record<string, string[]> = {
      'step-04': ['时域频域通道区分_1_4'],
      'step-05': ['时域响应_1_1'],
      'step-06': ['闭环带宽与环路穿越频率_1_4', '频域分析_2_2e257d89'],
      'step-07': ['Bode与Nyquist同源表征_1_4', '开环幅相特性曲线_5_fd86e289'],
      'step-08': ['多表征一致性读图_1_4'],
      'step-12': ['多表征一致性读图_1_4'],
    };

    for (const [stepId, expectedNodeIds] of Object.entries(expectedNodeIdsByStep)) {
      const matchingGroups = graphOverlay.groups.filter((group) => group.step_ids.includes(stepId));
      expect(matchingGroups, stepId).toHaveLength(1);
      expect(matchingGroups[0]?.node_ids, stepId).toEqual(expectedNodeIds);
    }

    expect(graphOverlay.card_order).toEqual([
      '时域响应_1_1',
      '时域频域通道区分_1_4',
      '闭环带宽与环路穿越频率_1_4',
      '频域分析_2_2e257d89',
      'Bode与Nyquist同源表征_1_4',
      '开环幅相特性曲线_5_fd86e289',
      '多表征一致性读图_1_4',
    ]);
  });

  it('uses shared native capabilities for steps 5, 6, 7, 8, and 10', () => {
    const manifest = readManifest();
    const computeModules = (stepId: string) => manifest.steps
      .find((step) => step.id === stepId)
      ?.modules.filter((module) => module.kind === 'compute.panel') ?? [];

    expect(computeModules('step-05').map((module) => module.payload.capabilityRef)).toContain('control-linked-comparison');
    expect(computeModules('step-06').map((module) => module.payload.capabilityRef)).toEqual([
      'control-frequency-reading-workbench',
      'control-frequency-reading-workbench',
    ]);
    expect(computeModules('step-07').map((module) => module.payload.capabilityRef)).toContain('control-frequency-reading-workbench');
    expect(computeModules('step-08').map((module) => module.payload.capabilityRef)).toContain('control-workbench');
    expect(computeModules('step-10').map((module) => module.payload.capabilityRef)).toEqual([
      'control-linked-comparison',
      'control-frequency-reading-workbench',
    ]);

    for (const stepId of ['step-06', 'step-07', 'step-10']) {
      const frequencyModules = computeModules(stepId).filter(
        (module) => module.payload.capabilityRef === 'control-frequency-reading-workbench',
      );
      expect(frequencyModules.length, stepId).toBeGreaterThan(0);
      expect(frequencyModules.every((module) => {
        const fields = Array.isArray(module.payload.submissionFields)
          ? module.payload.submissionFields as Array<Record<string, unknown>>
          : [];
        return fields.some((field) => field.key === module.payload.focusFrequencyField);
      }), stepId).toBe(true);
    }
  });

  it('hides step-response performance meta only when the runtime manifest requests it', async () => {
    const manifest = readManifest();
    const result = {
      metrics: {
        overshootPct: 12.5,
        riseTimeSec: 1.25,
        settlingTimeSec: 4.5,
        peakTimeSec: 2.25,
        finalValue: 1,
        phaseMarginDeg: 48,
        gainMarginDb: 12,
        gainCrossoverRadPerSec: 2,
        phaseCrossoverRadPerSec: 8,
        bandwidthRadPerSec: 1.5,
      },
      stepResponse: { points: [{ x: 0, y: 0 }, { x: 1, y: 1.125 }, { x: 5, y: 1 }] },
      magnitude: { points: [{ x: 0.1, y: 0 }, { x: 10, y: -20 }] },
      phase: { points: [{ x: 0.1, y: -5 }, { x: 10, y: -120 }] },
      nyquist: { points: [{ re: 1, im: 0 }, { re: 0, im: -0.2 }] },
      frequencyReadings: [{
        frequencyRadPerSec: 2,
        re: -0.05,
        im: -0.1,
        magnitudeDb: -19.031,
        phaseDeg: -116.565,
      }],
      rootLocus: {
        branches: [[{ re: -2, im: 2, gain: 8 }]],
        currentPoles: [{ re: -2, im: 2 }, { re: -2, im: -2 }],
        openLoopPoles: [{ re: 0, im: 0 }, { re: -4, im: 0 }],
        openLoopZeros: [],
      },
    };
    mockedControlEngineState.current = {
      result,
      error: null,
      isLoading: false,
      isFallback: false,
    };
    const { UNIT_1_4StepContentPanel } = await import(
      '@/features/interactive/unit-1-4-time-frequency-views/step-panels'
    );
    const renderStep = (stepId: string, showFrequencyReadings = true) => renderToStaticMarkup(createElement(
      ThemeProvider,
      null,
      createElement(UNIT_1_4StepContentPanel, {
        step: UNIT_1_4_LESSON_STEPS.find((step) => step.id === stepId)!,
        manifest,
        showFrequencyReadings,
      }),
    ));

    const defaultMarkup = renderStep('step-05');
    const hiddenMarkup = renderStep('step-10');
    const hiddenFrequencyMarkup = renderStep('step-07', false);
    const revealedFrequencyMarkup = renderStep('step-07', true);
    const step10Panel = manifest.steps
      .find((step) => step.id === 'step-10')
      ?.modules.find((module) => module.id === 'pole-step-workbench');

    expect(step10Panel?.payload.hidePerformanceMetricsMeta).toBe(true);
    expect(defaultMarkup).toContain('Mp 12.50%');
    expect(defaultMarkup).toContain('tr 1.25 s');
    expect(hiddenMarkup).toContain('data-control-workbench-panel="step-response"');
    expect(hiddenMarkup).toContain('aria-label="时域响应"');
    expect(hiddenMarkup).not.toContain('Mp 12.50%');
    expect(hiddenMarkup).not.toContain('tr 1.25 s');
    expect(hiddenMarkup).not.toContain('ts 4.50 s');
    expect(hiddenMarkup).not.toContain('tp 2.25 s');
    expect(hiddenFrequencyMarkup).not.toContain('data-control-workbench-frequency-readings="exact"');
    expect(hiddenFrequencyMarkup).not.toContain('-19.03');
    expect(revealedFrequencyMarkup).toContain('data-control-workbench-frequency-readings="exact"');
    expect(revealedFrequencyMarkup).toContain('-19.03');
  });

  it('uses a unique response contract for every compute panel in multi-panel steps', () => {
    const manifest = readManifest();

    for (const stepId of ['step-06', 'step-10']) {
      const responseContractIds = manifest.steps
        .find((step) => step.id === stepId)
        ?.modules
        .filter((module) => module.kind === 'compute.panel')
        .map((module) => module.payload.responseContractId);

      expect(responseContractIds?.every((value) => typeof value === 'string' && value.length > 0), stepId).toBe(true);
      expect(new Set(responseContractIds).size, stepId).toBe(responseContractIds?.length);
    }
  });

  it('does not prefill observation answers or expose step 5-7 and 10 reference blocks', () => {
    const manifest = readManifest();
    const neutralDefaultFields: Record<string, Set<string>> = {
      'step-05': new Set(['k']),
      'step-06': new Set(),
      'step-07': new Set(['focus_frequency_rad_s']),
      'step-10': new Set(['gain_k', 'focus_frequency_rad_s']),
    };

    for (const stepId of ['step-05', 'step-06', 'step-07', 'step-10']) {
      const step = manifest.steps.find((item) => item.id === stepId);
      const computeModules = step?.modules.filter((module) => module.kind === 'compute.panel') ?? [];
      const fields = computeModules.flatMap((module) => (
        Array.isArray(module.payload.submissionFields) ? module.payload.submissionFields : []
      )) as Array<Record<string, unknown>>;

      for (const field of fields) {
        if (neutralDefaultFields[stepId]?.has(String(field.key))) continue;
        expect(field, `${stepId}:${String(field.key)}`).not.toHaveProperty('defaultValue');
      }
    }

    const step5 = manifest.steps.find((step) => step.id === 'step-05');
    const step7 = manifest.steps.find((step) => step.id === 'step-07');
    const step10 = manifest.steps.find((step) => step.id === 'step-10');
    const step10PoleStep = step10?.modules.find((module) => module.id === 'pole-step-workbench');
    const step12 = manifest.steps.find((step) => step.id === 'step-12');
    const step12Summary = step12?.modules.find((module) => module.id === 'lesson-summary');
    expect(step5?.modules.map((module) => module.id)).not.toContain('reference-table');
    expect(step7?.modules.find((module) => module.id === 'bode-nyquist-workbench')?.payload.submissionFields)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          key: 'focus_frequency_rad_s',
          input: 'slider',
          min: 0.05,
          max: 30,
          defaultValue: 2,
        }),
      ]));
    expect(step7?.contentBlocks.conclusion).not.toMatchObject({ body: expect.stringContaining('-19.031') });
    expect(step10?.modules.map((module) => module.id)).not.toEqual(expect.arrayContaining(['reference-values', 'conclusion']));
    expect(step10PoleStep?.payload.visiblePanelIds).toEqual(['root-locus', 'step-response']);
    expect(step10PoleStep?.payload.visiblePanelIds).not.toContain('performance');
    expect(manifest.steps.flatMap((step) => step.telemetrySpec.summaryFields)).not.toContain('frequencyCursorMoves');
    expect(step12Summary?.kind).toBe('content.rich');
    expect(step12?.modules.map((module) => module.kind)).not.toContain('analytics.summary');
    expect(step12?.contentBlocks['lesson-summary']).toMatchObject({
      items: expect.arrayContaining([
        expect.stringContaining('课堂活动记录'),
        expect.stringContaining('实际提交分布'),
      ]),
    });
  });

  it('uses only runtime-standard teacher control modes', () => {
    const manifest = readManifest();
    const allowedModes = new Set(['not_applicable', 'page_load_open', 'teacher_toggle', 'teacher_only', 'teacher_direct']);

    for (const step of manifest.steps) {
      expect(Object.values(step.teacherControls).every((mode) => allowedModes.has(mode)), step.id).toBe(true);
    }
  });

  it('extracts structured panel answers into top-level parameter snapshots', () => {
    const parameterSnapshots = buildUNIT_1_4ParameterSnapshots({
      answers: {
        'step-07.frequency-reading.parameter.set': JSON.stringify({
          payload: {
            parameterSnapshot: {
              focus_frequency_rad_s: 2,
              magnitude_db: -19.1,
              phase_deg: -116.5,
              nyquist_quadrant: '第三象限',
            },
          },
        }),
      },
      submitFields: ['focus_frequency_rad_s', 'magnitude_db', 'phase_deg', 'nyquist_quadrant'],
    });

    expect(parameterSnapshots).toEqual({
      focus_frequency_rad_s: 2,
      magnitude_db: -19.1,
      phase_deg: -116.5,
      nyquist_quadrant: '第三象限',
    });
  });

  it('gates answer checking for every response-producing step by confirmed required responses', () => {
    const manifest = readManifest();
    const step10 = manifest.steps.find((step) => step.id === 'step-10')!;
    const requiredStep10Keys = getUNIT_1_4RequiredResponseKeys(step10);
    const partialAnswers = { [requiredStep10Keys[0]]: 'first panel' };
    const completeAnswers = Object.fromEntries(requiredStep10Keys.map((key) => [key, `answer:${key}`]));

    for (const stepId of ['step-04', 'step-05', 'step-06', 'step-07', 'step-08', 'step-09', 'step-10', 'step-11']) {
      const step = manifest.steps.find((item) => item.id === stepId)!;
      const requiredKeys = getUNIT_1_4RequiredResponseKeys(step);
      expect(requiredKeys.length, stepId).toBeGreaterThan(0);
      expect(createUNIT_1_4AIContext(step, { answers: {}, answerVisible: false }).tools, stepId)
        .not.toContain('check_answer');
    }

    const unsubmitted = createUNIT_1_4AIContext(step10, { answers: {}, answerVisible: false });
    const partial = createUNIT_1_4AIContext(step10, { answers: partialAnswers, answerVisible: false });
    const complete = createUNIT_1_4AIContext(step10, { answers: completeAnswers, answerVisible: false });
    const teacherRevealed = createUNIT_1_4AIContext(step10, { answers: {}, answerVisible: true });
    const display = createUNIT_1_4AIContext(manifest.steps.find((step) => step.id === 'step-02')!, {
      answers: {},
      answerVisible: false,
    });

    expect(unsubmitted.tools).not.toContain('check_answer');
    expect(unsubmitted.systemPromptExtension).not.toContain('已经提交');
    expect(partial.tools).not.toContain('check_answer');
    expect(partial.systemPromptExtension).toContain('部分');
    expect(partial.systemPromptExtension).not.toContain('已经提交');
    expect(complete.tools).toContain('check_answer');
    expect(complete.systemPromptExtension).toContain('全部确认提交');
    expect(teacherRevealed.tools).toContain('check_answer');
    expect(display.tools).toContain('check_answer');
  });

  it('merges queued panel responses from confirmed previous state and attributes evidence to the current response', () => {
    const source = readFileSync(studentPagePath, 'utf8');

    expect(source).toContain('const previousResponse = prev.responses[targetStepId]');
    expect(source).toContain('answers: { ...(previousResponse?.answers ?? {}), ...response.answers }');
    expect(source).toContain('confirmation.previousState.responses[targetStepId]');
    expect(source).toContain('firstStructuredAnswer(response.answers)');
    expect(source).toContain('answers: response.answers');
    expect(source).not.toContain('firstStructuredAnswer(answers)');
    expect(source).toContain('controlWorkbenchEvidenceDraft: structuredAnswer');
    expect(source).toContain('dataOverrides:');
    expect(source).toContain('throw requestError');
    expect(source).toContain('handleSubmitResponse(failedSubmission).catch(() => undefined)');
    expect(source).toContain('await submitManifestStepResponse({');
    expect(source).toContain('onPanelSubmit={released ? handleSubmitResponse : undefined}');
    expect(source).not.toContain('void handleSubmitResponse(response).catch(() => undefined)');
    expect(source).toContain('onSubmit={handleSubmitResponse}');
  });

  it('keeps the current control workbench panel draft at top level when persisted answers include history', () => {
    const historicalDraft = { schemaVersion: 'control-workbench-evidence-v1', moduleId: 'historical-panel' };
    const currentDraft = { schemaVersion: 'control-workbench-evidence-v1', moduleId: 'current-panel' };
    const persistedAnswers = {
      'historical.contract': JSON.stringify(historicalDraft),
      'current.contract': JSON.stringify(currentDraft),
    };
    const currentAnswers = { 'current.contract': JSON.stringify(currentDraft) };
    const source = readFileSync(studentPagePath, 'utf8');

    expect(Object.values(persistedAnswers).map((value) => JSON.parse(value).moduleId)).toEqual([
      'historical-panel',
      'current-panel',
    ]);
    expect(JSON.parse(Object.values(currentAnswers)[0]!).moduleId).toBe('current-panel');
    expect(source).toContain('const structuredAnswer = firstStructuredAnswer(response.answers)');
    expect(source).toContain('isControlWorkbenchEvidenceDraft(structuredAnswer)');
    expect(source).toContain('controlWorkbenchEvidenceDraft: structuredAnswer');
  });

  it('matches the runtime teacher handout timing and totals 90 minutes', () => {
    const source = readFileSync(bopppsPath, 'utf8');

    expect(source).toContain('## B｜Bridge-in 场景导入（6min）');
    expect(source).toContain('## O｜Objective 课程目标（4min）');
    expect(source).toContain('## P₁｜Pre-assessment 前测（6min）');
    expect(source).toContain('## P₂｜Participatory Learning 参与式学习（66min）');
    expect(source).toContain('## P₃｜Post-assessment 后测（5min）');
    expect(source).toContain('## S｜Summary 总结（3min）');
    expect(source.match(/### 活动[^\n]+（(?:8|10)min）/g)?.map((heading) => heading.match(/（(\d+)min）/)?.[1])).toEqual([
      '8', '10', '10', '10', '10', '10', '8',
    ]);
    expect(source).toContain('时间总计：$6+4+6+66+5+3=90$ min。');
  });

  it('rejects incomplete student and teacher state payloads', () => {
    expect(isUNIT_1_4StudentState({ kind: 'unit14_student_state', version: 1 })).toBe(false);
    expect(isUNIT_1_4StudentState({
      kind: 'unit14_student_state',
      version: 1,
      studentName: '学生甲',
      updatedAt: 1,
      responses: {},
      viewedStepIds: ['step-01'],
    })).toBe(true);

    expect(isUNIT_1_4TeacherSyncState({ kind: 'teacher_sync_unit14', activeStepId: 'step-99' })).toBe(false);
    expect(isUNIT_1_4TeacherSyncState({
      kind: 'teacher_sync_unit14',
      activeStepId: 'step-01',
      revealedAnswers: {},
      releasedActivities: {},
      browseEnabled: {},
      teacherRevealProgress: {},
      updatedAt: 1,
    })).toBe(true);
  });

  it('uses persisted-record semantics and renders a finished teacher session as terminal', () => {
    const source = readFileSync(teacherPagePath, 'utf8');

    expect(source).toContain("sessionInfo?.status === 'FINISHED'");
    expect(source).toContain('持久化学习记录学生数');
    expect(source).toContain('已提交页面记录数');
    expect(source).toContain("record.user?.name?.trim() || '匿名学生'");
    expect(source).not.toContain('record.data.studentName ||');
    expect(source).toContain('已有学习记录学生');
    expect(source).not.toContain('当前在线学生');
    expect(source).toContain('aria-expanded={showStudentList}');
    expect(source.indexOf("sessionInfo?.status === 'FINISHED'")).toBeLessThan(source.indexOf('<LessonRuntimeShell'));
  });

  it('preserves the complete teacher session path when redirecting to login', () => {
    const teacherRoute = readFileSync(teacherRoutePath, 'utf8');

    expect(teacherRoute).toContain('buildLoginRedirectForPath');
    expect(teacherRoute).toContain('`/interactive-learning/courses/${input.routeSegment}/teacher/${input.sessionId}`');
    expect(teacherRoute).toContain('`/interactive-learning/courses/${input.routeSegment}/teacher/${input.sessionId}/waiting`');
    expect(teacherRoute).not.toContain("redirect('/login')");
  });

  it('binds every knowledge-card group to valid interactive steps', () => {
    const overlay = JSON.parse(readFileSync(graphOverlayPath, 'utf8')) as {
      groups: Array<{ step_ids?: string[]; node_ids: string[] }>;
    };
    const validStepIds = new Set(UNIT_1_4_LESSON_STEPS.map((step) => step.id));

    expect(overlay.groups.length).toBeGreaterThan(0);
    for (const group of overlay.groups) {
      expect(group.step_ids?.length).toBeGreaterThan(0);
      expect(group.step_ids?.every((stepId) => validStepIds.has(stepId))).toBe(true);
      expect(group.node_ids.length).toBeGreaterThan(0);
    }
  });

  it('registers catalog, preset, AI, identity, and classroom session routing', () => {
    const module1 = INTERACTIVE_COURSE_MODULES.find((module) => module.id === 'module-1');

    expect(UNIT_1_4_ROUTE_SEGMENT).toBe('unit-1-4-time-frequency-views');
    expect(UNIT_1_4_PRESET_KEY).toBe('unit-1-4-time-frequency-views-v1');
    expect(UNIT_1_4_RESOURCE_KEY).toBe(UNIT_1_4_ROUTE_SEGMENT);
    expect(UNIT_1_4_COURSE_TITLE).toBe('1-4：时域与频域——同一个系统的两种观察视角');
    expect(UNIT_1_4_LESSON_STEPS).toHaveLength(12);
    expect(FEATURED_LESSONS.map((lesson) => lesson.id)).toContain(UNIT_1_4_RESOURCE_KEY);
    expect(PREMIUM_LESSONS.map((lesson) => lesson.id)).toContain(UNIT_1_4_RESOURCE_KEY);
    expect(module1?.lessons.map((lesson) => lesson.id)).toContain(UNIT_1_4_RESOURCE_KEY);
    expect(ALL_PRESETS.some((preset) => preset.key === UNIT_1_4_PRESET_KEY)).toBe(true);
    expect(PUBLIC_UNIT_1_4_PRESET.key).toBe(UNIT_1_4_PRESET_KEY);
    expect(COURSE_AI_CONTEXT_REGISTRY[UNIT_1_4_PRESET_KEY]).toBeDefined();
    expect(getStepQuickQuestions(UNIT_1_4_PRESET_KEY, 'step-07')).toHaveLength(2);
    expect(resolveInteractiveLessonIdentity({ kind: 'routeSegment', value: UNIT_1_4_ROUTE_SEGMENT }).status)
      .toBe('resolved');
    expect(resolveSessionRouteFromPlanTitle(UNIT_1_4_COURSE_TITLE)).toEqual({
      routeSegment: UNIT_1_4_ROUTE_SEGMENT,
      isPremiumCourse: true,
    });
  });

  it('provides entry, teacher, student, and waiting routes', () => {
    const routeRoot = join(repoRoot, 'src/features/interactive/course-app-routes', UNIT_1_4_ROUTE_SEGMENT);

    expect(existsSync(join(repoRoot, 'src/features/interactive/shared/batch-a-classroom-pages.tsx'))).toBe(true);
    expect(existsSync(join(routeRoot, 'entry.tsx'))).toBe(false);
    expect(existsSync(join(routeRoot, 'teacher.tsx'))).toBe(false);
    expect(existsSync(join(routeRoot, 'waiting.tsx'))).toBe(false);
    expect(existsSync(join(routeRoot, 'student.tsx'))).toBe(false);
  });
});

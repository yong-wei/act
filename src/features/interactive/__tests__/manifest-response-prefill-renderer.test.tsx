import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  createManifestStudentActivityRegistry,
  renderStudentInteractiveActivity,
} from '@/features/interactive/shared/manifest-runtime/activity-renderers';
import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';

describe('manifest activity workspace response prefill renderer', () => {
  it('renders the generic table shape and fills exact validated history without treating it as submitted', () => {
    const manifest = normalizeInteractiveRuntimeManifest(JSON.parse(readFileSync(
      join(process.cwd(), 'course-content/runtime/lessons/1-5/interactive-manifest.json'),
      'utf8',
    )))!;
    const step = manifest.steps.find((item) => item.id === 'step-09')!;
    const history = {
      'step-05': {
        stepId: 'step-05',
        submittedAt: 100,
        answers: {
          evidence: JSON.stringify({
            schemaVersion: 'control-workbench-evidence-v1',
            payload: {
              parameterSnapshot: { k: 3 },
              answerPayload: {
                validationSnapshot: {
                  validationStatus: 'validated',
                  dominantPoles: '-0.45+j0.54',
                  overshootPercent: 7.05,
                  riseTime10To90Seconds: 2.1,
                  settlingTime5PercentSeconds: 7.38,
                  gainCrossoverRadPerSec: 0.454,
                  phaseMarginDeg: 61.26,
                  gainMarginDb: 22.92,
                  derivedSystemState: '稳定',
                },
              },
            },
          }),
        },
      },
    };

    const html = renderToStaticMarkup(renderStudentInteractiveActivity({
      registry: createManifestStudentActivityRegistry(),
      step: { id: step.id },
      stepManifest: step,
      responseHistory: history,
      released: true,
      browseEnabled: true,
      answerVisible: false,
      revealProgress: 0,
      onSubmit: () => undefined,
    }));

    expect(html).toContain('aria-label="k3 主导极点"');
    expect(html).toContain('value="-0.45+j0.54"');
    expect(html).toContain('aria-label="k42 系统状态"');
    expect(html).toContain('独立提交本卡');
    expect(html).not.toContain('已提交，可修改后重提');
  });

  it('preserves a saved student cell while filling the remaining empty cells from later evidence', () => {
    const manifest = normalizeInteractiveRuntimeManifest(JSON.parse(readFileSync(
      join(process.cwd(), 'course-content/runtime/lessons/1-5/interactive-manifest.json'),
      'utf8',
    )))!;
    const step = manifest.steps.find((item) => item.id === 'step-09')!;
    const savedResponse = {
      stepId: 'step-09',
      submittedAt: 90,
      answers: {
        'representative-gain-table': JSON.stringify({ rows: { k3: { phase_margin_deg: '学生修订值' } } }),
      },
    };
    const responseHistory = {
      'step-05': {
        stepId: 'step-05', submittedAt: 100, answers: { evidence: JSON.stringify({
          schemaVersion: 'control-workbench-evidence-v1',
          payload: { parameterSnapshot: { k: 3 }, answerPayload: { validationSnapshot: {
            validationStatus: 'validated', dominantPoles: '-0.45+j0.54', phaseMarginDeg: 61.26,
          } } },
        }) },
      },
    };
    const html = renderToStaticMarkup(renderStudentInteractiveActivity({
      registry: createManifestStudentActivityRegistry(),
      step: { id: step.id },
      stepManifest: step,
      savedResponse,
      responseHistory,
      released: true,
      browseEnabled: true,
      answerVisible: false,
      revealProgress: 0,
      onSubmit: () => undefined,
    }));
    expect(html).toContain('value="学生修订值"');
    expect(html).toContain('value="-0.45+j0.54"');
  });

  it('renders the step 12 migration table and its three supplemental conclusions', () => {
    const manifest = normalizeInteractiveRuntimeManifest(JSON.parse(readFileSync(
      join(process.cwd(), 'course-content/runtime/lessons/1-5/interactive-manifest.json'),
      'utf8',
    )))!;
    const step = manifest.steps.find((item) => item.id === 'step-12')!;
    const html = renderToStaticMarkup(renderStudentInteractiveActivity({
      registry: createManifestStudentActivityRegistry(),
      step: { id: step.id },
      stepManifest: step,
      released: true,
      browseEnabled: true,
      answerVisible: false,
      revealProgress: 0,
      onSubmit: () => undefined,
    }));
    expect(html).toContain('aria-label="k70 系统状态"');
    expect(html).toContain('aria-label="稳定区间"');
    expect(html).toContain('aria-label="临界增益"');
    expect(html).toContain('aria-label="跨对象比较"');
    expect(html).toContain('data-table-supplemental-fields="3"');
  });
});

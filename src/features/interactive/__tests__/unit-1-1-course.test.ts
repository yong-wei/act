import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';

vi.mock('server-only', () => ({}));

const repoRoot = process.cwd();
const featureBase = join(repoRoot, 'src/features/interactive/unit-1-1-see-the-full-picture');
const manifestPath = join(repoRoot, 'course-content/runtime/lessons/1-1/interactive-manifest.json');

function readManifest() {
  const manifest = normalizeInteractiveRuntimeManifest(JSON.parse(readFileSync(manifestPath, 'utf8')));
  if (!manifest) throw new Error('1-1 interactive manifest is invalid');
  return manifest;
}

describe('unit 1-1 interactive course', () => {
  it('renders step 13 code from the runtime manifest through the standard content.code module', async () => {
    const manifest = readManifest();
    const courseModule = await import('@/lib/unit-1-1-course');
    const featureModule = await import('@/features/interactive/unit-1-1-see-the-full-picture/step-panels');
    const step = courseModule.UNIT_1_1_LESSON_STEPS.find((item: { id: string }) => item.id === 'step-13');

    const html = renderToStaticMarkup(
      createElement(featureModule.UNIT_1_1StepContentPanel, {
        step,
        manifest,
      }),
    );

    expect(html).toContain('data-module-kind="content.code"');
    expect(html).toContain('Kp2');
    expect(html).toContain('feedback');
    expect(html).not.toContain('Kp = 3');
    expect(html).not.toContain('Python');
  });

  it('keeps unit 1-1 pages wired to the runtime manifest instead of private hardcoded content', () => {
    const stepPanelsSource = readFileSync(join(featureBase, 'step-panels.tsx'), 'utf8');
    const studentPageSource = readFileSync(join(featureBase, 'student-page.tsx'), 'utf8');
    const teacherPageSource = readFileSync(join(featureBase, 'teacher-page.tsx'), 'utf8');

    expect(studentPageSource).toContain('manifest={runtimeManifest}');
    expect(teacherPageSource).toContain('manifest={lessonRuntime.interactiveManifest}');
    expect(stepPanelsSource).toContain('renderInteractiveManifestStep');
    expect(stepPanelsSource).toContain('createManifestContentModuleRegistry');
    expect(stepPanelsSource).not.toContain('Kp = 3');
    expect(stepPanelsSource).not.toContain('getStepBlueprint');
  });
});

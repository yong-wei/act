import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';

import {
  GENERATED_SLIDE_BROWSER_FONT_FAMILY,
  GENERATED_SLIDE_BROWSER_FONT_SHA256,
  GENERATED_SLIDE_BROWSER_FONT_VERSION,
  GENERATED_SLIDE_BROWSER_GLYPH_FONT_SIZE_PX,
  GENERATED_SLIDE_BROWSER_GLYPH_METRIC_PX,
  GENERATED_SLIDE_BROWSER_GLYPH_SAMPLE,
  GENERATED_SLIDE_BROWSER_VALIDATOR_VERSION,
  GENERATED_SLIDE_BROWSER_VERSION,
  GENERATED_SLIDE_BROWSER_VIEWPORT_VERSION,
  type GeneratedSlideBrowserElementMeasurement,
  type GeneratedSlideBrowserExpectation,
  type GeneratedSlideBrowserMeasurementSnapshot,
  type GeneratedSlideProjection,
  validateGeneratedSlideBrowserSnapshot,
} from '../src/features/interactive/shared/manifest-runtime/generated-slide-browser-validation';
import {
  buildGeneratedSlideBrowserExpectation,
  captureGeneratedSlideBrowserSnapshot,
  deriveGeneratedSlideStepRenderContract,
} from '../src/features/interactive/shared/manifest-runtime/generated-slide-browser-measurement';
import {
  GENERATED_SLIDE_LAYOUT_REGISTRY,
  computeGeneratedSlideContentHash,
} from '../src/features/interactive/shared/manifest-runtime/generated-slide-contract';
import {
  GENERATED_SLIDE_BROWSER_FIXTURE,
  GENERATED_SLIDE_BROWSER_FIXTURE_SECRET,
  GENERATED_SLIDE_BROWSER_FIXTURE_STEPS,
} from '../src/features/interactive/shared/manifest-runtime/generated-slide-browser-fixture';

const VIEWPORT = { width: 1280, height: 720 } as const;
const CANVAS_SELECTOR = '[data-generated-slide-canvas="browser-gate-step"]';
const SECRET = GENERATED_SLIDE_BROWSER_FIXTURE_SECRET;
const PINNED_FONT_ROOT = resolve(process.cwd(), 'node_modules/@fontsource-variable/noto-sans-sc');
const PINNED_FONT_CSS_SOURCE = readFileSync(resolve(PINNED_FONT_ROOT, 'index.css'), 'utf8');
const PINNED_FONT_FILES = [...PINNED_FONT_CSS_SOURCE.matchAll(/\.\/files\/([^')]+\.woff2)/g)]
  .map((match) => match[1])
  .sort();
const PINNED_FONT_HASH = createHash('sha256');
for (const fileName of PINNED_FONT_FILES) {
  const bytes = readFileSync(resolve(PINNED_FONT_ROOT, 'files', fileName));
  PINNED_FONT_HASH.update(fileName);
  PINNED_FONT_HASH.update(bytes);
}
const PINNED_FONT_SHA256 = `sha256:${PINNED_FONT_HASH.digest('hex')}`;

const generatedManifest = GENERATED_SLIDE_BROWSER_FIXTURE;
const generatedStep = generatedManifest.stages[0].steps[0];
const EXPECTED_CONTENT_HASH = computeGeneratedSlideContentHash(GENERATED_SLIDE_BROWSER_FIXTURE);

function buildExpectation(
  projection: GeneratedSlideProjection,
  stepId = generatedStep.id,
): GeneratedSlideBrowserExpectation {
  const step = GENERATED_SLIDE_BROWSER_FIXTURE_STEPS.find((candidate) => candidate.id === stepId);
  if (!step) throw new Error(`Missing generated fixture step ${stepId}.`);
  const layout = GENERATED_SLIDE_LAYOUT_REGISTRY[
    step.layoutId as keyof typeof GENERATED_SLIDE_LAYOUT_REGISTRY
  ];
  const contract = deriveGeneratedSlideStepRenderContract({ step, projection, revealProgress: 8 });
  return buildGeneratedSlideBrowserExpectation({
    contentHash: EXPECTED_CONTENT_HASH,
    slotIds: layout.slots.map((slot: { readonly id: string }) => slot.id),
    moduleIds: contract.moduleIds,
    formulaIds: contract.formulaIds,
    textIds: contract.textIds,
  });
}

async function installFixture(page: Page, projection: GeneratedSlideProjection, defectCss = '') {
  await page.setViewportSize(VIEWPORT);
  const response = await page.goto(`/review/generated-slide-runtime-938/${projection}`, { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBeLessThan(500);
  await expect(page.locator('[data-publication-review="ready"]')).toHaveCount(1);
  await page.addStyleTag({ content: `
      ${defectCss}
    ` });
  await page.evaluate(async () => {
    await document.fonts.load('16px "Noto Sans SC Variable"', '课件门禁闭环系统稳定性');
    await document.fonts.ready;
  });
}

async function captureSnapshot(
  page: Page,
  browser: Browser,
  projection: GeneratedSlideProjection,
  stepId = generatedStep.id,
): Promise<GeneratedSlideBrowserMeasurementSnapshot> {
  return captureGeneratedSlideBrowserSnapshot({ page, browser, projection, stepId });
}

async function validateFixture(
  page: Page,
  browser: Browser,
  projection: GeneratedSlideProjection,
  defectCss = '',
) {
  await installFixture(page, projection, defectCss);
  return validateGeneratedSlideBrowserSnapshot(
    await captureSnapshot(page, browser, projection),
    buildExpectation(projection),
  );
}

test.use({ viewport: VIEWPORT, deviceScaleFactor: 1 });

test('publication query waits for the exact internal revision before rendering a measurable canvas', async ({ page }) => {
  let releaseResponse!: () => void;
  const responseGate = new Promise<void>((resolveGate) => { releaseResponse = resolveGate; });
  let requestHeaders: Record<string, string> = {};
  await page.setExtraHTTPHeaders({
    'x-act-publication-review-secret': 'browser-review-secret',
    'x-act-publication-owner': 'teacher-1',
  });
  await page.route('**/api/internal/smart-courseware/publication-review?**', async (route) => {
    requestHeaders = route.request().headers();
    await responseGate;
    await route.fulfill({ json: {
      manifest: GENERATED_SLIDE_BROWSER_FIXTURE,
      manifestHash: 'sha256:loaded-immutable-review',
    } });
  });
  const response = await page.goto(
    '/review/generated-slide-runtime-938/student?sourceRevisionId=revision-1',
    { waitUntil: 'domcontentloaded' },
  );
  expect(response?.status()).toBeLessThan(500);
  await expect(page.locator('[data-publication-review="loading"]')).toHaveCount(1);
  await expect(page.locator('[data-generated-slide-canvas]')).toHaveCount(0);
  await expect(page.locator('[data-publication-manifest-hash]')).toHaveCount(0);
  releaseResponse();
  await expect(page.locator('[data-publication-review="ready"]')).toHaveCount(1);
  await expect(page.locator('[data-publication-manifest-hash="sha256:loaded-immutable-review"]')).toHaveCount(1);
  await expect(page.locator('[data-generated-slide-canvas]')).toHaveCount(GENERATED_SLIDE_BROWSER_FIXTURE_STEPS.length);
  expect(requestHeaders['x-act-publication-review-secret']).toBe('browser-review-secret');
  expect(requestHeaders['x-act-publication-owner']).toBe('teacher-1');
});

test('review route provides the pinned publication font without test CSS injection', async ({ page }) => {
  await installFixture(page, 'student');
  await expect(page.locator('[data-publication-review="ready"]')).toHaveCount(1);
  expect(await page.locator('[data-publication-review]').evaluate((element) => getComputedStyle(element).fontFamily))
    .toBe(GENERATED_SLIDE_BROWSER_FONT_FAMILY);
  expect(await page.evaluate(() => [...document.fonts].some((face) => face.status === 'loaded'
    && face.family.replace(/["']/g, '') === 'Noto Sans SC Variable'))).toBe(true);
});

test('teacher and student projections share manifest identity but isolate teacher-only DOM', async ({ page, browser }) => {
  expect(PINNED_FONT_SHA256).toBe(GENERATED_SLIDE_BROWSER_FONT_SHA256);
  await installFixture(page, 'student');
  await expect(page.getByText(SECRET)).toHaveCount(0);
  const student = validateGeneratedSlideBrowserSnapshot(
    await captureSnapshot(page, browser, 'student'),
    buildExpectation('student'),
  );

  await installFixture(page, 'teacher');
  await expect(page.getByText(SECRET)).toHaveCount(1);
  const teacher = validateGeneratedSlideBrowserSnapshot(
    await captureSnapshot(page, browser, 'teacher'),
    buildExpectation('teacher'),
  );

  expect(student.issues).toEqual([]);
  expect(teacher.issues).toEqual([]);
  expect(student.valid).toBe(true);
  expect(teacher.valid).toBe(true);
  expect(student.identity.contentHash).toBe(teacher.identity.contentHash);
  expect(student.identity.contentHash).toBe(EXPECTED_CONTENT_HASH);
});

for (const projection of ['student', 'teacher'] as const) {
  test(`${projection} projection passes the pinned browser measurement gate without concealing page growth`, async ({ page, browser }) => {
    await installFixture(page, projection);
    const snapshot = await captureSnapshot(page, browser, projection);
    const result = validateGeneratedSlideBrowserSnapshot(snapshot, buildExpectation(projection));
    const geometry = await page.evaluate(({ canvasSelector }) => {
      const canvas = document.querySelector(canvasSelector)?.getBoundingClientRect();
      const sibling = document.querySelector('[data-generated-slide-review-step="browser-gate-step-2"]')?.getBoundingClientRect();
      return {
        canvasBottom: canvas?.bottom,
        siblingTop: sibling?.top,
        bodyOverflow: getComputedStyle(document.body).overflow,
        pageHeight: document.documentElement.scrollHeight,
        viewportHeight: innerHeight,
      };
    }, { canvasSelector: CANVAS_SELECTOR });

    expect(result.issues, JSON.stringify({
      environment: snapshot.environment,
      overflows: [...snapshot.formulas, ...snapshot.containers]
        .filter((item) => item.scrollWidth > item.clientWidth + 1 || item.scrollHeight > item.clientHeight + 1)
        .map((item) => ({
          selector: item.selector,
          client: [item.clientWidth, item.clientHeight],
          scroll: [item.scrollWidth, item.scrollHeight],
        })),
      modules: snapshot.modules.map((item) => ({ id: item.moduleId, rect: item.rect })),
      text: snapshot.text.map((item) => ({ id: item.textId, rect: item.rect })),
    })).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.identity).toEqual(expect.objectContaining({
      contentHash: expect.stringMatching(/^sha256:/),
      browserVersion: expect.stringMatching(/^\d+\.\d+\.\d+\.\d+$/),
      projection,
    }));
    expect(geometry.siblingTop).toBeCloseTo(geometry.canvasBottom ?? -1, 4);
    expect(geometry.bodyOverflow).not.toBe('hidden');
    expect(geometry.pageHeight).toBeGreaterThan(geometry.viewportHeight);
  });
}

test('representative preset student demo route keeps the shared commercial manifest renderer', async ({ page }) => {
  const response = await page.goto(
    '/interactive-learning/courses/unit-4-7-destroyer-hifi-design-closure/student/demo',
    { waitUntil: 'domcontentloaded' },
  );

  expect(response?.status()).toBeLessThan(500);
  await expect(page.locator('[data-commercial-module-chrome]').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-generated-slide-contract], [data-generated-slide-step], [data-generated-slide-canvas]'))
    .toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Not found');
  await expect(page.locator('body')).not.toContainText('Application error');
});

test('all six generated content classes use the production registry and the full slide validator', async ({ page, browser }) => {
  await installFixture(page, 'teacher');
  await expect(page.locator('[data-manifest-render-error]')).toHaveCount(0);
  const evidence = await page.evaluate(() => {
    const classes = [...document.querySelectorAll('[data-generated-slide-module-class]')]
      .map((element) => element.getAttribute('data-generated-slide-module-class'));
    const violations: string[] = [];
    for (const step of document.querySelectorAll('[data-generated-slide-review-step]')) {
      const canvas = step.querySelector('[data-generated-slide-canvas]');
      if (!canvas) continue;
      const canvasRect = canvas.getBoundingClientRect();
      const candidates = [...canvas.querySelectorAll('*')].filter(
        (element): element is HTMLElement => element instanceof HTMLElement,
      );
      for (const element of candidates) {
        if (element.closest('.katex-mathml')) continue;
        const computed = getComputedStyle(element);
        if (computed.display === 'inline'
          && computed.overflowX === 'visible'
          && computed.overflowY === 'visible'
          && computed.clipPath === 'none'
          && computed.maskImage === 'none') continue;
        const rect = element.getBoundingClientRect();
        const escapedCanvas = rect.left < canvasRect.left - 1
          || rect.top < canvasRect.top - 1
          || rect.right > canvasRect.right + 1
          || rect.bottom > canvasRect.bottom + 1;
        const scrolled = element.scrollWidth > element.clientWidth + 6
          || element.scrollHeight > element.clientHeight + 6;
        const nativeFormControl = element.matches('button, input, textarea, select');
        const clipped = (!nativeFormControl && (
          ['hidden', 'clip'].includes(computed.overflowX)
          || ['hidden', 'clip'].includes(computed.overflowY)
        ))
          || (computed.clipPath !== 'none' && computed.clipPath !== '')
          || (computed.maskImage !== 'none' && computed.maskImage !== '');
        if (escapedCanvas || scrolled || clipped) {
          violations.push(`${step.getAttribute('data-generated-slide-review-step')}:${element.tagName}:${escapedCanvas}:${scrolled}:${clipped}`);
        }
      }
    }
    return { classes, violations };
  });

  expect(new Set(evidence.classes)).toEqual(new Set([
    'content.rich',
    'content.cardSet',
    'content.formula',
    'content.table',
    'content.code',
    'content.reveal',
    'activity.panel',
  ]));
  expect(evidence.violations).toEqual([]);
  for (const step of GENERATED_SLIDE_BROWSER_FIXTURE_STEPS) {
    const result = validateGeneratedSlideBrowserSnapshot(
      await captureSnapshot(page, browser, 'teacher', step.id),
      buildExpectation('teacher', step.id),
    );
    expect(result.issues, `${step.id}: ${JSON.stringify(result.issues)}`).toEqual([]);
    expect(result.valid).toBe(true);
  }
});

test('formula identities are module-scoped and projection-aware', async ({ page, browser }) => {
  await installFixture(page, 'student');
  const studentSnapshot = await captureSnapshot(page, browser, 'student', 'browser-gate-multi-formula');
  expect(studentSnapshot.formulas.map((formula) => formula.formulaId)).toEqual([
    'visible-formula:payload.formulas.0:formula.0',
  ]);
  expect(validateGeneratedSlideBrowserSnapshot(
    studentSnapshot,
    buildExpectation('student', 'browser-gate-multi-formula'),
  ).issues).toEqual([]);

  await installFixture(page, 'teacher');
  const teacherSnapshot = await captureSnapshot(page, browser, 'teacher', 'browser-gate-multi-formula');
  expect(teacherSnapshot.formulas.map((formula) => formula.formulaId)).toEqual([
    'visible-formula:payload.formulas.0:formula.0',
    'teacher-formula:payload.formulas.0:formula.0',
    'teacher-formula:payload.formulas.1:formula.0',
  ]);
  expect(validateGeneratedSlideBrowserSnapshot(
    teacherSnapshot,
    buildExpectation('teacher', 'browser-gate-multi-formula'),
  ).issues).toEqual([]);
});

test('table and reveal formulas enter the same identity and font-size gate', async ({ page, browser }) => {
  await installFixture(page, 'student');

  const tableSnapshot = await captureSnapshot(page, browser, 'student', 'browser-gate-step-4');
  expect(tableSnapshot.formulas.map((formula) => formula.formulaId)).toEqual([
    'browser-gate-module-4:payload.columns.1:formula.0',
    'browser-gate-module-4:payload.rows.0.1:formula.0',
  ]);
  expect(validateGeneratedSlideBrowserSnapshot(
    tableSnapshot,
    buildExpectation('student', 'browser-gate-step-4'),
  ).issues).toEqual([]);

  const revealCanvas = page.locator('[data-generated-slide-canvas="browser-gate-step-5"]');
  await revealCanvas.evaluate((element) => {
    window.scrollTo({
      left: window.scrollX,
      top: element.getBoundingClientRect().top + window.scrollY,
      behavior: 'instant',
    });
  });
  await revealCanvas.locator('.katex').first().evaluate((element) => {
    (element as HTMLElement).style.fontSize = '8px';
  });
  const revealSnapshot = await captureSnapshot(page, browser, 'student', 'browser-gate-step-5');
  expect(revealSnapshot.formulas.map((formula) => formula.formulaId)).toEqual([
    'browser-gate-module-5:payload.items.0.body:formula.0',
    'browser-gate-module-5:payload.items.0.formula:formula.0',
    'browser-gate-module-5:payload.items.1.formula:formula.0',
  ]);
  expect(validateGeneratedSlideBrowserSnapshot(
    revealSnapshot,
    buildExpectation('student', 'browser-gate-step-5'),
  ).issues).toContainEqual(expect.objectContaining({
    code: 'text.minimum-font-size',
    location: expect.objectContaining({ moduleId: 'browser-gate-module-5' }),
  }));
});

test('rejects removal of a text marker even when the visible node remains', async ({ page, browser }) => {
  await installFixture(page, 'student');
  await page.locator('[data-generated-slide-text-marker="student-activity:payload.options.1.label:text"]')
    .evaluate((element) => element.removeAttribute('data-generated-slide-text-marker'));
  const result = validateGeneratedSlideBrowserSnapshot(
    await captureSnapshot(page, browser, 'student'), buildExpectation('student'),
  );
  expect(result.issues).toContainEqual(expect.objectContaining({ code: 'text.missing' }));
});

test('rejects removal of expected visible text while its marker remains', async ({ page, browser }) => {
  await installFixture(page, 'student');
  await page.locator('[data-generated-slide-text-marker="student-activity:payload.options.1.label:text"]')
    .evaluate((element) => { element.textContent = ''; });
  const result = validateGeneratedSlideBrowserSnapshot(
    await captureSnapshot(page, browser, 'student'), buildExpectation('student'),
  );
  expect(result.issues).toContainEqual(expect.objectContaining({ code: 'text.missing' }));
});

test('rejects removal of an expected rendered formula node', async ({ page, browser }) => {
  await installFixture(page, 'student');
  await page.locator('.katex').first().evaluate((element) => element.remove());
  const result = validateGeneratedSlideBrowserSnapshot(
    await captureSnapshot(page, browser, 'student'),
    buildExpectation('student'),
  );
  expect(result.valid).toBe(false);
  expect(result.issues).toContainEqual(expect.objectContaining({ code: 'formula.missing' }));
});

test('rejects removal of a formula marker even when the KaTeX node remains', async ({ page, browser }) => {
  await installFixture(page, 'student');
  await page.locator('[data-generated-slide-formula-marker]').first()
    .evaluate((element) => element.removeAttribute('data-generated-slide-formula-marker'));
  const result = validateGeneratedSlideBrowserSnapshot(
    await captureSnapshot(page, browser, 'student'), buildExpectation('student'),
  );
  expect(result.issues).toContainEqual(expect.objectContaining({ code: 'formula.missing' }));
});

test('browser capture scrolls vertically without changing horizontal state', async ({ page, browser }) => {
  await installFixture(page, 'student');
  const before = await page.evaluate(() => {
    const spacer = document.createElement('div');
    spacer.style.width = '3000px';
    spacer.style.height = '1px';
    document.body.append(spacer);
    window.scrollTo({ left: 120, top: 0, behavior: 'instant' });
    return window.scrollX;
  });
  await captureSnapshot(page, browser, 'student', 'browser-gate-step-4');
  expect(await page.evaluate(() => window.scrollX)).toBe(before);
});

test('rejects a rendered manifest identity that differs from the independent expectation', async ({ page, browser }) => {
  await installFixture(page, 'student');
  await page.locator(CANVAS_SELECTOR).evaluate((canvas) => {
    canvas.setAttribute('data-generated-slide-content-hash', 'sha256:changed-page-manifest');
  });

  const result = validateGeneratedSlideBrowserSnapshot(
    await captureSnapshot(page, browser, 'student'),
    buildExpectation('student'),
  );

  expect(result.valid).toBe(false);
  expect(result.issues.map((issue) => issue.code)).toContain('identity.content-hash');
});

const defectCases: Array<{ name: string; css: string; code: string }> = [
  { name: 'canvas aspect', css: `${CANVAS_SELECTOR} { width: 1500px !important; }`, code: 'canvas.aspect-ratio' },
  { name: 'canvas bounds', css: `${CANVAS_SELECTOR} { transform: translateX(20px) scale(calc(100cqw / 1600px)) !important; }`, code: 'canvas.out-of-bounds' },
  { name: 'title bounds', css: '[data-manifest-step-title] { transform: translateY(100px); }', code: 'title.out-of-bounds' },
  { name: 'slot bounds', css: '[data-generated-slide-slot="left"] { transform: translateX(-1000px); }', code: 'slot.out-of-bounds' },
  { name: 'slot overlap', css: '[data-generated-slide-slot="right"] { transform: translateX(-500px); }', code: 'slot.overlap' },
  { name: 'scroll overflow', css: '[data-generated-slide-text-marker="student-activity:payload.prompt:text"] { display: block; width: 1800px; overflow-x: auto; }', code: 'element.scroll-overflow' },
  { name: 'formula width overflow', css: '.katex-display > .katex { display: block; width: 120px !important; } .katex-display > .katex .katex-html { display: block; min-width: 600px; }', code: 'formula.width-overflow' },
  { name: 'minimum font size', css: '.generated-slide-viewport [data-generated-slide-text-marker="student-activity:payload.prompt:text"] { font-size: 12px !important; }', code: 'text.minimum-font-size' },
  { name: 'formula minimum font size', css: '.katex-display > .katex { font-size: 8px !important; }', code: 'text.minimum-font-size' },
  { name: 'module root clipping', css: '.generated-slide-viewport.generated-slide-viewport [data-generated-slide-module-root] { overflow: hidden; }', code: 'element.visual-clipping' },
  { name: 'visual clipping', css: '[data-generated-slide-text-marker="student-activity:payload.prompt:text"] { clip-path: inset(0 40% 0 0); }', code: 'element.visual-clipping' },
];

for (const defect of defectCases) {
  test(`reports a stable ${defect.name} failure`, async ({ page, browser }) => {
    const result = await validateFixture(page, browser, 'student', defect.css);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(defect.code);
    const issue = result.issues.find((candidate) => candidate.code === defect.code);
    expect(issue?.location.projection).toBe('student');
    expect(issue?.location.selector).toMatch(/^(?:\[data-|:root)/);
  });
}

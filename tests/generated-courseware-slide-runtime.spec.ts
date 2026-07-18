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
  GENERATED_SLIDE_LAYOUT_REGISTRY,
  computeGeneratedSlideContentHash,
  type GeneratedSlideManifest,
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
const PINNED_FONT_DATA_URLS = new Map(PINNED_FONT_FILES.map((fileName) => {
  const bytes = readFileSync(resolve(PINNED_FONT_ROOT, 'files', fileName));
  PINNED_FONT_HASH.update(fileName);
  PINNED_FONT_HASH.update(bytes);
  return [fileName, `data:font/woff2;base64,${bytes.toString('base64')}`];
}));
const PINNED_FONT_SHA256 = `sha256:${PINNED_FONT_HASH.digest('hex')}`;
const PINNED_FONT_CSS = PINNED_FONT_CSS_SOURCE
  .replaceAll("'Noto Sans SC Variable'", '"ACT Noto Sans SC"')
  .replace(/\.\/files\/([^')]+\.woff2)/g, (_match, fileName: string) => PINNED_FONT_DATA_URLS.get(fileName) ?? '');

const FIXTURE_TEXT_IDS = {
  student: ['formula-module:0', 'student-activity:0', 'student-activity:1'],
  teacher: ['formula-module:0', 'teacher-secret:0', 'teacher-secret:1', 'teacher-secret:2', 'student-activity:0', 'student-activity:1'],
} as const;
const FIXTURE_STEP_TEXT_IDS: Record<string, readonly string[]> = {
  'browser-gate-step-2': ['browser-gate-module-2:0', 'browser-gate-module-2:1', 'browser-gate-module-2:2'],
  'browser-gate-step-3': ['browser-gate-module-3:0', 'browser-gate-module-3:1'],
  'browser-gate-step-4': [
    'browser-gate-module-4:0',
    'browser-gate-module-4:1',
    'browser-gate-module-4:2',
    'browser-gate-module-4:3',
  ],
  'browser-gate-step-5': [
    'browser-gate-module-5:0',
    'browser-gate-module-5:1',
    'browser-gate-module-5:2',
    'browser-gate-module-5:3',
    'browser-gate-module-5:4',
    'browser-gate-module-5:5',
  ],
  'browser-gate-step-6': ['browser-gate-module-6:0', 'browser-gate-module-6:1'],
};
const MULTI_FORMULA_TEXT_IDS = {
  student: ['visible-formula:0'],
  teacher: ['visible-formula:0', 'teacher-formula:0'],
} as const;

const generatedManifest = GENERATED_SLIDE_BROWSER_FIXTURE;
const generatedStep = generatedManifest.stages[0].steps[0];
const EXPECTED_CONTENT_HASH = computeGeneratedSlideContentHash(GENERATED_SLIDE_BROWSER_FIXTURE);

function inlineFormulaCount(value: string): number {
  return value.match(/\$[^$]+\$/g)?.length ?? 0;
}

function renderedFormulaCount(value: string): number {
  const inlineCount = inlineFormulaCount(value);
  const nonMathText = value.replace(/\$[^$]+\$/g, '').trim();
  const isBareMathExpression = inlineCount === 0
    && (/\\[a-zA-Z]+/.test(value) || !/[\u4e00-\u9fff]/.test(value));
  return inlineCount === 1 && !nonMathText || isBareMathExpression ? 1 : inlineCount;
}

function expectedModuleFormulaCount(module: GeneratedSlideManifest['stages'][number]['steps'][number]['modules'][number]): number {
  const payload = module.payload as Record<string, unknown>;
  const countInline = (values: unknown[]) => values.reduce<number>(
    (count, value) => count + (typeof value === 'string' ? inlineFormulaCount(value) : 0),
    0,
  );
  switch (module.canonicalClass) {
    case 'content.rich':
      return countInline([payload.text, ...(Array.isArray(payload.bullets) ? payload.bullets : [])]);
    case 'content.cardSet':
      return Array.isArray(payload.items)
        ? payload.items.reduce<number>((count, item) => {
          const record = item as Record<string, unknown>;
          return count + countInline([record.title, record.body]);
        }, 0)
        : 0;
    case 'content.formula':
      return (Array.isArray(payload.formulas) ? payload.formulas : []).reduce<number>(
        (count, formula) => count + (typeof formula === 'string' ? renderedFormulaCount(formula) : 0),
        countInline(Array.isArray(payload.notes) ? payload.notes : []),
      );
    case 'content.table':
      return countInline(Array.isArray(payload.columns) ? payload.columns : [])
        + (Array.isArray(payload.rows) ? payload.rows.flat() : []).reduce<number>((count, cell) => {
          if (typeof cell === 'string') return count + inlineFormulaCount(cell);
          return count + (cell && typeof cell === 'object' && (cell as Record<string, unknown>).kind === 'math' ? 1 : 0);
        }, 0);
    case 'content.code':
      return countInline([payload.note]);
    case 'content.reveal':
      return Array.isArray(payload.items)
        ? payload.items.reduce<number>((count, item) => {
          const record = item as Record<string, unknown>;
          return count
            + countInline([record.body])
            + (typeof record.formula === 'string' ? renderedFormulaCount(record.formula) : 0);
        }, 0)
        : 0;
    default:
      return 0;
  }
}

function buildExpectation(
  projection: GeneratedSlideProjection,
  stepId = generatedStep.id,
): GeneratedSlideBrowserExpectation {
  const step = GENERATED_SLIDE_BROWSER_FIXTURE_STEPS.find((candidate) => candidate.id === stepId);
  if (!step) throw new Error(`Missing generated fixture step ${stepId}.`);
  const layout = GENERATED_SLIDE_LAYOUT_REGISTRY[
    step.layoutId as keyof typeof GENERATED_SLIDE_LAYOUT_REGISTRY
  ];
  const expectedModuleIds = step.modules
    .filter((module) => projection === 'student'
      ? module.roleMetadata.studentVisible
      : module.roleMetadata.teacherVisible)
    .map((module) => module.id);
  return {
    expectedContentHash: EXPECTED_CONTENT_HASH,
    expectedSlotIds: layout.slots.map((slot: { readonly id: string }) => slot.id),
    expectedModuleIds,
    expectedFormulaIds: step.modules
      .filter((module) => projection === 'student'
        ? module.roleMetadata.studentVisible
        : module.roleMetadata.teacherVisible)
      .flatMap((module) => Array.from(
        { length: expectedModuleFormulaCount(module) },
        (_value, index) => `${module.id}:${index}`,
      )),
    expectedTextIds: stepId === generatedStep.id
      ? FIXTURE_TEXT_IDS[projection]
      : stepId === 'browser-gate-multi-formula'
        ? MULTI_FORMULA_TEXT_IDS[projection]
      : FIXTURE_STEP_TEXT_IDS[stepId] ?? [],
    expectedBrowserVersion: GENERATED_SLIDE_BROWSER_VERSION,
    expectedResolvedFontFamily: GENERATED_SLIDE_BROWSER_FONT_FAMILY,
    expectedFontSha256: GENERATED_SLIDE_BROWSER_FONT_SHA256,
    expectedGlyphMetricFingerprintPx: GENERATED_SLIDE_BROWSER_GLYPH_METRIC_PX,
  };
}

async function installFixture(page: Page, projection: GeneratedSlideProjection, defectCss = '') {
  await page.setViewportSize(VIEWPORT);
  const response = await page.goto(`/review/generated-slide-runtime-938/${projection}`, { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBeLessThan(500);
  await page.addStyleTag({ content: `
      ${PINNED_FONT_CSS}
      * { box-sizing: border-box; font-family: inherit; }
      html, body { margin: 0; width: 100%; min-height: 100%; }
      body { font-family: ${GENERATED_SLIDE_BROWSER_FONT_FAMILY}; }
      .generated-slide-viewport { width: 100%; }
      .generated-slide-canvas { background: white; color: black; }
      [data-generated-slide-title-slot] { padding: 0; }
      [data-manifest-step-title] { display: grid; grid-template-columns: auto 1fr; gap: 4px 20px; }
      [data-generated-slide-title-slot] [data-manifest-step-title] { margin: 0; padding: 12px 24px; }
      [data-manifest-step-title] h1 { margin: 0; font-size: 34px; line-height: 1.15; }
      [data-manifest-step-title] p { grid-column: 2; margin: 0; font-size: 18px; line-height: 1.2; }
      [data-generated-slide-slot] { padding: 28px; line-height: 1.35; }
      [data-generated-slide-module="formula-module"] p { margin: 0 0 24px; font-size: 32px; }
      .katex { font-size: 32px; white-space: normal; }
      .katex-display > .katex { width: 100%; }
      [data-generated-slide-module="teacher-secret"] pre { margin: 0; font-size: 24px; white-space: pre-wrap; }
      [data-generated-slide-production-activity] p { margin: 0 0 20px; font-size: 32px; line-height: 1.25; }
      [data-generated-slide-production-activity] button { display: block; padding: 0; font-size: 32px; line-height: 1.25; }
      [data-after-generated-slide] { height: 48px; padding: 8px; }
      ${defectCss}
    ` });
  await page.evaluate(async () => {
    await document.fonts.load('16px "ACT Noto Sans SC"', '课件门禁闭环系统稳定性');
    await document.fonts.ready;
  });
}

async function captureSnapshot(
  page: Page,
  browser: Browser,
  projection: GeneratedSlideProjection,
  stepId = generatedStep.id,
): Promise<GeneratedSlideBrowserMeasurementSnapshot> {
  const canvasSelector = `[data-generated-slide-canvas="${stepId}"]`;
  if (stepId !== generatedStep.id) await page.locator(canvasSelector).scrollIntoViewIfNeeded();
  const metrics = await page.evaluate(({
    canvasSelector,
    glyphFontFamily,
    glyphFontSizePx,
    glyphSample,
    fontSha256,
  }) => {
    const measure = (element: Element, selector: string) => {
      const htmlElement = element as HTMLElement;
      const rect = htmlElement.getBoundingClientRect();
      const computed = getComputedStyle(htmlElement);
      const fontSize = Number.parseFloat(computed.fontSize);
      return {
        selector,
        rect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left,
        },
        clientWidth: htmlElement.clientWidth,
        clientHeight: htmlElement.clientHeight,
        scrollWidth: htmlElement.scrollWidth,
        scrollHeight: htmlElement.scrollHeight,
        fontSizePx: Number.isFinite(fontSize) ? fontSize : null,
        computedOverflowX: computed.overflowX,
        computedOverflowY: computed.overflowY,
        clipPath: computed.clipPath,
        maskImage: computed.maskImage,
        textOverflow: computed.textOverflow,
      } satisfies GeneratedSlideBrowserElementMeasurement;
    };
    const required = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing browser measurement fixture: ${selector}`);
      return element;
    };
    const canvasElement = required(canvasSelector);
    const contentHash = canvasElement.getAttribute('data-generated-slide-content-hash');
    if (!contentHash) throw new Error('Missing generated slide content hash from rendered manifest.');
    const scopedRequired = (selector: string) => {
      const element = canvasElement.querySelector(selector);
      if (!element) throw new Error(`Missing scoped browser measurement fixture: ${selector}`);
      return element;
    };
    const slots = [...canvasElement.querySelectorAll('[data-generated-slide-slot]')].map((element) => {
      const slotId = element.getAttribute('data-generated-slide-slot') ?? '';
      const selector = `[data-generated-slide-slot="${slotId}"]`;
      return { ...measure(element, selector), slotId };
    });
    const formulaIndexesByModule = new Map<string, number>();
    const formulas = [...canvasElement.querySelectorAll('.katex')].map((element) => {
      const slot = element.closest('[data-generated-slide-module]');
      const moduleId = slot?.getAttribute('data-generated-slide-module') ?? 'formula';
      const minimumFontSizePx = Number.parseFloat(
        slot?.getAttribute('data-generated-slide-minimum-font-px') ?? '',
      );
      if (!Number.isFinite(minimumFontSizePx)) {
        throw new Error(`Missing generated formula font metadata for ${moduleId}.`);
      }
      const moduleFormulaIndex = formulaIndexesByModule.get(moduleId) ?? 0;
      formulaIndexesByModule.set(moduleId, moduleFormulaIndex + 1);
      const formulaId = `${moduleId}:${moduleFormulaIndex}`;
      element.setAttribute('data-validation-formula', formulaId);
      const selector = `[data-validation-formula="${formulaId}"]`;
      const visibleFontSize = Number.parseFloat(getComputedStyle(element).fontSize);
      return {
        ...measure(element, selector),
        fontSizePx: Number.isFinite(visibleFontSize) ? visibleFontSize : null,
        formulaId,
        moduleId,
        minimumFontSizePx,
      };
    });
    const modules = [...canvasElement.querySelectorAll('[data-generated-slide-module-root]')].map((element) => {
      const moduleId = element.getAttribute('data-generated-slide-module-root') ?? '';
      const selector = `[data-generated-slide-module-root="${moduleId}"]`;
      return {
        ...measure(element, selector),
        moduleId,
        selector,
      };
    });
    const containers = [...canvasElement.querySelectorAll('*')].filter(
      (element): element is HTMLElement => element instanceof HTMLElement,
    ).filter((element) => {
      if (element.closest('.katex-mathml')) return false;
      const computed = getComputedStyle(element);
      return computed.display !== 'inline'
        || computed.overflowX !== 'visible'
        || computed.overflowY !== 'visible'
        || computed.clipPath !== 'none'
        || computed.maskImage !== 'none';
    }).map((element, index) => {
      const containerId = `container:${index}`;
      element.setAttribute('data-generated-slide-container-id', containerId);
      const selector = `[data-generated-slide-container-id="${containerId}"]`;
      return { ...measure(element, selector), containerId };
    });
    const text = [...canvasElement.querySelectorAll('[data-generated-slide-module]')].flatMap((slot) => {
      const moduleId = slot.getAttribute('data-generated-slide-module') ?? '';
      const minimumFontSizePx = Number.parseFloat(
        slot.getAttribute('data-generated-slide-minimum-font-px') ?? '',
      );
      if (!moduleId || !Number.isFinite(minimumFontSizePx)) {
        throw new Error(`Missing generated module text measurement metadata for ${moduleId || 'unknown'}.`);
      }
      const descendants = [slot, ...slot.querySelectorAll('*')]
        .filter((element) => !element.closest('.katex'))
        .filter((element) => [...element.childNodes]
          .some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()));
      return descendants.map((element, index) => {
        const textId = `${moduleId}:${index}`;
        element.setAttribute('data-generated-slide-text-id', textId);
        const selector = `[data-generated-slide-text-id="${textId}"]`;
        return { ...measure(element, selector), textId, moduleId, minimumFontSizePx };
      });
    });
    const userAgentVersion = navigator.userAgent.match(/(?:HeadlessChrome|Chrome)\/(\d+\.\d+\.\d+\.\d+)/)?.[1] ?? '';
    const glyphCanvas = document.createElement('canvas');
    const glyphContext = glyphCanvas.getContext('2d');
    if (!glyphContext) throw new Error('Canvas 2D context is required for glyph fingerprinting.');
    glyphContext.font = `${glyphFontSizePx}px ${glyphFontFamily}`;
    const glyphMetricFingerprintPx = glyphContext.measureText(glyphSample).width;
    glyphContext.font = `${glyphFontSizePx}px sans-serif`;
    return {
      contentHash,
      viewport: { width: innerWidth, height: innerHeight, deviceScaleFactor: devicePixelRatio },
      environment: {
        browserVersion: userAgentVersion,
        resolvedFontFamily: getComputedStyle(document.body).fontFamily,
        fixedFontAvailable: document.fonts.check('16px "ACT Noto Sans SC"', glyphSample),
        loadedFontSha256: fontSha256,
        glyphMetricFingerprintPx,
        fallbackGlyphMetricFingerprintPx: glyphContext.measureText(glyphSample).width,
      },
      canvas: measure(canvasElement, canvasSelector),
      titleSlot: measure(scopedRequired('[data-generated-slide-title-slot]'), '[data-generated-slide-title-slot]'),
      titleContent: measure(scopedRequired('[data-manifest-step-title]'), '[data-manifest-step-title]'),
      slots,
      modules,
      formulas,
      containers,
      text,
    };
  }, {
    canvasSelector,
    glyphFontFamily: GENERATED_SLIDE_BROWSER_FONT_FAMILY,
    glyphFontSizePx: GENERATED_SLIDE_BROWSER_GLYPH_FONT_SIZE_PX,
    glyphSample: GENERATED_SLIDE_BROWSER_GLYPH_SAMPLE,
    fontSha256: PINNED_FONT_SHA256,
  });

  const { contentHash, ...measurement } = metrics;
  return {
    identity: {
      contentHash,
      validatorVersion: GENERATED_SLIDE_BROWSER_VALIDATOR_VERSION,
      browserVersion: browser.version(),
      fontVersion: GENERATED_SLIDE_BROWSER_FONT_VERSION,
      fontSha256: PINNED_FONT_SHA256,
      viewportVersion: GENERATED_SLIDE_BROWSER_VIEWPORT_VERSION,
      projection,
    },
    ...measurement,
  };
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
        const clipped = ['hidden', 'clip'].includes(computed.overflowX)
          || ['hidden', 'clip'].includes(computed.overflowY)
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
  expect(studentSnapshot.formulas.map((formula) => formula.formulaId)).toEqual(['visible-formula:0']);
  expect(validateGeneratedSlideBrowserSnapshot(
    studentSnapshot,
    buildExpectation('student', 'browser-gate-multi-formula'),
  ).issues).toEqual([]);

  await installFixture(page, 'teacher');
  const teacherSnapshot = await captureSnapshot(page, browser, 'teacher', 'browser-gate-multi-formula');
  expect(teacherSnapshot.formulas.map((formula) => formula.formulaId)).toEqual([
    'visible-formula:0',
    'teacher-formula:0',
    'teacher-formula:1',
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
    'browser-gate-module-4:0',
    'browser-gate-module-4:1',
  ]);
  expect(validateGeneratedSlideBrowserSnapshot(
    tableSnapshot,
    buildExpectation('student', 'browser-gate-step-4'),
  ).issues).toEqual([]);

  const revealCanvas = page.locator('[data-generated-slide-canvas="browser-gate-step-5"]');
  await revealCanvas.scrollIntoViewIfNeeded();
  await revealCanvas.locator('.katex').first().evaluate((element) => {
    (element as HTMLElement).style.fontSize = '8px';
  });
  const revealSnapshot = await captureSnapshot(page, browser, 'student', 'browser-gate-step-5');
  expect(revealSnapshot.formulas.map((formula) => formula.formulaId)).toEqual([
    'browser-gate-module-5:0',
    'browser-gate-module-5:1',
    'browser-gate-module-5:2',
  ]);
  expect(validateGeneratedSlideBrowserSnapshot(
    revealSnapshot,
    buildExpectation('student', 'browser-gate-step-5'),
  ).issues).toContainEqual(expect.objectContaining({
    code: 'text.minimum-font-size',
    location: expect.objectContaining({ moduleId: 'browser-gate-module-5' }),
  }));
});

test('rejects removal of a module second measurable text descendant', async ({ page, browser }) => {
  await installFixture(page, 'student');
  await page.locator('[data-generated-slide-production-activity] button').evaluate((element) => {
    element.textContent = '';
  });

  const result = validateGeneratedSlideBrowserSnapshot(
    await captureSnapshot(page, browser, 'student'),
    buildExpectation('student'),
  );

  expect(result.valid).toBe(false);
  expect(result.issues).toContainEqual({
    code: 'text.missing',
    location: {
      projection: 'student',
      selector: '[data-generated-slide-text-id="student-activity:1"]',
      moduleId: 'student-activity',
    },
  });
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
  { name: 'scroll overflow', css: '[data-generated-slide-module="formula-module"] h2 { width: 1800px; }', code: 'element.scroll-overflow' },
  { name: 'formula width overflow', css: '.katex-display > .katex { display: block; width: 120px !important; } .katex-display > .katex .katex-html { display: block; min-width: 600px; }', code: 'formula.width-overflow' },
  { name: 'minimum font size', css: '.generated-slide-viewport [data-generated-slide-module="formula-module"] h2 { font-size: 12px !important; }', code: 'text.minimum-font-size' },
  { name: 'formula minimum font size', css: '.katex-display > .katex { font-size: 8px !important; }', code: 'text.minimum-font-size' },
  { name: 'module root clipping', css: '.generated-slide-viewport.generated-slide-viewport [data-generated-slide-module-root] { overflow: hidden; }', code: 'element.visual-clipping' },
  { name: 'visual clipping', css: '[data-generated-slide-module="formula-module"] h2 { clip-path: inset(0 40% 0 0); }', code: 'element.visual-clipping' },
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

import { describe, expect, it } from 'vitest';

import {
  GENERATED_SLIDE_BROWSER_FONT_FAMILY,
  GENERATED_SLIDE_BROWSER_FONT_SHA256,
  GENERATED_SLIDE_BROWSER_FONT_VERSION,
  GENERATED_SLIDE_BROWSER_GLYPH_METRIC_PX,
  GENERATED_SLIDE_BROWSER_VALIDATOR_VERSION,
  GENERATED_SLIDE_BROWSER_VERSION,
  GENERATED_SLIDE_BROWSER_VIEWPORT_VERSION,
  type GeneratedSlideBrowserElementMeasurement,
  type GeneratedSlideBrowserExpectation,
  type GeneratedSlideBrowserMeasurementSnapshot,
  validateGeneratedSlideBrowserSnapshot,
} from '@/features/interactive/shared/manifest-runtime/generated-slide-browser-validation';

function element(
  selector: string,
  x: number,
  y: number,
  width: number,
  height: number,
): GeneratedSlideBrowserElementMeasurement {
  return {
    selector,
    rect: { x, y, width, height, top: y, right: x + width, bottom: y + height, left: x },
    clientWidth: width,
    clientHeight: height,
    scrollWidth: width,
    scrollHeight: height,
    fontSizePx: 24,
    computedOverflowX: 'visible',
    computedOverflowY: 'visible',
    clipPath: 'none',
    maskImage: 'none',
    textOverflow: 'clip',
  };
}

function snapshot(): GeneratedSlideBrowserMeasurementSnapshot {
  const browserVersion = GENERATED_SLIDE_BROWSER_VERSION;
  return {
    identity: {
      contentHash: 'sha256:fixture',
      validatorVersion: GENERATED_SLIDE_BROWSER_VALIDATOR_VERSION,
      browserVersion,
      fontVersion: GENERATED_SLIDE_BROWSER_FONT_VERSION,
      fontSha256: GENERATED_SLIDE_BROWSER_FONT_SHA256,
      viewportVersion: GENERATED_SLIDE_BROWSER_VIEWPORT_VERSION,
      projection: 'student',
    },
    viewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
    environment: {
      browserVersion,
      resolvedFontFamily: GENERATED_SLIDE_BROWSER_FONT_FAMILY,
      fixedFontAvailable: true,
      loadedFontSha256: GENERATED_SLIDE_BROWSER_FONT_SHA256,
      glyphMetricFingerprintPx: GENERATED_SLIDE_BROWSER_GLYPH_METRIC_PX,
      fallbackGlyphMetricFingerprintPx: GENERATED_SLIDE_BROWSER_GLYPH_METRIC_PX + 10,
    },
    canvas: element('[data-generated-slide-canvas]', 0, 0, 1280, 720),
    titleSlot: element('[data-generated-slide-title-slot]', 0, 0, 1280, 90),
    titleContent: element('[data-manifest-step-title]', 20, 10, 1240, 70),
    slots: [
      { ...element('[data-generated-slide-slot="left"]', 0, 90, 640, 630), slotId: 'left' },
      { ...element('[data-generated-slide-slot="right"]', 640, 90, 640, 630), slotId: 'right' },
    ],
    modules: [{ ...element('[data-generated-slide-module-root="explanation"]', 0, 90, 640, 630), moduleId: 'explanation', slotId: 'left' }],
    formulas: [{
      ...element('[data-validation-formula="main"]', 20, 150, 500, 60),
      formulaId: 'main',
      moduleId: 'module-a',
      minimumFontSizePx: 18,
    }],
    containers: [{ ...element('[data-generated-slide-container-id="container:0"]', 20, 150, 500, 100), containerId: 'container:0', moduleId: 'explanation' }],
    text: [{
      ...element('[data-generated-slide-text-id="explanation:0"]', 20, 220, 500, 80),
      textId: 'explanation:0',
      moduleId: 'explanation',
      minimumFontSizePx: 24,
    }],
  };
}

function expectation(): GeneratedSlideBrowserExpectation {
  return {
    expectedContentHash: 'sha256:fixture',
    expectedSlotIds: ['left', 'right'],
    expectedModuleIds: ['explanation'],
    expectedFormulaIds: ['main'],
    expectedTextIds: ['explanation:0'],
    expectedBrowserVersion: GENERATED_SLIDE_BROWSER_VERSION,
    expectedResolvedFontFamily: GENERATED_SLIDE_BROWSER_FONT_FAMILY,
    expectedFontSha256: GENERATED_SLIDE_BROWSER_FONT_SHA256,
    expectedGlyphMetricFingerprintPx: GENERATED_SLIDE_BROWSER_GLYPH_METRIC_PX,
  };
}

describe('generated slide browser validator', () => {
  it('accepts a valid fixed 16:9 measurement and preserves the full result identity', () => {
    const measured = snapshot();
    const result = validateGeneratedSlideBrowserSnapshot(measured, expectation());

    expect(result).toEqual({ valid: true, identity: measured.identity, issues: [] });
    expect(JSON.parse(JSON.stringify(measured))).toEqual(measured);
  });

  it('uses the renderer-provided minimum font size for each measured module descendant', () => {
    const measured = snapshot();
    measured.text[0].fontSizePx = 22;
    measured.text.push({
      ...element('[data-generated-slide-text-id="code:0"]', 700, 220, 500, 80),
      fontSizePx: 18,
      textId: 'code:0',
      moduleId: 'code',
      minimumFontSizePx: 18,
    });
    measured.modules.push({ ...element('[data-generated-slide-module-root="code"]', 640, 90, 640, 630), moduleId: 'code', slotId: 'right' });
    const expected = expectation();
    expected.expectedModuleIds = ['explanation', 'code'];
    expected.expectedTextIds = ['explanation:0', 'code:0'];

    const result = validateGeneratedSlideBrowserSnapshot(measured, expected);

    expect(result.issues.filter((issue) => issue.code === 'text.minimum-font-size')).toEqual([{
      code: 'text.minimum-font-size',
      location: {
        projection: 'student',
        selector: '[data-generated-slide-text-id="explanation:0"]',
        moduleId: 'explanation',
      },
    }]);
  });

  it('emits stable issue codes and locations for every visual measurement gate', () => {
    const measured = snapshot();
    measured.canvas.rect.right = 1300;
    measured.canvas.rect.width = 1300;
    measured.slots[0].rect.left = -4;
    measured.slots[0].rect.x = -4;
    measured.slots[0].rect.right = 650;
    measured.slots[1].rect.left = 630;
    measured.slots[1].rect.x = 630;
    measured.slots[0].scrollWidth = 700;
    measured.slots[0].computedOverflowX = 'auto';
    measured.formulas[0].clientWidth = 300;
    measured.formulas[0].scrollWidth = 500;
    measured.text[0].fontSizePx = 12;
    measured.text[0].clipPath = 'inset(0 30% 0 0)';

    const result = validateGeneratedSlideBrowserSnapshot(measured, expectation());

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      { code: 'canvas.aspect-ratio', location: { projection: 'student', selector: '[data-generated-slide-canvas]' } },
      { code: 'canvas.out-of-bounds', location: { projection: 'student', selector: '[data-generated-slide-canvas]' } },
      { code: 'slot.out-of-bounds', location: { projection: 'student', selector: '[data-generated-slide-slot="left"]' } },
      {
        code: 'slot.overlap',
        location: {
          projection: 'student',
          selector: '[data-generated-slide-slot="left"]',
          relatedSelector: '[data-generated-slide-slot="right"]',
        },
      },
      {
        code: 'element.visual-clipping',
        location: { projection: 'student', selector: measured.text[0].selector, moduleId: 'explanation' },
      },
      { code: 'element.scroll-overflow', location: { projection: 'student', selector: '[data-generated-slide-slot="left"]' } },
      { code: 'formula.width-overflow', location: { projection: 'student', selector: '[data-validation-formula="main"]' } },
      {
        code: 'text.minimum-font-size',
        location: { projection: 'student', selector: measured.text[0].selector, moduleId: 'explanation' },
      },
    ]));
  });

  it('rejects forged or unpinned browser environment identity with one stable issue', () => {
    const measured = snapshot();
    measured.viewport.deviceScaleFactor = 2;
    measured.environment.resolvedFontFamily = 'system-ui';
    measured.environment.fixedFontAvailable = false;
    (measured.identity as unknown as { validatorVersion: string }).validatorVersion = 'forged-validator';

    expect(validateGeneratedSlideBrowserSnapshot(measured, expectation()).issues).toContainEqual({
      code: 'environment.mismatch',
      location: { projection: 'student', selector: ':root' },
    });
  });

  it('rejects browser version confusion between identity and environment', () => {
    const measured = snapshot();
    measured.identity.browserVersion = '148.0.7778.95';

    expect(validateGeneratedSlideBrowserSnapshot(measured, expectation()).issues).toContainEqual({
      code: 'environment.mismatch',
      location: { projection: 'student', selector: ':root' },
    });
  });

  it('rejects a glyph metric fingerprint outside the explicit tolerance', () => {
    const measured = snapshot();
    measured.environment.glyphMetricFingerprintPx += 0.02;

    expect(validateGeneratedSlideBrowserSnapshot(measured, expectation()).issues).toContainEqual({
      code: 'environment.mismatch',
      location: { projection: 'student', selector: ':root' },
    });
  });

  it('rejects an expectation that attempts to redefine the fixed glyph fingerprint', () => {
    const measured = snapshot();
    const expected = expectation();
    measured.environment.glyphMetricFingerprintPx += 10;
    expected.expectedGlyphMetricFingerprintPx += 10;

    expect(validateGeneratedSlideBrowserSnapshot(measured, expected).issues).toContainEqual({
      code: 'environment.mismatch',
      location: { projection: 'student', selector: ':root' },
    });
  });

  it.each(['identity', 'environment', 'expectation'] as const)(
    'rejects a font hash mismatch in %s even when the family and glyph metric match',
    (source) => {
      const measured = snapshot();
      const expected = expectation();
      if (source === 'identity') measured.identity.fontSha256 = 'sha256:different-font';
      if (source === 'environment') measured.environment.loadedFontSha256 = 'sha256:different-font';
      if (source === 'expectation') {
        (expected as unknown as { expectedFontSha256: string }).expectedFontSha256 = 'sha256:different-font';
      }

      expect(validateGeneratedSlideBrowserSnapshot(measured, expected).issues).toContainEqual({
        code: 'environment.mismatch',
        location: { projection: 'student', selector: ':root' },
      });
    },
  );

  it('rejects content hashes that do not match the independent expectation', () => {
    const expected = expectation();
    expected.expectedContentHash = 'sha256:different-source-manifest';

    expect(validateGeneratedSlideBrowserSnapshot(snapshot(), expected).issues).toContainEqual({
      code: 'identity.content-hash',
      location: { projection: 'student', selector: ':root' },
    });
  });

  it.each([
    ['slot', 'slots', 'slotId', 'left'],
    ['module', 'modules', 'moduleId', 'explanation'],
    ['formula', 'formulas', 'formulaId', 'main'],
  ] as const)('rejects missing, duplicate, and unexpected %s ids', (kind, collection, idKey, knownId) => {
    const missing = snapshot();
    missing[collection] = [] as never;
    expect(validateGeneratedSlideBrowserSnapshot(missing, expectation()).issues.map((issue) => issue.code))
      .toContain(`${kind}.missing`);

    const duplicate = snapshot();
    duplicate[collection].push({ ...duplicate[collection][0] } as never);
    expect(validateGeneratedSlideBrowserSnapshot(duplicate, expectation()).issues.map((issue) => issue.code))
      .toContain(`${kind}.duplicate`);

    const unexpected = snapshot();
    unexpected[collection].push({
      ...unexpected[collection][0],
      [idKey]: `${knownId}-unknown`,
    } as never);
    expect(validateGeneratedSlideBrowserSnapshot(unexpected, expectation()).issues.map((issue) => issue.code))
      .toContain(`${kind}.unexpected`);
  });

  it('rejects missing, duplicate, and unexpected text identities', () => {
    const missing = snapshot();
    missing.text = [];
    expect(validateGeneratedSlideBrowserSnapshot(missing, expectation()).issues.map((issue) => issue.code))
      .toContain('text.missing');

    const duplicate = snapshot();
    duplicate.text.push({ ...duplicate.text[0] });
    expect(validateGeneratedSlideBrowserSnapshot(duplicate, expectation()).issues.map((issue) => issue.code))
      .toContain('text.duplicate');

    const unexpected = snapshot();
    unexpected.text.push({ ...unexpected.text[0], textId: 'explanation:1' });
    expect(validateGeneratedSlideBrowserSnapshot(unexpected, expectation()).issues.map((issue) => issue.code))
      .toContain('text.unexpected');
  });

  it('rejects text attributed to an unknown module while allowing formula-only modules', () => {
    const measured = snapshot();
    measured.text = [{ ...measured.text[0], moduleId: 'unknown-module' }];

    expect(validateGeneratedSlideBrowserSnapshot(measured, expectation()).issues).toEqual(expect.arrayContaining([
      {
        code: 'text.unknown-module',
        location: {
          projection: 'student',
          selector: measured.text[0].selector,
          moduleId: 'unknown-module',
        },
      },
    ]));
  });

  it('compares minimum font size against the whole-canvas visual scale', () => {
    const measured = snapshot();
    measured.canvas.clientWidth = 1600;
    measured.text[0].fontSizePx = 24;

    expect(validateGeneratedSlideBrowserSnapshot(measured, expectation()).issues.map((issue) => issue.code))
      .toContain('text.minimum-font-size');

    measured.text[0].fontSizePx = 32;
    expect(validateGeneratedSlideBrowserSnapshot(measured, expectation()).issues.map((issue) => issue.code))
      .not.toContain('text.minimum-font-size');
  });

  it('rejects text outside the canvas and a single pixel of scroll overflow', () => {
    const measured = snapshot();
    measured.text[0].rect.right = measured.canvas.rect.right + 2;
    measured.text[0].scrollWidth = measured.text[0].clientWidth + 1;
    measured.text[0].computedOverflowX = 'auto';

    expect(validateGeneratedSlideBrowserSnapshot(measured, expectation()).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'element.out-of-bounds',
        location: expect.objectContaining({ selector: measured.text[0].selector }),
      }),
      expect.objectContaining({
        code: 'element.scroll-overflow',
        location: expect.objectContaining({ selector: measured.text[0].selector }),
      }),
    ]));
  });

  it('rejects visible content that escapes its owning module while remaining on canvas', () => {
    const measured = snapshot();
    measured.text[0].rect.left = 650;
    measured.text[0].rect.x = 650;
    measured.text[0].rect.right = 1150;

    expect(validateGeneratedSlideBrowserSnapshot(measured, expectation()).issues).toContainEqual({
      code: 'element.out-of-bounds',
      location: {
        projection: 'student',
        selector: measured.text[0].selector,
        moduleId: 'explanation',
        relatedSelector: measured.modules[0].selector,
      },
    });
  });

  it('rejects a module that escapes its owning slot while remaining on canvas', () => {
    const measured = snapshot();
    measured.modules[0].rect.left = 100;
    measured.modules[0].rect.x = 100;
    measured.modules[0].rect.right = 740;

    expect(validateGeneratedSlideBrowserSnapshot(measured, expectation()).issues).toContainEqual({
      code: 'element.out-of-bounds',
      location: {
        projection: 'student',
        selector: measured.modules[0].selector,
        moduleId: 'explanation',
        relatedSelector: measured.slots[0].selector,
      },
    });
  });

  it('rejects a visible child container that escapes its owning module', () => {
    const measured = snapshot();
    measured.containers[0].rect.right = 700;

    expect(validateGeneratedSlideBrowserSnapshot(measured, expectation()).issues).toContainEqual({
      code: 'element.out-of-bounds',
      location: {
        projection: 'student',
        selector: measured.containers[0].selector,
        moduleId: 'explanation',
        relatedSelector: measured.modules[0].selector,
      },
    });
  });

  it('rejects title escape, clipped module/container/formula roots, and missing font measurements', () => {
    const measured = snapshot();
    measured.titleContent.rect.bottom = 120;
    measured.modules[0].computedOverflowX = 'hidden';
    measured.formulas[0].computedOverflowY = 'clip';
    measured.formulas[0].fontSizePx = null;
    measured.containers[0].scrollHeight += 10;
    measured.containers[0].computedOverflowY = 'auto';
    measured.text[0].fontSizePx = null;

    expect(validateGeneratedSlideBrowserSnapshot(measured, expectation()).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'title.out-of-bounds' }),
      expect.objectContaining({ code: 'element.visual-clipping', location: expect.objectContaining({ selector: measured.modules[0].selector }) }),
      expect.objectContaining({ code: 'element.visual-clipping', location: expect.objectContaining({ selector: measured.formulas[0].selector }) }),
      expect.objectContaining({ code: 'text.minimum-font-size', location: expect.objectContaining({ selector: measured.formulas[0].selector, moduleId: measured.formulas[0].moduleId }) }),
      expect.objectContaining({ code: 'element.scroll-overflow', location: expect.objectContaining({ selector: measured.containers[0].selector }) }),
      expect.objectContaining({ code: 'text.minimum-font-size', location: expect.objectContaining({ selector: measured.text[0].selector }) }),
    ]));
  });

  it('ignores native control chrome clipping but still enforces font size and real overflow', () => {
    const measured = snapshot();
    measured.containers[0] = {
      ...measured.containers[0],
      nativeFormControl: true,
      minimumFontSizePx: 24,
      computedOverflowX: 'clip',
      computedOverflowY: 'clip',
      fontSizePx: 20,
      scrollWidth: measured.containers[0].clientWidth + 8,
    };

    const issues = validateGeneratedSlideBrowserSnapshot(measured, expectation()).issues;

    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'text.minimum-font-size' }),
      expect.objectContaining({ code: 'element.scroll-overflow' }),
    ]));
    expect(issues).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'element.visual-clipping' }),
    ]));
  });

  it('rejects explicit visual clipping on a native control', () => {
    const measured = snapshot();
    measured.containers[0] = {
      ...measured.containers[0],
      nativeFormControl: true,
      computedOverflowX: 'clip',
      computedOverflowY: 'clip',
      clipPath: 'inset(100%)',
    };

    expect(validateGeneratedSlideBrowserSnapshot(measured, expectation()).issues).toContainEqual(
      expect.objectContaining({
        code: 'element.visual-clipping',
        location: expect.objectContaining({ selector: measured.containers[0].selector }),
      }),
    );
  });
});

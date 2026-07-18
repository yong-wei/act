export const GENERATED_SLIDE_BROWSER_VALIDATOR_VERSION = 'generated-slide-browser-validator-v1' as const;
export const GENERATED_SLIDE_BROWSER_VIEWPORT_VERSION = 'chromium-1280x720-dpr1-v1' as const;
export const GENERATED_SLIDE_BROWSER_FONT_VERSION = 'noto-sans-sc-variable-5.2.10-v1' as const;
export const GENERATED_SLIDE_BROWSER_FONT_FAMILY = '"ACT Noto Sans SC", sans-serif' as const;
export const GENERATED_SLIDE_BROWSER_FONT_SHA256 = 'sha256:7bbe2b6d0d7cdbf81ec18cff889c8fe336bd5acf4c1e32b456f8164bea890e51' as const;
export const GENERATED_SLIDE_BROWSER_VERSION = '148.0.7778.96' as const;
export const GENERATED_SLIDE_BROWSER_GLYPH_SAMPLE = '课件门禁闭环系统稳定性 | ACT Browser Gate 938 | ABC xyz 0123456789' as const;
export const GENERATED_SLIDE_BROWSER_GLYPH_FONT_SIZE_PX = 32 as const;
export const GENERATED_SLIDE_BROWSER_GLYPH_METRIC_PX = 1021.7188720703125 as const;

const EXPECTED_VIEWPORT = { width: 1280, height: 720, deviceScaleFactor: 1 } as const;

export type GeneratedSlideProjection = 'student' | 'teacher';

export interface GeneratedSlideBrowserRect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface GeneratedSlideBrowserElementMeasurement {
  selector: string;
  rect: GeneratedSlideBrowserRect;
  clientWidth: number;
  clientHeight: number;
  scrollWidth: number;
  scrollHeight: number;
  fontSizePx: number | null;
  computedOverflowX: string;
  computedOverflowY: string;
  clipPath: string;
  maskImage: string;
  textOverflow: string;
}

export interface GeneratedSlideBrowserSlotMeasurement extends GeneratedSlideBrowserElementMeasurement {
  slotId: string;
}

export interface GeneratedSlideBrowserFormulaMeasurement extends GeneratedSlideBrowserElementMeasurement {
  formulaId: string;
  moduleId: string;
  minimumFontSizePx: number;
}

export interface GeneratedSlideBrowserModuleMeasurement extends GeneratedSlideBrowserElementMeasurement {
  moduleId: string;
}

export interface GeneratedSlideBrowserContainerMeasurement extends GeneratedSlideBrowserElementMeasurement {
  containerId: string;
}

export interface GeneratedSlideBrowserTextMeasurement extends GeneratedSlideBrowserElementMeasurement {
  textId: string;
  moduleId: string;
  minimumFontSizePx: number;
}

export interface GeneratedSlideBrowserSnapshotIdentity {
  contentHash: string;
  validatorVersion: typeof GENERATED_SLIDE_BROWSER_VALIDATOR_VERSION;
  browserVersion: string;
  fontVersion: typeof GENERATED_SLIDE_BROWSER_FONT_VERSION;
  fontSha256: string;
  viewportVersion: typeof GENERATED_SLIDE_BROWSER_VIEWPORT_VERSION;
  projection: GeneratedSlideProjection;
}

export interface GeneratedSlideBrowserEnvironmentMeasurement {
  browserVersion: string;
  resolvedFontFamily: string;
  fixedFontAvailable: boolean;
  loadedFontSha256: string;
  glyphMetricFingerprintPx: number;
  fallbackGlyphMetricFingerprintPx: number;
}

export interface GeneratedSlideBrowserMeasurementSnapshot {
  identity: GeneratedSlideBrowserSnapshotIdentity;
  viewport: { width: number; height: number; deviceScaleFactor: number };
  environment: GeneratedSlideBrowserEnvironmentMeasurement;
  canvas: GeneratedSlideBrowserElementMeasurement;
  titleSlot: GeneratedSlideBrowserElementMeasurement;
  titleContent: GeneratedSlideBrowserElementMeasurement;
  slots: GeneratedSlideBrowserSlotMeasurement[];
  modules: GeneratedSlideBrowserModuleMeasurement[];
  formulas: GeneratedSlideBrowserFormulaMeasurement[];
  containers: GeneratedSlideBrowserContainerMeasurement[];
  text: GeneratedSlideBrowserTextMeasurement[];
}

export interface GeneratedSlideBrowserExpectation {
  expectedContentHash: string;
  expectedSlotIds: readonly string[];
  expectedModuleIds: readonly string[];
  expectedFormulaIds: readonly string[];
  expectedTextIds: readonly string[];
  expectedBrowserVersion: typeof GENERATED_SLIDE_BROWSER_VERSION;
  expectedResolvedFontFamily: typeof GENERATED_SLIDE_BROWSER_FONT_FAMILY;
  expectedFontSha256: typeof GENERATED_SLIDE_BROWSER_FONT_SHA256;
  expectedGlyphMetricFingerprintPx: number;
}

export type GeneratedSlideBrowserIssueCode =
  | 'environment.mismatch'
  | 'identity.content-hash'
  | 'slot.missing'
  | 'slot.duplicate'
  | 'slot.unexpected'
  | 'module.missing'
  | 'module.duplicate'
  | 'module.unexpected'
  | 'formula.missing'
  | 'formula.duplicate'
  | 'formula.unexpected'
  | 'text.missing'
  | 'text.duplicate'
  | 'text.unexpected'
  | 'text.missing-module-measurement'
  | 'text.unknown-module'
  | 'canvas.aspect-ratio'
  | 'canvas.out-of-bounds'
  | 'title.out-of-bounds'
  | 'slot.out-of-bounds'
  | 'slot.overlap'
  | 'element.visual-clipping'
  | 'element.out-of-bounds'
  | 'element.scroll-overflow'
  | 'formula.width-overflow'
  | 'text.minimum-font-size';

export interface GeneratedSlideBrowserIssueLocation {
  projection: GeneratedSlideProjection;
  selector: string;
  moduleId?: string;
  relatedSelector?: string;
}

export interface GeneratedSlideBrowserValidationIssue {
  code: GeneratedSlideBrowserIssueCode;
  location: GeneratedSlideBrowserIssueLocation;
}

export interface GeneratedSlideBrowserValidationResult {
  valid: boolean;
  identity: GeneratedSlideBrowserSnapshotIdentity;
  issues: GeneratedSlideBrowserValidationIssue[];
}

export interface GeneratedSlideBrowserValidationOptions {
  expectedAspectRatio?: number;
  geometryTolerancePx?: number;
  scrollTolerancePx?: number;
  glyphMetricTolerancePx?: number;
}

export function validateGeneratedSlideBrowserSnapshot(
  snapshot: GeneratedSlideBrowserMeasurementSnapshot,
  expectation: GeneratedSlideBrowserExpectation,
  options: GeneratedSlideBrowserValidationOptions = {},
): GeneratedSlideBrowserValidationResult {
  const expectedAspectRatio = options.expectedAspectRatio ?? 16 / 9;
  const geometryTolerancePx = options.geometryTolerancePx ?? 1;
  const scrollTolerancePx = options.scrollTolerancePx ?? 6;
  const glyphMetricTolerancePx = options.glyphMetricTolerancePx ?? 0.01;
  const issues: GeneratedSlideBrowserValidationIssue[] = [];
  const add = (
    code: GeneratedSlideBrowserIssueCode,
    selector: string,
    details: Pick<GeneratedSlideBrowserIssueLocation, 'moduleId' | 'relatedSelector'> = {},
  ) => issues.push({
    code,
    location: {
      projection: snapshot.identity.projection,
      selector,
      ...(details.moduleId ? { moduleId: details.moduleId } : {}),
      ...(details.relatedSelector ? { relatedSelector: details.relatedSelector } : {}),
    },
  });

  if (!hasExpectedEnvironment(snapshot, expectation, glyphMetricTolerancePx)) {
    add('environment.mismatch', ':root');
  }
  if (snapshot.identity.contentHash !== expectation.expectedContentHash) {
    add('identity.content-hash', ':root');
  }

  validateExactIds({
    expectedIds: expectation.expectedSlotIds,
    measured: snapshot.slots,
    id: (slot) => slot.slotId,
    selector: (slot) => slot.selector,
    kind: 'slot',
    add,
  });
  validateExactIds({
    expectedIds: expectation.expectedTextIds,
    measured: snapshot.text,
    id: (text) => text.textId,
    selector: (text) => text.selector,
    kind: 'text',
    add,
  });
  validateExactIds({
    expectedIds: expectation.expectedModuleIds,
    measured: snapshot.modules,
    id: (module) => module.moduleId,
    selector: (module) => module.selector,
    kind: 'module',
    add,
  });
  validateExactIds({
    expectedIds: expectation.expectedFormulaIds,
    measured: snapshot.formulas,
    id: (formula) => formula.formulaId,
    selector: (formula) => formula.selector,
    kind: 'formula',
    add,
  });

  const expectedModuleIds = new Set(expectation.expectedModuleIds);
  const modulesWithText = new Set(snapshot.text.map((measurement) => measurement.moduleId));
  for (const moduleId of expectation.expectedModuleIds) {
    if (!modulesWithText.has(moduleId)) {
      add('text.missing-module-measurement', `[data-generated-slide-module="${moduleId}"]`, { moduleId });
    }
  }
  for (const measurement of snapshot.text) {
    if (!expectedModuleIds.has(measurement.moduleId)) {
      add('text.unknown-module', measurement.selector, { moduleId: measurement.moduleId });
    }
  }

  const canvasRatio = snapshot.canvas.rect.width / snapshot.canvas.rect.height;
  if (!Number.isFinite(canvasRatio) || Math.abs(canvasRatio - expectedAspectRatio) > 0.002) {
    add('canvas.aspect-ratio', snapshot.canvas.selector);
  }
  if (!rectContainsViewport(snapshot.canvas.rect, snapshot.viewport, geometryTolerancePx)) {
    add('canvas.out-of-bounds', snapshot.canvas.selector);
  }
  if (!rectContains(snapshot.titleSlot.rect, snapshot.titleContent.rect, geometryTolerancePx)) {
    add('title.out-of-bounds', snapshot.titleContent.selector, {
      relatedSelector: snapshot.titleSlot.selector,
    });
  }

  for (const slot of snapshot.slots) {
    if (!rectContains(snapshot.canvas.rect, slot.rect, geometryTolerancePx)) {
      add('slot.out-of-bounds', slot.selector);
    }
  }
  for (let leftIndex = 0; leftIndex < snapshot.slots.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < snapshot.slots.length; rightIndex += 1) {
      const left = snapshot.slots[leftIndex];
      const right = snapshot.slots[rightIndex];
      if (rectsOverlap(left.rect, right.rect, geometryTolerancePx)) {
        add('slot.overlap', left.selector, { relatedSelector: right.selector });
      }
    }
  }

  const measuredElements = [
    snapshot.canvas,
    snapshot.titleSlot,
    snapshot.titleContent,
    ...snapshot.slots,
    ...snapshot.modules,
    ...snapshot.formulas,
    ...snapshot.containers,
  ];
  for (const element of measuredElements) {
    if (element !== snapshot.canvas
      && !rectContains(snapshot.canvas.rect, element.rect, geometryTolerancePx)) {
      add('element.out-of-bounds', element.selector);
    }
    if (hasVisualClippingSignal(element)) {
      add('element.visual-clipping', element.selector);
    }
    if (
      element.scrollWidth > element.clientWidth + scrollTolerancePx
      || element.scrollHeight > element.clientHeight + scrollTolerancePx
    ) {
      add('element.scroll-overflow', element.selector);
    }
  }

  for (const formula of snapshot.formulas) {
    if (formula.scrollWidth > formula.clientWidth + scrollTolerancePx) {
      add('formula.width-overflow', formula.selector);
    }
    if (isBelowMinimumEffectiveFontSize(snapshot, formula)) {
      add('text.minimum-font-size', formula.selector, { moduleId: formula.moduleId });
    }
  }
  for (const text of snapshot.text) {
    if (hasVisualClippingSignal(text)) {
      add('element.visual-clipping', text.selector, { moduleId: text.moduleId });
    }
    if (isBelowMinimumEffectiveFontSize(snapshot, text)) {
      add('text.minimum-font-size', text.selector, { moduleId: text.moduleId });
    }
  }

  return { valid: issues.length === 0, identity: snapshot.identity, issues };
}

function isBelowMinimumEffectiveFontSize(
  snapshot: GeneratedSlideBrowserMeasurementSnapshot,
  measurement: { fontSizePx: number | null; minimumFontSizePx: number },
): boolean {
  const canvasVisualScale = snapshot.canvas.clientWidth > 0
    ? snapshot.canvas.rect.width / snapshot.canvas.clientWidth
    : Number.NaN;
  const effectiveFontSizePx = measurement.fontSizePx === null
    ? null
    : measurement.fontSizePx * canvasVisualScale;
  return effectiveFontSizePx === null
    || !Number.isFinite(effectiveFontSizePx)
    || effectiveFontSizePx < measurement.minimumFontSizePx;
}

function hasExpectedEnvironment(
  snapshot: GeneratedSlideBrowserMeasurementSnapshot,
  expectation: GeneratedSlideBrowserExpectation,
  glyphMetricTolerancePx: number,
): boolean {
  const { identity, viewport, environment } = snapshot;
  return viewport.width === EXPECTED_VIEWPORT.width
    && viewport.height === EXPECTED_VIEWPORT.height
    && viewport.deviceScaleFactor === EXPECTED_VIEWPORT.deviceScaleFactor
    && identity.validatorVersion === GENERATED_SLIDE_BROWSER_VALIDATOR_VERSION
    && identity.viewportVersion === GENERATED_SLIDE_BROWSER_VIEWPORT_VERSION
    && identity.fontVersion === GENERATED_SLIDE_BROWSER_FONT_VERSION
    && identity.fontSha256 === GENERATED_SLIDE_BROWSER_FONT_SHA256
    && identity.browserVersion === GENERATED_SLIDE_BROWSER_VERSION
    && environment.browserVersion === GENERATED_SLIDE_BROWSER_VERSION
    && identity.browserVersion === expectation.expectedBrowserVersion
    && environment.browserVersion === expectation.expectedBrowserVersion
    && normalizeFontFamily(expectation.expectedResolvedFontFamily) === normalizeFontFamily(GENERATED_SLIDE_BROWSER_FONT_FAMILY)
    && normalizeFontFamily(environment.resolvedFontFamily) === normalizeFontFamily(expectation.expectedResolvedFontFamily)
    && expectation.expectedFontSha256 === GENERATED_SLIDE_BROWSER_FONT_SHA256
    && identity.fontSha256 === expectation.expectedFontSha256
    && environment.loadedFontSha256 === expectation.expectedFontSha256
    && environment.fixedFontAvailable
    && Math.abs(
      expectation.expectedGlyphMetricFingerprintPx - GENERATED_SLIDE_BROWSER_GLYPH_METRIC_PX,
    ) <= glyphMetricTolerancePx
    && Number.isFinite(environment.glyphMetricFingerprintPx)
    && Number.isFinite(environment.fallbackGlyphMetricFingerprintPx)
    && Math.abs(
      environment.glyphMetricFingerprintPx - environment.fallbackGlyphMetricFingerprintPx,
    ) > glyphMetricTolerancePx
    && Math.abs(
      environment.glyphMetricFingerprintPx - expectation.expectedGlyphMetricFingerprintPx,
    ) <= glyphMetricTolerancePx;
}

function validateExactIds<T>({
  expectedIds,
  measured,
  id,
  selector,
  kind,
  add,
}: {
  expectedIds: readonly string[];
  measured: readonly T[];
  id: (measurement: T) => string;
  selector: (measurement: T) => string;
  kind: 'slot' | 'module' | 'formula' | 'text';
  add: (
    code: GeneratedSlideBrowserIssueCode,
    selector: string,
    details?: Pick<GeneratedSlideBrowserIssueLocation, 'moduleId' | 'relatedSelector'>,
  ) => void;
}) {
  const expected = new Set(expectedIds);
  const counts = new Map<string, number>();
  for (const measurement of measured) {
    const measuredId = id(measurement);
    counts.set(measuredId, (counts.get(measuredId) ?? 0) + 1);
    const details = kind === 'module'
      ? { moduleId: measuredId }
      : kind === 'text'
        ? { moduleId: measuredId.split(':', 1)[0] }
        : {};
    if (!expected.has(measuredId)) add(`${kind}.unexpected`, selector(measurement), details);
  }
  for (const expectedId of expectedIds) {
    const count = counts.get(expectedId) ?? 0;
    const expectedSelector = kind === 'formula'
      ? `[data-validation-formula="${expectedId}"]`
      : kind === 'text'
        ? `[data-generated-slide-text-id="${expectedId}"]`
        : kind === 'module'
          ? `[data-generated-slide-module-root="${expectedId}"]`
          : `[data-generated-slide-${kind}="${expectedId}"]`;
    const details = kind === 'module'
      ? { moduleId: expectedId }
      : kind === 'text'
        ? { moduleId: expectedId.split(':', 1)[0] }
        : {};
    if (count === 0) add(`${kind}.missing`, expectedSelector, details);
    if (count > 1) add(`${kind}.duplicate`, expectedSelector, details);
  }
}

function normalizeFontFamily(value: string): string {
  return value.replace(/["']/g, '').replace(/\s+/g, '').toLowerCase();
}

function hasVisualClippingSignal(element: GeneratedSlideBrowserElementMeasurement): boolean {
  const clipsOverflow = ['hidden', 'clip'].includes(element.computedOverflowX)
    || ['hidden', 'clip'].includes(element.computedOverflowY);
  return clipsOverflow
    || (element.clipPath !== 'none' && element.clipPath !== '')
    || (element.maskImage !== 'none' && element.maskImage !== '')
    || (element.textOverflow !== 'clip' && element.textOverflow !== '');
}

function rectContains(
  outer: GeneratedSlideBrowserRect,
  inner: GeneratedSlideBrowserRect,
  tolerance: number,
): boolean {
  return inner.left >= outer.left - tolerance
    && inner.top >= outer.top - tolerance
    && inner.right <= outer.right + tolerance
    && inner.bottom <= outer.bottom + tolerance;
}

function rectContainsViewport(
  rect: GeneratedSlideBrowserRect,
  viewport: GeneratedSlideBrowserMeasurementSnapshot['viewport'],
  tolerance: number,
): boolean {
  return rect.left >= -tolerance
    && rect.top >= -tolerance
    && rect.right <= viewport.width + tolerance
    && rect.bottom <= viewport.height + tolerance;
}

function rectsOverlap(
  left: GeneratedSlideBrowserRect,
  right: GeneratedSlideBrowserRect,
  tolerance: number,
): boolean {
  const overlapWidth = Math.min(left.right, right.right) - Math.max(left.left, right.left);
  const overlapHeight = Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top);
  return overlapWidth > tolerance && overlapHeight > tolerance;
}

import type { Browser, Page } from 'playwright';
export { deriveGeneratedSlideStepRenderContract } from './generated-slide-render-markers';

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
  type GeneratedSlideBrowserMeasurementSnapshot,
  type GeneratedSlideBrowserExpectation,
  type GeneratedSlideProjection,
} from './generated-slide-browser-validation';

export function buildGeneratedSlideBrowserExpectation(input: {
  contentHash: string;
  slotIds: readonly string[];
  moduleIds: readonly string[];
  formulaIds: readonly string[];
  textIds: readonly string[];
}): GeneratedSlideBrowserExpectation {
  return {
    expectedContentHash: input.contentHash,
    expectedSlotIds: input.slotIds,
    expectedModuleIds: input.moduleIds,
    expectedFormulaIds: input.formulaIds,
    expectedTextIds: input.textIds,
    expectedBrowserVersion: GENERATED_SLIDE_BROWSER_VERSION,
    expectedResolvedFontFamily: GENERATED_SLIDE_BROWSER_FONT_FAMILY,
    expectedFontSha256: GENERATED_SLIDE_BROWSER_FONT_SHA256,
    expectedGlyphMetricFingerprintPx: GENERATED_SLIDE_BROWSER_GLYPH_METRIC_PX,
  };
}

export async function captureGeneratedSlideBrowserSnapshot(input: {
  page: Page;
  browser: Pick<Browser, 'version'>;
  projection: GeneratedSlideProjection;
  stepId: string;
}): Promise<GeneratedSlideBrowserMeasurementSnapshot> {
  const { page, browser, projection, stepId } = input;
  const canvasSelector = `[data-generated-slide-canvas="${stepId}"]`;
  await page.evaluate(async ({ canvasSelector, family, sample }) => {
    const element = document.querySelector(canvasSelector);
    if (!(element instanceof HTMLElement)) throw new Error(`browser-measurement-canvas-missing:${canvasSelector}`);
    await document.fonts.load(`16px ${family.split(',')[0]}`, sample);
    await document.fonts.ready;
    const left = window.scrollX;
    const top = element.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ left, top, behavior: 'instant' });
  }, {
    canvasSelector,
    family: GENERATED_SLIDE_BROWSER_FONT_FAMILY,
    sample: GENERATED_SLIDE_BROWSER_GLYPH_SAMPLE,
  });
  const data = await page.evaluate(({ canvasSelector, family, sample, size, fontSha }) => {
    const toRect = (r: DOMRect) => ({ x: r.x, y: r.y, width: r.width, height: r.height, top: r.top, right: r.right, bottom: r.bottom, left: r.left });
    const measure = (element: Element, selector: string) => {
      const node = element as HTMLElement;
      const style = getComputedStyle(node);
      const fontSize = Number.parseFloat(style.fontSize);
      return {
        selector, rect: toRect(node.getBoundingClientRect()), clientWidth: node.clientWidth, clientHeight: node.clientHeight,
        scrollWidth: node.scrollWidth, scrollHeight: node.scrollHeight,
        fontSizePx: Number.isFinite(fontSize) ? fontSize : null,
        computedOverflowX: style.overflowX, computedOverflowY: style.overflowY,
        clipPath: style.clipPath, maskImage: style.maskImage, textOverflow: style.textOverflow,
        nativeFormControl: node.matches('button,input,textarea,select'),
      };
    };
    const canvas = document.querySelector(canvasSelector);
    if (!(canvas instanceof HTMLElement)) throw new Error(`browser-measurement-canvas-missing:${canvasSelector}`);
    const required = (selector: string) => {
      const node = canvas.querySelector(selector);
      if (!node) throw new Error(`browser-measurement-element-missing:${selector}`);
      return node;
    };
    const contentHash = document.querySelector('[data-publication-manifest-hash]')?.getAttribute('data-publication-manifest-hash')
      ?? canvas.getAttribute('data-generated-slide-content-hash');
    if (!contentHash) throw new Error('browser-measurement-content-hash-missing');
    const slots = [...canvas.querySelectorAll('[data-generated-slide-slot]')].map((node) => {
      const slotId = node.getAttribute('data-generated-slide-slot') ?? '';
      return { ...measure(node, `[data-generated-slide-slot="${slotId}"]`), slotId };
    });
    const modules = [...canvas.querySelectorAll('[data-generated-slide-module-root]')].map((node) => {
      const moduleId = node.getAttribute('data-generated-slide-module-root') ?? '';
      const slotId = node.closest('[data-generated-slide-slot]')?.getAttribute('data-generated-slide-slot') ?? '';
      return { ...measure(node, `[data-generated-slide-module-root="${moduleId}"]`), moduleId, slotId };
    });
    const formulas = [...canvas.querySelectorAll('[data-generated-slide-formula-marker]')].flatMap((marker) => {
      const formulaId = marker.getAttribute('data-generated-slide-formula-marker') ?? '';
      const node = marker.querySelector('.katex');
      if (!node) return [];
      const slot = marker.closest('[data-generated-slide-module]');
      const moduleId = slot?.getAttribute('data-generated-slide-module') ?? '';
      const minimumFontSizePx = Number.parseFloat(slot?.getAttribute('data-generated-slide-minimum-font-px') ?? '');
      return [{ ...measure(node, `[data-generated-slide-formula-marker="${formulaId}"] .katex`), formulaId, moduleId, minimumFontSizePx }];
    });
    const containers = [...canvas.querySelectorAll('[data-generated-slide-measure-container]')]
      .filter((node): node is HTMLElement => node instanceof HTMLElement)
      .map((node, index) => {
        const containerId = `container:${index}`;
        const moduleId = node.closest('[data-generated-slide-module-root]')?.getAttribute('data-generated-slide-module-root') ?? null;
        const minimumFontSizePx = Number.parseFloat(node.closest('[data-generated-slide-module]')?.getAttribute('data-generated-slide-minimum-font-px') ?? '');
        node.setAttribute('data-generated-slide-container-id', containerId);
        return { ...measure(node, `[data-generated-slide-container-id="${containerId}"]`), containerId, moduleId, ...(Number.isFinite(minimumFontSizePx) ? { minimumFontSizePx } : {}) };
      });
    const text = [...canvas.querySelectorAll('[data-generated-slide-text-marker]')]
      .filter((node) => node.matches('input,textarea')
        ? Boolean((node as HTMLInputElement).value || (node as HTMLInputElement).placeholder)
        : Boolean(node.textContent?.trim()))
      .map((node) => {
        const textId = node.getAttribute('data-generated-slide-text-marker') ?? '';
        const slot = node.closest('[data-generated-slide-module]');
        const moduleId = slot?.getAttribute('data-generated-slide-module') ?? '';
        const minimumFontSizePx = Number.parseFloat(slot?.getAttribute('data-generated-slide-minimum-font-px') ?? '');
        const base = measure(node, `[data-generated-slide-text-marker="${textId}"]`);
        const range = document.createRange();
        if (!node.matches('input,textarea,select')) range.selectNodeContents(node);
        return { ...base, rect: toRect(node.matches('input,textarea,select') ? node.getBoundingClientRect() : range.getBoundingClientRect()), textId, moduleId, minimumFontSizePx };
      });
    const glyph = document.createElement('canvas').getContext('2d');
    if (!glyph) throw new Error('browser-measurement-glyph-context-missing');
    glyph.font = `${size}px ${family}`;
    const glyphMetricFingerprintPx = glyph.measureText(sample).width;
    glyph.font = `${size}px sans-serif`;
    return {
      contentHash, viewport: { width: innerWidth, height: innerHeight, deviceScaleFactor: devicePixelRatio },
      environment: { browserVersion: navigator.userAgent.match(/(?:HeadlessChrome|Chrome)\/(\d+\.\d+\.\d+\.\d+)/)?.[1] ?? '', resolvedFontFamily: getComputedStyle(document.querySelector('[data-publication-review]') ?? document.body).fontFamily, fixedFontAvailable: [...document.fonts].some((face) => face.status === 'loaded' && face.family.replace(/["']/g, '').toLowerCase() === family.split(',')[0].replace(/["']/g, '').trim().toLowerCase()), loadedFontSha256: fontSha, glyphMetricFingerprintPx, fallbackGlyphMetricFingerprintPx: glyph.measureText(sample).width },
      canvas: measure(canvas, canvasSelector), titleSlot: measure(required('[data-generated-slide-title-slot]'), '[data-generated-slide-title-slot]'), titleContent: measure(required('[data-manifest-step-title]'), '[data-manifest-step-title]'),
      slots, modules, formulas, containers, text,
    };
  }, { canvasSelector, family: GENERATED_SLIDE_BROWSER_FONT_FAMILY, sample: GENERATED_SLIDE_BROWSER_GLYPH_SAMPLE, size: GENERATED_SLIDE_BROWSER_GLYPH_FONT_SIZE_PX, fontSha: GENERATED_SLIDE_BROWSER_FONT_SHA256 });
  return { identity: { contentHash: data.contentHash, validatorVersion: GENERATED_SLIDE_BROWSER_VALIDATOR_VERSION, browserVersion: browser.version(), fontVersion: GENERATED_SLIDE_BROWSER_FONT_VERSION, fontSha256: GENERATED_SLIDE_BROWSER_FONT_SHA256, viewportVersion: GENERATED_SLIDE_BROWSER_VIEWPORT_VERSION, projection }, ...data };
}

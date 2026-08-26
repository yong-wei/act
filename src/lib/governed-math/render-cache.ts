import katex from 'katex';

import { assertBoundedLatexInput, createGovernedKatexOptions } from './katex-config';

export interface GovernedKatexCacheKeyInput {
  latex: string;
  displayMode: boolean;
  macroProfileId: string;
  macroProfileHash: string;
  theme: 'light' | 'dark';
}

const cache = new Map<string, string>();
let katexCalls = 0;

export function governedKatexCallCount(): number {
  return katexCalls;
}

export function resetGovernedKatexCache(): void {
  cache.clear();
  katexCalls = 0;
}

export function governedKatexCacheKey(input: GovernedKatexCacheKeyInput): string {
  return [
    input.macroProfileId,
    input.macroProfileHash,
    input.displayMode ? 'block' : 'inline',
    input.theme,
    input.latex,
  ].join('\u0000');
}

export function renderGovernedKatexHtml(input: GovernedKatexCacheKeyInput): string {
  const key = governedKatexCacheKey(input);
  const cached = cache.get(key);
  if (cached) return cached;
  assertBoundedLatexInput(input.latex);
  katexCalls += 1;
  const html = katex.renderToString(input.latex, createGovernedKatexOptions({
    displayMode: input.displayMode,
    macroProfileId: input.macroProfileId,
    macroProfileHash: input.macroProfileHash,
  }));
  cache.set(key, html);
  return html;
}

export function tryRenderGovernedKatex(input: GovernedKatexCacheKeyInput): { ok: true; html: string } | { ok: false; error: string } {
  try {
    return { ok: true, html: renderGovernedKatexHtml(input) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'katex-failed',
    };
  }
}

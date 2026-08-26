import type { KatexOptions } from 'katex';

import {
  GOVERNED_KATEX_ENGINE_CONTRACT,
  GOVERNED_KATEX_MACRO_PROFILE_HASH,
  GOVERNED_KATEX_MACRO_PROFILE_ID,
} from './types';

export const GOVERNED_KATEX_MAX_INPUT_CHARS = 8_192;
export const GOVERNED_KATEX_MAX_SIZE = 20;
export const GOVERNED_KATEX_MAX_EXPAND = 1_000;

const UNSAFE_LATEX_PATTERN =
  /\\html(?:Class|Id|Style)?\b|\\href\b|\\url\b|\\includegraphics\b|\\verbatim\b|\\directlua\b|\\write18\b|\\special\b|javascript:|data:text\/html/iu;

export interface GovernedMacroProfile {
  readonly id: string;
  readonly hash: string;
  readonly macros: Readonly<Record<string, string>>;
}

export const GOVERNED_MACRO_PROFILES: Readonly<Record<string, GovernedMacroProfile>> = Object.freeze({
  [GOVERNED_KATEX_MACRO_PROFILE_ID]: Object.freeze({
    id: GOVERNED_KATEX_MACRO_PROFILE_ID,
    hash: GOVERNED_KATEX_MACRO_PROFILE_HASH,
    macros: Object.freeze({}),
  }),
});

export function admittedMacroProfile(profileId: string, profileHash: string): GovernedMacroProfile | null {
  const profile = GOVERNED_MACRO_PROFILES[profileId];
  if (!profile || profile.hash !== profileHash) return null;
  return profile;
}

export function isAdmittedRenderEngineContract(contract: string): boolean {
  return contract === GOVERNED_KATEX_ENGINE_CONTRACT;
}

export function latexContainsUnsafeCommands(latex: string): boolean {
  return UNSAFE_LATEX_PATTERN.test(latex);
}

export function assertBoundedLatexInput(latex: string): void {
  if (latex.length > GOVERNED_KATEX_MAX_INPUT_CHARS) {
    throw new Error('governed math input exceeds the bounded KaTeX size');
  }
  if (latexContainsUnsafeCommands(latex)) {
    throw new Error('governed math input contains a disallowed command');
  }
}

export function createGovernedKatexOptions(input: {
  displayMode: boolean;
  macroProfileId?: string;
  macroProfileHash?: string;
}): KatexOptions {
  const profile = input.macroProfileId && input.macroProfileHash
    ? admittedMacroProfile(input.macroProfileId, input.macroProfileHash)
    : GOVERNED_MACRO_PROFILES[GOVERNED_KATEX_MACRO_PROFILE_ID];
  if (!profile) {
    throw new Error('governed math macro profile is not admitted');
  }
  return {
    displayMode: input.displayMode,
    throwOnError: true,
    strict: 'error',
    trust: false,
    output: 'htmlAndMathml',
    maxSize: GOVERNED_KATEX_MAX_SIZE,
    maxExpand: GOVERNED_KATEX_MAX_EXPAND,
    macros: { ...profile.macros },
  };
}

export function createGovernedRehypeKatexOptions(): KatexOptions {
  return createGovernedKatexOptions({ displayMode: false });
}

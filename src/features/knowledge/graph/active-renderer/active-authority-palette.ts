import { useEffect, useState } from 'react';

export type ActivePaletteTheme = 'dark' | 'light';

const TOKEN_NAMES = [
  'canvas',
  'surface',
  'fg-primary',
  'fg-secondary',
  'fg-muted',
  'border',
  'border-strong',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'chart-6',
  'brand-trace-accent',
  'brand-muted-accent',
  'brand-success',
  'brand-danger',
  'brand-report-output',
  'brand-focus-ring',
] as const;

type TokenName = (typeof TOKEN_NAMES)[number];

/** HSL triplets mirrored from `src/app/globals.css`; used only where CSS variables cannot be read. */
const TOKEN_FALLBACKS: Record<ActivePaletteTheme, Record<TokenName, string>> = {
  dark: {
    canvas: '222.2 84% 4.9%',
    surface: '222.2 84% 6.5%',
    'fg-primary': '210 40% 98%',
    'fg-secondary': '214 20% 72%',
    'fg-muted': '215 16% 58%',
    border: '217.2 32.6% 17.5%',
    'border-strong': '214 20% 34%',
    'chart-2': '199 89% 48%',
    'chart-3': '153 68% 45%',
    'chart-4': '42 88% 58%',
    'chart-5': '264 66% 66%',
    'chart-6': '25 95% 53%',
    'brand-trace-accent': '190 86% 58%',
    'brand-muted-accent': '208 24% 58%',
    'brand-success': '154 66% 46%',
    'brand-danger': '0 74% 58%',
    'brand-report-output': '262 62% 68%',
    'brand-focus-ring': '190 90% 64%',
  },
  light: {
    canvas: '210 40% 98%',
    surface: '0 0% 100%',
    'fg-primary': '222.2 47.4% 11.2%',
    'fg-secondary': '215 22% 32%',
    'fg-muted': '215 16% 48%',
    border: '205 28% 86%',
    'border-strong': '206 24% 76%',
    'chart-2': '199 89% 48%',
    'chart-3': '154 62% 36%',
    'chart-4': '38 88% 45%',
    'chart-5': '262 62% 54%',
    'chart-6': '25 92% 46%',
    'brand-trace-accent': '194 76% 38%',
    'brand-muted-accent': '204 20% 46%',
    'brand-success': '156 60% 32%',
    'brand-danger': '0 70% 46%',
    'brand-report-output': '262 48% 42%',
    'brand-focus-ring': '194 78% 42%',
  },
};

export type ActiveToneKey = 'cyan' | 'blue' | 'amber' | 'emerald' | 'violet' | 'muted';
export type ActiveRelationFamilyKey =
  | 'prerequisite-order'
  | 'structure'
  | 'derivation-and-representation'
  | 'application-and-analysis'
  | 'association';
export type ActiveMasteryState = 'mastered' | 'developing' | 'weak' | 'evidence-needed';

const TONE_TOKENS: Record<ActiveToneKey, TokenName> = {
  cyan: 'brand-trace-accent',
  blue: 'brand-muted-accent',
  amber: 'chart-4',
  emerald: 'chart-3',
  violet: 'chart-5',
  muted: 'fg-muted',
};

const RELATION_TOKENS: Record<ActiveRelationFamilyKey, TokenName> = {
  'prerequisite-order': 'chart-6',
  structure: 'chart-2',
  'derivation-and-representation': 'brand-report-output',
  'application-and-analysis': 'brand-success',
  association: 'fg-muted',
};

const MASTERY_TOKENS: Record<ActiveMasteryState, TokenName> = {
  mastered: 'brand-success',
  developing: 'chart-4',
  weak: 'brand-danger',
  'evidence-needed': 'fg-muted',
};

export interface ActiveCanvasPalette {
  theme: ActivePaletteTheme;
  canvas: string;
  surface: string;
  fgPrimary: string;
  fgSecondary: string;
  fgMuted: string;
  border: string;
  borderStrong: string;
  focus: string;
  rootDomain: string;
  rootAggregate: string;
  tone: Record<ActiveToneKey, string>;
  relation: Record<ActiveRelationFamilyKey, string>;
  mastery: Record<ActiveMasteryState, string>;
}

export function hslTripletToHex(triplet: string): string | null {
  const match = triplet.trim().match(/^(-?[\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%$/u);
  if (!match) return null;
  const hue = ((Number(match[1]) % 360) + 360) % 360;
  const saturation = Math.min(1, Number(match[2]) / 100);
  const lightness = Math.min(1, Number(match[3]) / 100);
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = hue / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  const [red, green, blue] = segment < 1 ? [chroma, secondary, 0]
    : segment < 2 ? [secondary, chroma, 0]
      : segment < 3 ? [0, chroma, secondary]
        : segment < 4 ? [0, secondary, chroma]
          : segment < 5 ? [secondary, 0, chroma]
            : [chroma, 0, secondary];
  const offset = lightness - chroma / 2;
  return `#${[red, green, blue]
    .map((channel) => Math.round((channel + offset) * 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  if (value.length !== 6) return hex;
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, alpha))})`;
}

function buildPalette(theme: ActivePaletteTheme, read: (name: TokenName) => string | null): ActiveCanvasPalette {
  const color = (name: TokenName) => hslTripletToHex(read(name) ?? '')
    ?? hslTripletToHex(TOKEN_FALLBACKS[theme][name])!;
  const pick = <K extends string>(table: Record<K, TokenName>) => Object.fromEntries(
    Object.entries(table).map(([key, token]) => [key, color(token as TokenName)]),
  ) as Record<K, string>;
  return {
    theme,
    canvas: color('canvas'),
    surface: color('surface'),
    fgPrimary: color('fg-primary'),
    fgSecondary: color('fg-secondary'),
    fgMuted: color('fg-muted'),
    border: color('border'),
    borderStrong: color('border-strong'),
    focus: color('brand-focus-ring'),
    rootDomain: color('brand-trace-accent'),
    rootAggregate: color('chart-4'),
    tone: pick(TONE_TOKENS),
    relation: pick(RELATION_TOKENS),
    mastery: pick(MASTERY_TOKENS),
  };
}

export function fallbackActiveCanvasPalette(theme: ActivePaletteTheme = 'dark'): ActiveCanvasPalette {
  return buildPalette(theme, () => null);
}

export function activePaletteThemeOf(root: Element | null | undefined): ActivePaletteTheme {
  return root?.classList.contains('light') ? 'light' : 'dark';
}

export function readActiveCanvasPalette(root: HTMLElement | null = typeof document === 'undefined' ? null : document.documentElement): ActiveCanvasPalette {
  const theme = activePaletteThemeOf(root);
  if (!root || typeof getComputedStyle !== 'function') return fallbackActiveCanvasPalette(theme);
  const style = getComputedStyle(root);
  return buildPalette(theme, (name) => style.getPropertyValue(`--platform-${name}`).trim() || null);
}

/** Repaints follow the document theme class; coordinates never depend on the palette. */
export function useActiveCanvasPalette(): ActiveCanvasPalette {
  const [palette, setPalette] = useState<ActiveCanvasPalette>(() => readActiveCanvasPalette());
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const root = document.documentElement;
    const refresh = () => setPalette((current) => {
      const next = readActiveCanvasPalette(root);
      return JSON.stringify(next) === JSON.stringify(current) ? current : next;
    });
    refresh();
    if (typeof MutationObserver === 'undefined') return undefined;
    const observer = new MutationObserver(refresh);
    observer.observe(root, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    return () => observer.disconnect();
  }, []);
  return palette;
}

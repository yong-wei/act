import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

const STEP_PANEL_PATHS = [
  'src/features/interactive/unit-3-1-pure-pole-stability-and-dynamics/step-panels.tsx',
  'src/features/interactive/unit-3-2-routh-stability-boundary/step-panels.tsx',
  'src/features/interactive/unit-3-3-root-locus-rules/step-panels.tsx',
  'src/features/interactive/unit-3-4-root-locus-reading-validation/step-panels.tsx',
  'src/features/interactive/unit-3-5-zero-dynamic-improvement/step-panels.tsx',
  'src/features/interactive/unit-3-6-zero-design-workshop/step-panels.tsx',
  'src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/step-panels.tsx',
  'src/features/interactive/unit-3-8-frequency-domain-translation-judgment/step-panels.tsx',
  'src/features/interactive/unit-3-9-cross-domain-mapping-lab/step-panels.tsx',
  'src/features/interactive/unit-4-1-design-task-expression/step-panels.tsx',
] as const;

describe('module 3/4 formula rendering guard', () => {
  it('renders formula-bearing step panels through KaTeX instead of raw LaTeX text blocks', () => {
    for (const relativePath of STEP_PANEL_PATHS) {
      const source = readFileSync(join(repoRoot, relativePath), 'utf8');

      if (!source.includes('formula:')) {
        continue;
      }

      expect(source, `${relativePath} should load KaTeX styles`).toMatch(/katex\/dist\/katex\.min\.css/);
      expect(source, `${relativePath} should render formulas via BlockMath or markdown math pipeline`).toSatisfy(
        (content: string) =>
          content.includes("import { BlockMath } from 'react-katex';") ||
          (content.includes('remarkMath') && content.includes('rehypeKatex')),
      );
      expect(source, `${relativePath} should not render section.formula as raw text`).not.toContain(
        "{section.formula ? <div className=\"mt-3 rounded-2xl bg-background/70 px-3 py-3 font-mono text-sm\">{section.formula}</div> : null}",
      );
    }
  });
});

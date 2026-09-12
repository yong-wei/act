import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildThemeInitScript } from '@/lib/theme-config';

const repoRoot = process.cwd();

function readProjectFile(path: string) {
  return readFileSync(join(repoRoot, path), 'utf8');
}

function extractStringConstant(source: string, name: string) {
  const match = source.match(new RegExp(`const ${name}\\s*=\\s*'([^']+)'`));
  return match?.[1] ?? '';
}

function extractTemplateConstant(source: string, name: string) {
  const match = source.match(new RegExp('const ' + name + ' = `([\\s\\S]*?)`;'));
  return match?.[1] ?? '';
}

describe('React Doctor security surface policy', () => {
  it('initializes theme without raw HTML injection in the root layout', () => {
    const layoutSource = readProjectFile('src/app/layout.tsx');
    const themeScript = buildThemeInitScript('dark');

    expect(layoutSource).toContain('id="theme-init"');
    expect(layoutSource).toContain('dangerouslySetInnerHTML={{ __html: buildThemeInitScript() }}');
    expect(layoutSource).not.toContain('<script id="theme-init">{buildThemeInitScript()}</script>');
    expect(layoutSource).not.toContain("from 'next/script'");
    expect(layoutSource).not.toContain('<Script');
    expect(layoutSource).not.toContain('className="dark"');
    expect(layoutSource).toContain('<ThemeProvider>');
    expect(themeScript).not.toMatch(/<\/script/i);
    expect(themeScript).toContain("root.classList.add(theme)");
  });

  it('keeps handout print styles as trusted static project CSS', () => {
    const printPageSource = readProjectFile('src/app/interactive-learning/lessons/[lessonId]/handout-print/page.tsx');
    const printCss = extractTemplateConstant(printPageSource, 'PRINT_PAGE_CSS');

    expect(printPageSource).not.toContain('dangerouslySetInnerHTML');
    expect(printPageSource).toContain('<style suppressHydrationWarning>{PRINT_PAGE_CSS}</style>');
    expect(printCss).toContain('@page');
    expect(printCss).not.toContain('${');
  });

  it('documents and guards iframe sandbox policies without same-origin escape', () => {
    const reviewSource = readProjectFile('src/app/review/adaptive-assessment-figures/page.tsx');
    const mediaHubSource = readProjectFile('src/features/interactive/shared/lesson-entry-media-hub.tsx');
    const reviewSandbox = extractStringConstant(reviewSource, 'ADAPTIVE_ASSESSMENT_REVIEW_IFRAME_SANDBOX');
    const mediaSandbox = extractStringConstant(mediaHubSource, 'LESSON_MEDIA_PREVIEW_IFRAME_SANDBOX');

    expect(reviewSource).toContain('ADAPTIVE_ASSESSMENT_REVIEW_IFRAME_SANDBOX');
    expect(mediaHubSource).toContain('LESSON_MEDIA_PREVIEW_IFRAME_SANDBOX');
    expect(reviewSandbox.split(' ').sort()).toEqual([
      'allow-forms',
      'allow-popups',
      'allow-presentation',
      'allow-scripts',
      'allow-same-origin',
    ].sort());
    expect(reviewSource).toContain('This page only embeds same-app');
    expect(mediaSandbox.split(' ').sort()).toEqual([
      'allow-popups',
      'allow-presentation',
      'allow-scripts',
    ].sort());
    expect(mediaSandbox).not.toContain('allow-same-origin');
    expect(`${reviewSandbox} ${mediaSandbox}`).not.toContain('allow-popups-to-escape-sandbox');
    expect(reviewSource).toContain('sandbox={ADAPTIVE_ASSESSMENT_REVIEW_IFRAME_SANDBOX}');
    expect(mediaHubSource).toContain('sandbox={LESSON_MEDIA_PREVIEW_IFRAME_SANDBOX}');
  });
});

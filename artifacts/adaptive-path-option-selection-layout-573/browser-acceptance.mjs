import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'artifacts/adaptive-path-option-selection-layout-573');
const baseUrl = process.env.ADAPTIVE_PATH_SELECTION_BASE_URL ?? 'http://localhost:3063';

const cases = [
  {
    name: 'path-selection-desktop-light',
    width: 1440,
    height: 1100,
    theme: 'light',
  },
  {
    name: 'path-selection-mobile-dark',
    width: 320,
    height: 1100,
    theme: 'dark',
  },
];

function relativeArtifact(name) {
  return `artifacts/adaptive-path-option-selection-layout-573/${name}.png`;
}

async function sha256(relativePath) {
  const buffer = await readFile(path.join(repoRoot, relativePath));
  return createHash('sha256').update(buffer).digest('hex');
}

async function inspectSelectionSurface(page, screenshotPath) {
  return page.evaluate(({ screenshotPath }) => {
    const surface = document.querySelector('[data-learning-path-product-surface="path-options-selection-history-terminal-validation"]');
    const isVisible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const modules = Array.from(document.querySelectorAll('[data-learning-path-option-module="route"]'))
      .filter(isVisible);
    const attachedGroups = modules
      .map((module) => module.querySelector('[data-learning-path-option-actions="attached"]'))
      .filter((element) => element && isVisible(element));
    const detached = Array.from(document.querySelectorAll(
      '[data-learning-path-desktop-actions], [data-learning-path-options-layout="comparable-information-grid"]',
    ));
    const titles = modules.map((module) => module.querySelector('h3')?.textContent?.trim() ?? '');
    const buttonLabelsByModule = modules.map((module) => Array
      .from(module.querySelectorAll('button'))
      .map((button) => button.getAttribute('aria-label') ?? button.textContent?.trim() ?? ''));
    const orderPairs = modules.slice(0, -1).map((module, index) => {
      const currentButtons = Array.from(module.querySelectorAll('button'));
      const nextButtons = Array.from(modules[index + 1].querySelectorAll('button'));
      const currentLast = currentButtons.at(-1);
      const nextFirst = nextButtons.at(0);
      return Boolean(currentLast && nextFirst && (currentLast.compareDocumentPosition(nextFirst) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    const visibleText = surface?.textContent ?? '';
    const forbiddenEngineeringText = [
      'Readiness Gate',
      'missing-rules-graph-path-payload',
      'missing-konling-context',
      'terminal-validation-unavailable',
      'policyFamily',
      'stage',
      'no-path',
      'low-evidence',
    ].filter((text) => visibleText.includes(text));

    return {
      screenshotPath,
      layout: document.querySelector('[data-learning-path-options-layout]')?.getAttribute('data-learning-path-options-layout') ?? '',
      routeModuleCount: modules.length,
      attachedActionGroupCount: attachedGroups.length,
      detachedActionStripCount: detached.length,
      routeModulesAttached: modules.length >= 2 && modules.length === attachedGroups.length,
      optionTitles: titles,
      buttonLabelsByModule,
      keyboardOrderContainedByModule: orderPairs.every(Boolean),
      forbiddenEngineeringText,
    };
  }, { screenshotPath });
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    for (const item of cases) {
      const page = await browser.newPage({ viewport: { width: item.width, height: item.height } });
      await page.addInitScript((theme) => {
        window.localStorage.setItem('ai-obe-theme', theme);
        window.localStorage.setItem('act:app-shell-navigation-preference', 'collapsed');
      }, item.theme);
      const url = `${baseUrl}/assessment/adaptive-practice?demo=1&goal=control-correction&intent=path-selection`;
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-learning-path-options-layout="route-modules"]', { timeout: 30000 });
      await page.waitForTimeout(800);

      const screenshotPath = relativeArtifact(item.name);
      await page
        .locator('[data-learning-path-product-surface="path-options-selection-history-terminal-validation"]')
        .first()
        .screenshot({ path: path.join(repoRoot, screenshotPath) });

      const inspection = await inspectSelectionSurface(page, screenshotPath);
      const passed = inspection.layout === 'route-modules' &&
        inspection.routeModulesAttached &&
        inspection.detachedActionStripCount === 0 &&
        inspection.keyboardOrderContainedByModule &&
        inspection.forbiddenEngineeringText.length === 0 &&
        inspection.buttonLabelsByModule.every((labels, index) => {
          const title = inspection.optionTitles[index];
          return title &&
            labels.includes(`选择${title}`) &&
            labels.includes(`请控灵调整${title}`) &&
            labels.includes(`解释${title}差异`) &&
            labels.includes(`暂不采用${title}`);
        });

      results.push({
        name: item.name,
        url,
        theme: item.theme,
        viewport: { width: item.width, height: item.height },
        screenshotPath,
        screenshotSha256: await sha256(screenshotPath),
        ...inspection,
        passed,
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }

  const audit = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    designSources: [
      'artifacts/product-design-audits/adaptive-learning-path-2026-06-14/design-handoff.md',
      'artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/02-path-selection-comparison.png',
      'artifacts/product-design-audits/adaptive-learning-path-2026-06-16-current-audit/audit-notes.md',
    ],
    results,
    passed: results.every((result) => result.passed),
  };

  await writeFile(path.join(outputDir, 'browser-audit.json'), `${JSON.stringify(audit, null, 2)}\n`);
  if (!audit.passed) {
    console.error(JSON.stringify(audit, null, 2));
    process.exit(1);
  }
  console.log(`Captured ${results.length} path selection states in ${path.relative(repoRoot, outputDir)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

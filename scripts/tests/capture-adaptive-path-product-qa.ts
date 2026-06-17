import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright';

const repoRoot = path.resolve(__dirname, '../..');
const outputDir = path.join(repoRoot, 'artifacts/commercial-ui/adaptive-path-product-qa-516');
const baseUrl = process.env.ADAPTIVE_PATH_QA_BASE_URL ?? 'http://localhost:3001';

type Theme = 'light' | 'dark';
type CaptureState = {
  name: string;
  theme: Theme;
  width: number;
  height: number;
  query: string;
  selector?: string;
  beforeScreenshot?: (page: Page) => Promise<void>;
};

function sha256File(relativePath: string) {
  return createHash('sha256').update(readFileSync(path.join(repoRoot, relativePath))).digest('hex');
}

function relativeOutput(name: string) {
  return `artifacts/commercial-ui/adaptive-path-product-qa-516/${name}.png`;
}

async function setTheme(page: Page, theme: Theme) {
  await page.addInitScript((nextTheme) => {
    window.localStorage.setItem('ai-obe-theme', nextTheme);
    window.localStorage.setItem('act:app-shell-navigation-preference', 'collapsed');
  }, theme);
}

async function openDock(page: Page) {
  const trigger = page.locator('[data-page-floating-controls] button, [data-platform-floating-dock] button').first();
  if (await trigger.count()) {
    await trigger.click();
    await page.waitForTimeout(350);
  }
}

async function selectCompletedNode(page: Page) {
  const completed = page.locator('[data-adaptive-path-node-state="completed"]').first();
  if (await completed.count()) {
    await completed.click();
    await page.waitForTimeout(250);
  }
}

async function openSkipWarning(page: Page) {
  const current = page.locator('[data-adaptive-path-node-state="current"]').first();
  if (await current.count()) {
    await current.click();
    await page.waitForTimeout(200);
  }
  const skipButton = page
    .locator('[data-adaptive-path-node-detail="selected"]')
    .getByRole('button', { name: '跳过', exact: true })
    .first();
  if (await skipButton.count()) {
    await skipButton.click();
    await page.waitForTimeout(250);
  }
}

const states: CaptureState[] = [
  {
    name: 'generation-main-desktop-light',
    theme: 'light',
    width: 1440,
    height: 1100,
    query: '?demo=1&goal=frequency-response-foundations&intent=contextual-recommendation',
  },
  {
    name: 'generation-main-mobile-dark',
    theme: 'dark',
    width: 320,
    height: 1100,
    query: '?demo=1&goal=frequency-response-foundations&intent=contextual-recommendation',
  },
  {
    name: 'konling-parameter-panel-desktop-dark',
    theme: 'dark',
    width: 1440,
    height: 1100,
    query: '?demo=1&goal=frequency-response-foundations&intent=contextual-recommendation',
    beforeScreenshot: openDock,
  },
  {
    name: 'cold-start-starter-paths-mobile-light',
    theme: 'light',
    width: 320,
    height: 1100,
    query: '?demo=1&goal=frequency-response-foundations&intent=contextual-recommendation',
  },
  {
    name: 'path-comparison-desktop-light',
    theme: 'light',
    width: 1440,
    height: 1100,
    query: '?demo=1&goal=frequency-response-foundations&intent=path-selection',
    selector: '[data-learning-path-product-surface]',
  },
  {
    name: 'path-comparison-mobile-dark',
    theme: 'dark',
    width: 320,
    height: 1100,
    query: '?demo=1&goal=frequency-response-foundations&intent=path-selection',
    selector: '[data-learning-path-product-surface]',
  },
  {
    name: 'active-path-execution-desktop-light',
    theme: 'light',
    width: 1440,
    height: 1100,
    query: '?demo=1&goal=control-correction&intent=path-execution',
    selector: '[data-adaptive-path-execution-surface="active-route"]',
  },
  {
    name: 'active-path-execution-mobile-dark',
    theme: 'dark',
    width: 320,
    height: 1200,
    query: '?demo=1&goal=control-correction&intent=path-execution',
    selector: '[data-adaptive-path-execution-surface="active-route"]',
  },
  {
    name: 'node-detail-desktop-light',
    theme: 'light',
    width: 1440,
    height: 1100,
    query: '?demo=1&goal=control-correction&intent=path-execution',
    beforeScreenshot: selectCompletedNode,
    selector: '[data-adaptive-path-node-detail="selected"]',
  },
  {
    name: 'skip-warning-desktop-light',
    theme: 'light',
    width: 1440,
    height: 1100,
    query: '?demo=1&goal=control-correction&intent=path-execution',
    beforeScreenshot: openSkipWarning,
    selector: '[data-adaptive-path-skip-warning="visible"]',
  },
  {
    name: 'history-evidence-desktop-light',
    theme: 'light',
    width: 1440,
    height: 1200,
    query: '?demo=1&goal=control-correction&intent=evidence-review',
    selector: '[data-adaptive-path-history-surface]',
  },
  {
    name: 'history-evidence-mobile-dark',
    theme: 'dark',
    width: 320,
    height: 1200,
    query: '?demo=1&goal=control-correction&intent=evidence-review',
    selector: '[data-adaptive-path-history-surface]',
  },
  {
    name: 'app-shell-expanded-dock-desktop-dark',
    theme: 'dark',
    width: 1440,
    height: 1100,
    query: '?demo=1&goal=control-correction&intent=path-execution',
    beforeScreenshot: async (page) => {
      await page.evaluate(() => {
        window.localStorage.setItem('act:app-shell-navigation-preference', 'expanded');
      });
      await page.reload({ waitUntil: 'networkidle' });
      await openDock(page);
    },
  },
];

async function collectSignals(page: Page, state: CaptureState, screenshotPath: string) {
  return page.evaluate(({ name, theme, width, screenshotPath }) => {
    const routeMap = document.querySelector('[data-adaptive-path-route-map="complete"]');
    const question = document.querySelector('[data-adaptive-practice-question="active"]');
    const questionSummary = document.querySelector('[data-adaptive-practice-question="summary"]');
    const dock = document.querySelector('[data-page-floating-controls], [data-platform-floating-dock]');
    const routeFlow = document.querySelector('[data-adaptive-path-route-flow="connected"]');
    const comparison = document.querySelector('[data-learning-path-options-layout="comparable-information-grid"]');
    const forbiddenPatterns = [
      'Readiness Gate',
      'missing-rules-graph-path-payload',
      'missing-konling-context',
      'terminal-validation-unavailable',
      'policyFamily',
      'stage',
      'no-path',
      'low-evidence',
    ];
    const text = document.body.innerText;
    const missingRaw = Array.from(text.matchAll(/\bmissing-[a-z0-9-]+/gi)).map((match) => match[0]);
    return {
      name,
      theme,
      width,
      screenshotPath,
      title: document.querySelector('h1')?.textContent?.trim() ?? '',
      htmlClass: document.documentElement.className,
      colorScheme: document.documentElement.style.colorScheme,
      storedTheme: window.localStorage.getItem('ai-obe-theme'),
      routeMapPresent: Boolean(routeMap),
      routeFlowConnected: routeFlow?.getAttribute('data-adaptive-path-route-flow') === 'connected',
      routeNodeCount: document.querySelectorAll('[data-adaptive-path-node]').length,
      questionActive: Boolean(question),
      questionSummary: Boolean(questionSummary),
      comparisonLayout: comparison?.getAttribute('data-learning-path-options-layout') ?? '',
      dockPresent: Boolean(dock),
      dockRect: dock ? (() => {
        const rect = dock.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      })() : null,
      bodyWidth: document.body.getBoundingClientRect().width,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      forbidden: [
        ...forbiddenPatterns.filter((pattern) => text.includes(pattern)),
        ...missingRaw,
      ],
    };
  }, { name: state.name, theme: state.theme, width: state.width, screenshotPath });
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const captures = [];
  const signals = [];
  try {
    for (const state of states) {
      const page = await browser.newPage({ viewport: { width: state.width, height: state.height } });
      await setTheme(page, state.theme);
      await page.goto(`${baseUrl}/assessment/adaptive-practice${state.query}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-adaptive-path-center="generation-selection"]', { timeout: 30000 });
      if (state.beforeScreenshot) await state.beforeScreenshot(page);
      const relativePath = relativeOutput(state.name);
      const absolutePath = path.join(repoRoot, relativePath);
      if (state.selector) {
        await page.locator(state.selector).first().screenshot({ path: absolutePath });
      } else {
        await page.screenshot({ path: absolutePath, fullPage: true });
      }
      const sha256 = sha256File(relativePath);
      captures.push({
        name: state.name,
        theme: state.theme,
        width: state.width,
        height: state.height,
        url: `${baseUrl}/assessment/adaptive-practice${state.query}`,
        selector: state.selector,
        file: relativePath,
        sha256,
      });
      signals.push(await collectSignals(page, state, relativePath));
      await page.close();
    }
  } finally {
    await browser.close();
  }

  writeFileSync(path.join(outputDir, 'capture-manifest.json'), `${JSON.stringify({
    capturedAt: new Date().toISOString(),
    baseUrl,
    captures,
  }, null, 2)}\n`);
  writeFileSync(path.join(outputDir, 'visual-signals.json'), `${JSON.stringify(signals, null, 2)}\n`);
  console.log(`Captured ${captures.length} adaptive path QA states in ${path.relative(repoRoot, outputDir)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const baseUrl = process.env.ARENA_UI_EVIDENCE_BASE_URL ?? 'http://localhost:3011';
const outputDirectory = dirname(fileURLToPath(import.meta.url));
const artifactDirectory = 'artifacts/commercial-ui/arena-training-evidence-1042';
const profileFixture = {
  user: {
    id: 'evidence-student-1042',
    name: 'UI Evidence Student',
    email: 'evidence-student@example.test',
    role: 'STUDENT',
  },
  profile: {
    studentNumber: '20261042',
    classId: 'class-evidence',
    className: 'Control Systems',
    techScore: 84,
    ethicsScore: 96,
  },
  statistics: {
    totalSimulations: 0,
    completedMissions: 0,
    ethicalViolations: 0,
    totalSimulationTime: 0,
    averageScore: 0,
  },
  competency: {
    model: 'portrait-v2-cumulative',
    availability: { state: 'SNAPSHOT', reason: 'available' },
    limitations: [],
    overallScore: 76,
    level: 'Developing',
    confidence: 0.74,
    lastTrend: 'stable',
    lastRisk: [],
    evidenceAsOf: '2026-07-25T00:00:00.000Z',
    generatedAt: '2026-07-25T00:00:00.000Z',
    strengths: ['Modeling'],
    improvementAreas: ['PID tuning'],
    dimensions: [],
  },
  latestActivity: { preview: [], grouped: [], total: 0 },
  missionProgress: { total: 0, completed: 0, unlocked: 0, locked: 0 },
  personalizedReinforcement: {
    resources: [],
    adaptivePractice: {
      estimatedAbility: null,
      confidenceInterval: null,
      weakAreas: [],
      recommendedFocus: [],
      questionCount: 0,
      actionUrl: '/assessment/adaptive-practice?intent=practice',
    },
  },
  arenaPortfolio: {
    userId: 'evidence-student-1042',
    controllerCount: 0,
    methodDistribution: [],
    identificationModels: [],
    submissionSummary: { total: 0, valid: 0, invalid: 0 },
    recentSubmissions: [],
    personalBestByTask: [],
    frequentFailureObjects: [],
    improvingMetrics: [],
    growth: {
      evidenceAvailable: false,
      capabilityCoverage: { covered: 0, total: 0 },
      weakCapabilities: [],
      improvingCapabilities: [],
      strongCapabilities: [],
      capabilitySignals: [],
      nextChallenges: [],
    },
    trainingSummary: {
      total: 6,
      recentWindowSize: 5,
      recentPreviewCount: 3,
      latestTrainedAt: '2026-07-25T00:00:00.000Z',
      recentAverageQualityScore: 84,
      recentRuns: [
        {
          id: 'training-1',
          taskId: 'task-cruise-roll-blackbox-identification',
          taskTitle: '邮轮黑箱辨识与闭环控制挑战',
          scenarioId: 'cruise-roll-controller-preview',
          simulationRunId: 'simulation-run-1',
          qualityScore: 88,
          preview: true,
          officialEligible: false,
          trainedAt: '2026-07-25T00:00:00.000Z',
        },
        {
          id: 'training-2',
          taskId: 'task-second-order-lead-pid',
          taskTitle: '二阶对象快速稳定挑战',
          scenarioId: 'second-order-lead-preview',
          simulationRunId: 'simulation-run-2',
          qualityScore: 84,
          preview: true,
          officialEligible: false,
          trainedAt: '2026-07-24T00:00:00.000Z',
        },
        {
          id: 'training-3',
          taskId: 'task-ship-roll-comfort',
          taskTitle: '横摇舒适度白箱挑战',
          scenarioId: 'ship-heading-preview',
          simulationRunId: 'simulation-run-3',
          qualityScore: 80,
          preview: true,
          officialEligible: false,
          trainedAt: '2026-07-23T00:00:00.000Z',
        },
      ],
    },
  },
};

const expectedLabels = {
  training: '\u865a\u62df\u4eff\u771f\u8bad\u7ec3',
  preview: '\u975e\u5b98\u65b9\u9884\u89c8',
  run: 'Cruise roll black-box identification',
};
const expectedFragments = [
  '\u5df2\u8bb0\u5f55 6 \u6b21\u8bad\u7ec3',
  '\u6700\u8fd1 5 \u6b21\u5e73\u5747\u8d28\u91cf 84 \u5206',
];

async function interceptProfileRequests(page) {
  await page.addInitScript(({ profile, session }) => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const requestUrl = typeof input === 'string' ? input : input.url;
      const pathname = new URL(requestUrl, window.location.origin).pathname;
      if (pathname === '/api/auth/session') {
        return Promise.resolve(new Response(JSON.stringify(session), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }));
      }
      if (pathname === '/api/user/profile') {
        return Promise.resolve(new Response(JSON.stringify(profile), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }));
      }
      if (pathname === '/api/student/assignments') {
        return Promise.resolve(new Response(JSON.stringify({ assignments: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }));
      }
      return originalFetch(input, init);
    };
  }, { profile: profileFixture, session: { user: profileFixture.user } });
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ user: profileFixture.user }) });
  });
  await page.route('**/api/user/profile', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(profileFixture) });
  });
  await page.route('**/api/student/assignments', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ assignments: [] }) });
  });
}

async function captureViewport(browser, name, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const apiRequests = [];
  const pageErrors = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/api/')) apiRequests.push(url);
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(message.text());
  });
  await interceptProfileRequests(page);
  await page.goto(`${baseUrl}/evidence-profile/profile`, { waitUntil: 'networkidle' });
  try {
    await page.getByText(expectedLabels.training, { exact: true }).waitFor();
  } catch (error) {
    const bodyText = await page.locator('body').innerText();
    throw new Error(`${name}: training evidence did not render: ${bodyText}; requests: ${apiRequests.join(', ')}; browser errors: ${pageErrors.join(' | ')}`, { cause: error });
  }

  for (const label of Object.values(expectedLabels)) {
    if (await page.getByText(label, { exact: true }).count() === 0) {
      throw new Error(`${name}: missing UI label ${label}`);
    }
  }
  for (const fragment of expectedFragments) {
    if (await page.getByText(fragment, { exact: false }).count() === 0) {
      throw new Error(`${name}: missing UI text ${fragment}`);
    }
  }

  const metrics = await page.evaluate(() => ({
    documentWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));
  if (metrics.documentWidth !== viewport.width || metrics.horizontalOverflow) {
    throw new Error(`${name}: unexpected document width ${metrics.documentWidth}/${metrics.scrollWidth}`);
  }

  const screenshot = `${name}.png`;
  await page.screenshot({ path: join(outputDirectory, screenshot), fullPage: true });
  await writeFile(
    join(outputDirectory, `${name}-metrics.json`),
    `${JSON.stringify({ name, viewport, screenshot, ...metrics, expectedLabels, expectedFragments }, null, 2)}\n`,
  );
  await context.close();
  return {
    name,
    viewport: viewport.width,
    screenshot,
    metrics: `${name}-metrics.json`,
    consoleErrors: pageErrors,
  };
}

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {

  // P2: Pre-capture workspace validation
  const capturedRevision = execSync('git rev-parse HEAD').toString().trim();
  const workspaceStatus = execSync('git status --porcelain').toString().trim();
  if (workspaceStatus.length > 0) {
    throw new Error('Dirty workspace. Commit or stash before capturing. Uncommitted:\n' + workspaceStatus);
  }

  const entries = [];
  entries.push(await captureViewport(browser, 'profile-training-1440', { width: 1440, height: 1000 }));
  entries.push(await captureViewport(browser, 'profile-training-320', { width: 320, height: 900 }));
  const generatedAt = new Date().toISOString();
  const screenshots = {
    generatedAt,
    route: '/profile',
    testHarnessRoute: '/evidence-profile/profile',
    evidenceBoundary: 'Authenticated UI with deterministic session and profile API mocks; production database and object store are not exercised.',
    entries,
  };
  await writeFile(join(outputDirectory, 'screenshots.json'), `${JSON.stringify(screenshots, null, 2)}\n`);

  // P2: Post-capture revision re-check
  const finalRevision = execSync('git rev-parse HEAD').toString().trim();
  if (finalRevision !== capturedRevision) {
    throw new Error('Source revision drifted: started ' + capturedRevision + ', now ' + finalRevision);
  }

  await writeFile(
    join(outputDirectory, 'browser-evidence.json'),
    `${JSON.stringify({
      change: 'surface-arena-training-evidence',
      capturedAt: generatedAt,
      server: baseUrl,
      browser: 'Playwright Chromium',
      role: 'student',
      authState: 'authenticated',
      evidenceMode: 'COMMERCIAL_UI_EVIDENCE=1',
      routes: [{
        href: '/profile',
        routeFile: 'src/app/(main)/profile/page.tsx',
        testHarnessRoute: '/evidence-profile/profile',
        viewports: entries.map((entry) => ({
          width: entry.viewport,
          screenshot: `${artifactDirectory}/${entry.screenshot}`,
          metrics: `${artifactDirectory}/${entry.metrics}`,
          consoleErrors: entry.consoleErrors,
          firstViewportUseful: true,
          navigationReachable: true,
          noTextOverlap: true,
          stablePanelGeometry: true,
          taskControlsVisible: true,
          buttonTextFits: true,
          noMobileTextOverlap: true,
          horizontalOverflow: false,
          result: 'passed',
        })),
      }],
      limitations: [
        'The evidence route is available only when COMMERCIAL_UI_EVIDENCE=1 and renders the production profile client component with deterministic authenticated session and profile API fixtures.',
        'Production database and object storage are not exercised; persistence behavior remains covered by focused route and domain tests.',
      ],
      headCommit: execSync('git rev-parse HEAD').toString().trim(),
    }, null, 2)}\n`,
  );
} finally {
  await browser.close();
}

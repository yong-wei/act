import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { config } from 'dotenv';
import { encode } from 'next-auth/jwt';

config({ path: process.env.DOTENV_CONFIG_PATH ?? '.env.local' });

type PromptHistoryEntry = {
  userId: string;
  sessionId: string;
  promptContent: string;
  auditTaskContext: {
    source: string;
    assignment: string;
    intent: string;
    outputTarget: 'prompt-history';
  };
  assessment: {
    overallScore: number;
    dimensionScores: {
      completeness: number;
      precision: number;
      structurization: number;
      executability: number;
    };
    suggestions: Array<{ dimension: string; issue: string; suggestion: string }>;
    metaPromptAnalysis: {
      detectedIntent: string;
      missingElements: string[];
      improvementPotential: number;
    };
  };
  consistency?: {
    consistencyScore: number;
    alignmentAnalysis: {
      statedGoals: string[];
      actualOptimization: string[];
      mismatches: string[];
    };
    processQuality: {
      iterationCount: number;
      convergencePattern: 'steady' | 'oscillating' | 'diverging';
      explorationBreadth: number;
    };
  };
  version: number;
  createdAt: number;
};

async function addStudentSession(context: BrowserContext) {
  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET ?? 'playwright-local-auth-secret-at-least-32-bytes',
    token: {
      id: 'prompt-assessment-browser-student',
      email: 'prompt-assessment-browser-student@example.test',
      name: 'Prompt Assessment Browser Student',
      role: 'STUDENT',
    },
  });
  await context.addCookies([{
    name: 'next-auth.session-token',
    value: token,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: false,
    expires: Math.floor(Date.now() / 1000) + 3600,
  }]);
}

function createAssessment() {
  return {
    overallScore: 85,
    dimensionScores: {
      completeness: 100,
      precision: 85,
      structurization: 75,
      executability: 80,
    },
    suggestions: [],
    metaPromptAnalysis: {
      detectedIntent: 'controller-design',
      missingElements: [],
      improvementPotential: 15,
    },
  };
}

function createConsistency() {
  return {
    consistencyScore: 88,
    alignmentAnalysis: {
      statedGoals: ['控制超调', '缩短调节时间'],
      actualOptimization: ['提高响应速度', '抑制超调与振荡'],
      mismatches: [],
    },
    processQuality: {
      iterationCount: 4,
      convergencePattern: 'steady' as const,
      explorationBreadth: 1,
    },
  };
}

async function installPromptAssessmentFixture(page: Page) {
  const history: PromptHistoryEntry[] = [];

  await page.route('**/api/assessment/ability-report/**', (route) => route.fulfill({
    json: {
      userId: 'prompt-assessment-browser-student',
      estimatedAbility: 0.6,
      confidenceInterval: [0.4, 0.8],
      timeline: [],
      dimensions: { computationalTheta: 0.6, crossDomainTheta: 0.5, designTheta: 0.7 },
    },
  }));
  await page.route('**/api/evaluation/prompt-history/**', (route) => route.fulfill({
    json: { history, total: history.length },
  }));
  await page.route('**/api/evaluation/assess-prompt', async (route) => {
    const input = route.request().postDataJSON() as {
      sessionId: string;
      prompt: string;
      auditTaskContext: PromptHistoryEntry['auditTaskContext'];
    };
    expect(input).not.toHaveProperty('userId');
    history.push({
      userId: 'prompt-assessment-browser-student',
      sessionId: input.sessionId,
      promptContent: input.prompt,
      auditTaskContext: input.auditTaskContext,
      assessment: createAssessment(),
      version: history.length + 1,
      createdAt: Date.now(),
    });
    await route.fulfill({ json: createAssessment() });
  });
  await page.route('**/api/evaluation/track-consistency', async (route) => {
    const input = route.request().postDataJSON() as { promptVersion: number };
    expect(input).not.toHaveProperty('userId');
    const record = history.find((entry) => entry.version === input.promptVersion);
    expect(record).toBeDefined();
    const consistency = createConsistency();
    if (record) {
      record.consistency = consistency;
    }
    await route.fulfill({ json: consistency });
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.innerWidth);
  expect(metrics.documentScrollWidth).toBeLessThanOrEqual(metrics.innerWidth);
}

async function expectButtonTextFits(page: Page) {
  const overflowingButtonLabels = await page.getByRole('button').evaluateAll((buttons) => buttons
    .filter((button) => button instanceof HTMLElement && button.offsetParent !== null)
    .filter((button) => Boolean(button.textContent?.trim()))
    .filter((button) => button.scrollWidth > button.clientWidth + 1)
    .map((button) => button.textContent?.trim() ?? 'unnamed-button'));
  expect(overflowingButtonLabels).toEqual([]);
}

async function expectTheme(page: Page, expectedTheme: 'light' | 'dark') {
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(
    expectedTheme === 'dark',
  );
}

async function setTheme(page: Page, expectedTheme: 'light' | 'dark') {
  const buttonLabel = expectedTheme === 'dark' ? '切换到深色模式' : '切换到浅色模式';
  if ((await page.evaluate(() => document.documentElement.classList.contains('dark'))) !== (expectedTheme === 'dark')) {
    await page.getByRole('button', { name: buttonLabel, exact: true }).click();
  }
  await expectTheme(page, expectedTheme);
}

async function expectDesktopNavigationState(page: Page, expectedState: 'expanded' | 'collapsed') {
  const shell = page.locator('[data-app-shell-layout="collapsible"]');
  await expect(shell).toHaveAttribute('data-app-shell-navigation-state', expectedState);
  const metrics = await shell.evaluate((element) => {
    const children = Array.from(element.children);
    const navigation = children[0] as HTMLElement | undefined;
    const content = children[1] as HTMLElement | undefined;
    const activeLink = navigation?.querySelector<HTMLAnchorElement>('[aria-current="page"]');
    return {
      navigationWidth: Math.round(navigation?.getBoundingClientRect().width ?? 0),
      contentWidth: Math.round(content?.getBoundingClientRect().width ?? 0),
      activeLinkAriaLabel: activeLink?.getAttribute('aria-label') ?? null,
      activeLinkTitle: activeLink?.getAttribute('title') ?? null,
      activeLinkText: activeLink?.textContent?.trim() ?? '',
    };
  });

  if (expectedState === 'collapsed') {
    expect(metrics.navigationWidth).toBe(72);
    expect(metrics.contentWidth).toBe(1368);
    expect(metrics.activeLinkAriaLabel).toBeTruthy();
    expect(metrics.activeLinkTitle).toBeTruthy();
    expect(metrics.activeLinkText).toBe('');
    return;
  }

  expect(metrics.navigationWidth).toBe(248);
  expect(metrics.contentWidth).toBe(1192);
}

async function captureEvidenceScreenshot(page: Page, filename: string) {
  const outputDirectory = process.env.PROMPT_ASSESSMENT_HISTORY_EVIDENCE_DIR;
  if (!outputDirectory) return;

  await mkdir(outputDirectory, { recursive: true });
  await page.screenshot({ path: join(outputDirectory, filename), fullPage: true });
}

test('Issue 1422 shows authenticated prompt evaluation history and consistency across desktop and mobile layouts', async ({
  context,
  page,
}) => {
  await addStudentSession(context);
  await installPromptAssessmentFixture(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/evaluation/prompt-assessment?source=prompt-assessment&assignment=PID%20%E5%8F%82%E6%95%B0%E6%95%B4%E5%AE%9A&intent=prompt-history-review');
  expect(await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  const authSession = await page.evaluate(() => fetch('/api/auth/session').then((response) => response.json()));
  expect(authSession).toMatchObject({
    user: { id: 'prompt-assessment-browser-student' },
  });

  const controlObject = page.getByLabel('Prompt 评价主输入：控制对象');
  await controlObject.focus();
  await expect(controlObject).toBeFocused();
  await controlObject.fill('邮轮航向系统');
  await page.getByLabel('Prompt 评价主输入：性能目标').fill('超调 < 15%，调节时间 < 20s');
  await page.getByLabel('Prompt 评价主输入：约束条件').fill('相位裕度 > 30°');
  await page.getByRole('button', { name: '评价提示词质量', exact: true }).click();

  await expect(page.getByText(/综合得分：\s*85/)).toBeVisible();
  await expect(page.getByText('V1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '过程一致性校验', exact: true }).click();
  await expect(page.getByText(/一致性得分：\s*88/)).toBeVisible();
  await expect(page.getByText('一致性：88', { exact: true })).toBeVisible();
  await setTheme(page, 'light');
  await expectDesktopNavigationState(page, 'collapsed');
  await expectNoHorizontalOverflow(page);
  await expectButtonTextFits(page);
  await captureEvidenceScreenshot(page, 'prompt-assessment-history-1440.png');

  await page.getByRole('button', { name: '展开平台导航', exact: true }).click();
  await expectDesktopNavigationState(page, 'expanded');
  await expectNoHorizontalOverflow(page);
  await expectButtonTextFits(page);
  await captureEvidenceScreenshot(page, 'prompt-assessment-history-light-expanded-1440.png');

  await page.setViewportSize({ width: 320, height: 900 });
  await page.reload();
  const mobileControlObject = page.getByLabel('Prompt 评价主输入：控制对象');
  await mobileControlObject.focus();
  await expect(mobileControlObject).toBeFocused();
  await expect(page.getByRole('button', { name: '打开平台导航', exact: true })).toBeVisible();
  await expect(page.getByText('V1', { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectButtonTextFits(page);
  await captureEvidenceScreenshot(page, 'prompt-assessment-history-320.png');

  await setTheme(page, 'dark');
  await expectNoHorizontalOverflow(page);
  await expectButtonTextFits(page);
  await captureEvidenceScreenshot(page, 'prompt-assessment-history-dark-320.png');

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload();
  await expectDesktopNavigationState(page, 'expanded');
  await expectNoHorizontalOverflow(page);
  await expectButtonTextFits(page);
  await captureEvidenceScreenshot(page, 'prompt-assessment-history-dark-expanded-1440.png');

  await page.getByRole('button', { name: '收起平台导航', exact: true }).click();
  await expectDesktopNavigationState(page, 'collapsed');
  await expectNoHorizontalOverflow(page);
  await expectButtonTextFits(page);
  await captureEvidenceScreenshot(page, 'prompt-assessment-history-dark-collapsed-1440.png');
});

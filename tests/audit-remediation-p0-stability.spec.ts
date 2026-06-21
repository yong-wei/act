import { expect, test, type BrowserContext } from '@playwright/test';
import { encode } from 'next-auth/jwt';

const auditedTeacherDemoSlugs = [
  'cruise-comfort-boppps',
  'unit-1-1-see-the-full-picture',
  'unit-1-2-modeling-from-object-to-system',
  'unit-2-1-modeling-language',
  'unit-2-2-time-domain-response',
  'unit-2-3-frequency-response-bode-intro',
  'unit-2-4-nyquist-margin-entry',
  'unit-3-1-pure-pole-stability-and-dynamics',
  'unit-3-2-routh-stability-boundary',
  'unit-3-3-root-locus-rules',
  'unit-3-4-root-locus-reading-validation',
  'unit-3-5-zero-dynamic-improvement',
  'unit-3-6-zero-design-workshop',
  'unit-3-7-steady-error-low-frequency-compensation',
  'unit-3-8-frequency-domain-translation-judgment',
  'unit-3-9-cross-domain-mapping-lab',
  'unit-4-1-design-task-expression',
  'unit-4-2-controller-selection-first-start',
  'unit-4-3-initial-scheme-practice-first-validation',
  'unit-4-4-fixed-structure-optimization-modeling',
  'unit-4-5-constraint-aware-parameter-optimization',
  'unit-4-6-fixed-structure-boundary-structural-encoding',
  'unit-4-7-destroyer-hifi-design-closure',
  'unit-5-1-linear-backbone-boundaries',
  'unit-5-2-nonlinear-analysis-entry',
  'unit-5-3-mass-coordination-chain',
  'unit-5-4-data-driven-mpc-transition',
  'unit-5-5-policy-learning-entry-risk',
  'unit-5-6-method-comparison-cold-chain',
];

async function addTeacherSession(context: BrowserContext) {
  const sessionToken = await encode({
    secret: process.env.NEXTAUTH_SECRET ?? 'replace-with-strong-secret',
    token: {
      id: 'audit-teacher-1',
      email: 'audit-teacher@example.com',
      name: '审计教师',
      role: 'TEACHER',
    },
  });

  await context.addCookies([{
    name: 'next-auth.session-token',
    value: sessionToken,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: false,
    expires: Math.floor(Date.now() / 1000) + 60 * 60,
  }]);
}

test('audited teacher projection demo routes do not fall back to Not found or persisted demo APIs', async ({ context, page }) => {
  test.setTimeout(180_000);
  await addTeacherSession(context);
  const auditedApiFailures: string[] = [];
  let currentRoute = '';
  page.on('response', (response) => {
    const url = response.url();
    if ((url.includes('/api/session/demo') || url.includes('/api/interactive/events')) && response.status() >= 400) {
      auditedApiFailures.push(`${currentRoute}: ${response.status()} ${url}`);
    }
  });

  for (const slug of auditedTeacherDemoSlugs) {
    currentRoute = slug;
    await page.goto(`/interactive-learning/courses/${slug}/teacher/demo`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

    await expect(page).toHaveURL(new RegExp(`/interactive-learning/courses/${slug}/teacher/demo`));
    await expect(page.locator('body')).not.toContainText('Not found');
  }
  expect(auditedApiFailures).toEqual([]);
});

test('teacher prep pack audited routes render review or recovery instead of 500 pages', async ({ context, page }) => {
  await addTeacherSession(context);

  for (const route of [
    '/teacher/prep-packs',
    '/teacher/prep-packs?cluster=audit-remediation-cluster',
    '/teacher/prep-packs?classId=audit-remediation-class',
  ]) {
    const response = await page.goto(route, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('networkidle');

    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('[data-report-ledger-surface="teacher-prep-pack-review"]')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Application error');
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
  }
});

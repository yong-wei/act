import { expect, test, type Page } from '@playwright/test';

const FORBIDDEN = ['表现良好', '需要关注', '优秀', '最优', '最佳'];

test.use({ viewport: { width: 1440, height: 900 } });

async function openDebrief(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  const expandDock = page.getByRole('button', { name: '展开控制与探究' });
  const evaluateTab = page.getByRole('tab', { name: '评估' });
  await expect(expandDock.or(evaluateTab)).toBeVisible();
  if (await expandDock.isVisible()) {
    await expandDock.click();
  }
  await evaluateTab.click();
  const debrief = page.getByTestId('control-effect-debrief');
  await expect(debrief).toBeVisible();
  return debrief;
}

async function expectNoForbiddenCopy(debrief: ReturnType<Page['getByTestId']>) {
  for (const phrase of FORBIDDEN) {
    await expect(debrief).not.toContainText(phrase);
  }
}

test('incomplete cruise run fails closed without debrief conclusions', async ({ page }) => {
  const debrief = await openDebrief(page, '/simulations/cruise?debriefAcceptance=incomplete');
  await expect(debrief.getByTestId('control-effect-debrief-unavailable')).toContainText('运行尚未完成');
  await expect(debrief).not.toContainText('转向超调要求');
  await expectNoForbiddenCopy(debrief);
});

test('completed course-bound run states satisfied overshoot and settling thresholds', async ({ page }) => {
  const debrief = await openDebrief(
    page,
    '/simulations/cruise?courseMode=cruise-boppps&debriefAcceptance=satisfied',
  );
  await expect(debrief.getByTestId('debrief-fact-turn_overshoot_percent')).toContainText('8%');
  await expect(debrief.getByTestId('debrief-threshold-turn_overshoot_percent')).toContainText('8% ≤ 10%');
  await expect(debrief.getByTestId('debrief-threshold-turn_overshoot_percent')).toContainText('课程任务 cruise-comfort-course-turn');
  await expect(debrief.getByTestId('debrief-threshold-settling_time_s')).toContainText('40 s ≤ 45 s');
  await expect(debrief).toContainText('不能判断控制需求是否过大');
  await expectNoForbiddenCopy(debrief);
});

test('completed course-bound run states unsatisfied overshoot without aggregate judgment', async ({ page }) => {
  const debrief = await openDebrief(
    page,
    '/simulations/cruise?courseMode=cruise-boppps&debriefAcceptance=overshoot-unsatisfied',
  );
  await expect(debrief.getByTestId('debrief-threshold-turn_overshoot_percent')).toContainText('转向超调要求未满足');
  await expect(debrief.getByTestId('debrief-threshold-turn_overshoot_percent')).toContainText('18% > 10%');
  await expect(debrief).not.toContainText('表现良好');
  await expectNoForbiddenCopy(debrief);
});

test('completed course-bound run states unsatisfied settling time without aggregate judgment', async ({ page }) => {
  const debrief = await openDebrief(
    page,
    '/simulations/cruise?courseMode=cruise-boppps&debriefAcceptance=settling-unsatisfied',
  );
  await expect(debrief.getByTestId('debrief-threshold-settling_time_s')).toContainText('调节时间要求未满足');
  await expect(debrief.getByTestId('debrief-threshold-settling_time_s')).toContainText('52 s > 45 s');
  await expectNoForbiddenCopy(debrief);
});

test('completed free-exploration run keeps control observations without task outcomes', async ({ page }) => {
  const debrief = await openDebrief(page, '/simulations/cruise?debriefAcceptance=control-unavailable');
  await expect(debrief.getByTestId('debrief-task-unavailable')).toContainText('没有权威任务阈值');
  await expect(debrief.getByTestId('debrief-fact-rudder_deg')).toContainText('结束时刻观察');
  await expect(debrief).toContainText('不能判断控制需求是否过大');
  await expect(debrief).not.toContainText('已满足');
  await expect(debrief).not.toContainText('未满足');
  await expectNoForbiddenCopy(debrief);
});

test('standalone completed cruise does not inject course task thresholds', async ({ page }) => {
  const debrief = await openDebrief(page, '/simulations/cruise?debriefAcceptance=satisfied');
  await expect(debrief.getByTestId('debrief-task-unavailable')).toContainText('没有权威任务阈值');
  await expect(debrief).not.toContainText('转向超调要求已满足');
  await expectNoForbiddenCopy(debrief);
});

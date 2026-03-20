import { expect, test, type Browser, type Page } from '@playwright/test';

const TEACHER_ACCOUNT = 'test_teacher';
const TEACHER_PASSWORD = 'TestTeacher@Just2026!';
const STUDENT_ACCOUNT = 'demo';
const STUDENT_PASSWORD = 'DemoStudent@Just2026!';

async function login(page: Page, account: string, password: string) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.getByPlaceholder('学号/工号').fill(account);
  await page.getByPlaceholder('密码').fill(password);
  await Promise.all([
    page.waitForURL(/\/(teacher|dashboard|admin)$/, { timeout: 40_000 }),
    page.getByRole('button', { name: '登录' }).click(),
  ]);
}

async function createTeacherAndStudentPages(browser: Browser) {
  const teacherContext = await browser.newContext();
  const studentContext = await browser.newContext();

  const teacherPage = await teacherContext.newPage();
  const studentPage = await studentContext.newPage();

  return { teacherContext, studentContext, teacherPage, studentPage };
}

test('L-sum live classroom should support join, out-of-sync prompt, release and answer reveal', async ({ browser }) => {
  test.setTimeout(150_000);

  const { teacherContext, studentContext, teacherPage, studentPage } = await createTeacherAndStudentPages(browser);

  try {
    await login(teacherPage, TEACHER_ACCOUNT, TEACHER_PASSWORD);
    await teacherPage.goto('/interactive-learning/courses/lsum-design-feasible-domain', { waitUntil: 'networkidle' });
    await Promise.all([
      teacherPage.waitForURL(/\/interactive-learning\/courses\/lsum-design-feasible-domain\/teacher\/.+$/, { timeout: 45_000 }),
      teacherPage.getByRole('button', { name: '开始上课（教师）' }).click(),
    ]);

    const joinCodeText = await teacherPage.getByText(/课堂码：\d{6}/).first().textContent();
    const joinCodeMatch = joinCodeText?.match(/(\d{6})/);
    expect(joinCodeMatch?.[1]).toBeTruthy();
    const joinCode = joinCodeMatch![1];

    await login(studentPage, STUDENT_ACCOUNT, STUDENT_PASSWORD);
    await studentPage.goto('/interactive-learning/courses/lsum-design-feasible-domain', { waitUntil: 'networkidle' });
    await studentPage.getByPlaceholder('输入 6 位课堂码').fill(joinCode);
    await Promise.all([
      studentPage.waitForURL(/\/interactive-learning\/courses\/lsum-design-feasible-domain\/student\/.+$/, { timeout: 45_000 }),
      studentPage.getByRole('button', { name: '加入课堂' }).click(),
    ]);

    await expect(studentPage.getByRole('heading', { name: '回到地图：层0的最后一块拼图' }).first()).toBeVisible();

    await teacherPage.locator('select').selectOption('step-02');
    await expect(teacherPage.getByRole('heading', { name: '验收单困境：从分析到设计的切换' }).first()).toBeVisible();

    await expect.poll(
      async () => studentPage.getByText('当前页面与教师不同步，点击可跳转到教师所在环节。').isVisible(),
      { timeout: 12_000 },
    ).toBe(true);

    await studentPage.getByRole('button', { name: '跳到教师当前页' }).click();
    await expect(studentPage.getByRole('heading', { name: '验收单困境：从分析到设计的切换' }).first()).toBeVisible();

    await teacherPage.locator('select').selectOption('step-04');
    await expect(teacherPage.getByRole('heading', { name: '前测：你还记得多少？' }).first()).toBeVisible();

    await expect.poll(
      async () => studentPage.getByText('当前页面与教师不同步，点击可跳转到教师所在环节。').isVisible(),
      { timeout: 12_000 },
    ).toBe(true);

    await studentPage.getByRole('button', { name: '跳到教师当前页' }).click();
    await expect(studentPage.getByText('等待教师开始前测…')).toBeVisible();

    await teacherPage.getByRole('button', { name: '释放前测' }).click();
    await expect.poll(
      async () => studentPage.getByText('阻尼比 ζ = 0.3 和 ζ = 0.7，哪个超调量更大？').isVisible(),
      { timeout: 12_000 },
    ).toBe(true);

    await teacherPage.getByRole('button', { name: '显示答案' }).click();
    await expect.poll(
      async () => studentPage.getByText(/正确答案：/).first().isVisible(),
      { timeout: 12_000 },
    ).toBe(true);
  } finally {
    await teacherContext.close();
    await studentContext.close();
  }
});

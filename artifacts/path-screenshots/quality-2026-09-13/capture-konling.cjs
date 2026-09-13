const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(path.join(process.cwd(), 'node_modules/playwright'));

const out = __dirname;
const base = process.env.PATH_SCREENSHOT_BASE || 'http://localhost:3001';
const cases = [
  [0, 'feedback-loop-concept-foundations', '反馈与闭环结构基础', 'zero', '无掌握证据'],
  [1, 'root-locus-analysis-foundations', '根轨迹分析基础', 'partial', '部分掌握'],
  [2, 'frequency-response-foundations', '频率响应基础', 'mastered', '前置基础较充分'],
];
const passwords = [...fs.readFileSync('scripts/db/seed-path-mastery-test-learners.mjs', 'utf8')
  .matchAll(/password: '([^']+)'/g)].map((match) => match[1]);

(async () => {
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const [index, goalId, goalTitle, cohort, student] of cases) {
      const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
      const csrf = await (await context.request.get(`${base}/api/auth/csrf`)).json();
      await context.request.post(`${base}/api/auth/callback/credentials?json=true`, {
        form: {
          csrfToken: csrf.csrfToken,
          email: `20260913000${index + 1}`,
          password: passwords[index],
          callbackUrl: '/',
          json: 'true',
        },
      });
      const page = await context.newPage();
      await page.goto(`${base}/assessment/adaptive-practice?goal=${goalId}&intent=contextual-recommendation`);
      await page.waitForTimeout(1200);
      await page.getByRole('button', { name: '打开控灵', exact: true }).last().click();
      await page.getByRole('button', { name: '新建控灵对话', exact: true }).click();
      await page.waitForTimeout(400);
      const prompt = `请直接生成${goalTitle}的学习路径。我有180分钟，请根据我的学习记录安排，并给出可比较方案。`;
      const input = page.locator('input[name=global-ai-sidebar-input]');
      await input.fill(prompt);
      const pending = page.waitForResponse((r) => r.url().includes('/api/ai/chat'), { timeout: 180000 });
      const start = Date.now();
      await input.press('Enter');
      const response = await pending;
      await response.finished();
      const stream = await response.text();
      const events = stream.split('\n').filter((line) => line.startsWith('data: {')).map((line) => JSON.parse(line.slice(6)));
      const output = events.find((event) => event.type === 'tool-output-available' && event.output?.operation === 'generated')?.output;
      if (!response.ok() || output?.generationStatus !== 'persisted' || !output.pathOptions?.length) {
        throw new Error(`Konling did not persist paths for ${cohort}: ${response.status()}`);
      }
      const cards = page.locator('[data-learning-path-desktop-modules]');
      await cards.waitFor({ state: 'visible', timeout: 30000 });
      const close = page.getByRole('button', { name: '关闭 AI 侧栏', exact: true });
      if (await close.isVisible()) await close.click();
      await page.waitForTimeout(300);
      for (const summary of await cards.locator('summary').all()) await summary.click({ force: true });
      await page.waitForTimeout(400);
      const file = `chat-${index + 1}-${cohort}.png`;
      await page.screenshot({ path: path.join(out, file), fullPage: false });
      fs.writeFileSync(path.join(out, file.replace('.png', '.txt')), await cards.innerText());
      const result = {
        student,
        goal: goalTitle,
        file,
        prompt,
        options: output.pathOptions.length,
        generationStatus: output.generationStatus,
        batchId: output.candidateBatch?.id,
        elapsedMs: Date.now() - start,
        tool: 'generate_learning_path',
        pageHasCards: await cards.isVisible(),
      };
      results.push(result);
      fs.writeFileSync(path.join(out, 'chat-results.json'), JSON.stringify(results, null, 2));
      console.log(JSON.stringify(result));
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

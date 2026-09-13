const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(path.join(process.cwd(), 'node_modules/playwright'));

const out = __dirname;
const base = process.env.PATH_SCREENSHOT_BASE || 'http://localhost:3001';
const goals = [
  ['feedback-loop-concept-foundations', '反馈与闭环结构基础'],
  ['root-locus-analysis-foundations', '根轨迹分析基础'],
  ['frequency-response-foundations', '频率响应基础'],
];
const students = [['zero', '无掌握证据'], ['partial', '部分掌握'], ['mastered', '前置基础较充分']];
const passwords = [...fs.readFileSync('scripts/db/seed-path-mastery-test-learners.mjs', 'utf8')
  .matchAll(/password: '([^']+)'/g)].map((match) => match[1]);

(async () => {
  const browser = await chromium.launch();
  const results = [];
  try {
    for (let i = 0; i < students.length; i += 1) {
      const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
      const csrf = await (await context.request.get(`${base}/api/auth/csrf`)).json();
      await context.request.post(`${base}/api/auth/callback/credentials?json=true`, {
        form: {
          csrfToken: csrf.csrfToken,
          email: `20260913000${i + 1}`,
          password: passwords[i],
          callbackUrl: '/',
          json: 'true',
        },
      });
      for (let j = 0; j < goals.length; j += 1) {
        const page = await context.newPage();
        await page.goto(`${base}/assessment/adaptive-practice?goal=${goals[j][0]}&intent=contextual-recommendation`);
        await page.locator('input[type=range]').focus();
        await page.keyboard.press('End');
        const response = page.waitForResponse((r) => r.url().includes('/api/adaptive/path-advisor-tool'), { timeout: 180000 });
        const start = Date.now();
        await page.getByRole('button', { name: /^(生成路径|重试生成|重新生成)$/ }).last().click();
        const http = await response;
        const data = await http.json();
        if (!http.ok() || data.result?.generationStatus !== 'persisted' || !data.result.pathOptions?.length) {
          throw new Error(`${students[i][0]}/${goals[j][0]} did not generate usable paths: ${http.status()} ${data.error || data.result?.generationStatus}`);
        }
        const cards = page.locator('[data-learning-path-desktop-modules]');
        await cards.waitFor({ state: 'visible', timeout: 30000 });
        const close = page.getByRole('button', { name: '关闭 AI 侧栏', exact: true });
        if (await close.isVisible()) await close.click();
        for (const summary of await cards.locator('summary').all()) await summary.click();
        await page.waitForTimeout(400);
        const file = `${i + 1}-${j + 1}-${students[i][0]}-${goals[j][0]}.png`;
        await cards.screenshot({ path: path.join(out, file) });
        fs.writeFileSync(path.join(out, file.replace('.png', '.txt')), await cards.innerText());
        const result = {
          student: students[i][1],
          goal: goals[j][1],
          file,
          status: http.status(),
          generationStatus: data.result.generationStatus,
          options: data.result.pathOptions.length,
          elapsedMs: Date.now() - start,
          batchId: data.result.candidateBatch?.id,
        };
        results.push(result);
        fs.writeFileSync(path.join(out, 'page-results.json'), JSON.stringify(results, null, 2));
        console.log(JSON.stringify(result));
        await page.close();
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

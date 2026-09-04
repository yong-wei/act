import { expect, test } from '@playwright/test';

/**
 * 公开站点爬虫策略契约（Issue #1940）：
 * `/robots.txt` 以静态资产交付（200 + text/plain），私有路径组
 * （登录/注册、学习者个人面、数据面、教师/管理面、课堂、API）全部
 * Disallow，公开表面保持默认可抓取。
 */

const PRIVATE_PATH_GROUPS = [
  '/login',
  '/register',
  '/dashboard',
  '/profile',
  '/missions',
  '/data-center',
  '/teacher',
  '/admin',
  '/classroom',
  '/api/',
];

test('robots.txt serves the crawler policy as plain text', async ({ request }) => {
  const response = await request.get('/robots.txt');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('text/plain');
  const body = await response.text();

  const userAgentBlock = body.match(/User-agent:\s*\*\s*\n([\s\S]*?)(?:\n\s*\n|$)/);
  expect(userAgentBlock).not.toBeNull();
  const rules = userAgentBlock![1];
  for (const path of PRIVATE_PATH_GROUPS) {
    expect(rules, `Disallow ${path}`).toContain(`Disallow: ${path}`);
  }
  // 私有组之外不得整体封禁公开表面（不得出现单独的 Disallow: / 行）。
  expect(rules.split('\n').map((line) => line.trim())).not.toContain('Disallow: /');
});

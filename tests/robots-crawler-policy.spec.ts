import { expect, test } from '@playwright/test';

import { PLATFORM_PRIMARY_ROUTE_INVENTORY } from '@/lib/platform-role-navigation';

/**
 * 公开站点爬虫策略契约（Issue #1940）：
 * `/robots.txt` 以静态资产交付（200 + text/plain），受保护路由
 * （路由盘点 `protected-redirect`）全部被某条 Disallow 规则覆盖，
 * 公开表面保持默认可抓取。
 */

/** robots Disallow 规则（含 `*` 通配）是否覆盖受保护路径。 */
function disallowCovers(href: string, rule: string): boolean {
  const pattern = rule.replace(/[.*+?^${}()|[\]\\]/g, (char) => (char === '*' ? '.*' : `\\${char}`));
  const anchored = rule.endsWith('/')
    ? `^${pattern}`
    : `^${pattern}(?:/|$)`;
  return new RegExp(anchored).test(href.split('?')[0]);
}

const protectedHrefs = PLATFORM_PRIMARY_ROUTE_INVENTORY
  .filter((entry) => entry.authState === 'protected-redirect' || entry.authState === 'auth-entry')
  .map((entry) => entry.href.split('?')[0]);
const publicHrefs = PLATFORM_PRIMARY_ROUTE_INVENTORY
  .filter((entry) => entry.authState === 'public')
  .map((entry) => entry.href.split('?')[0]);

test('robots.txt serves the crawler policy as plain text', async ({ request }) => {
  const response = await request.get('/robots.txt');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('text/plain');
  const body = await response.text();

  const userAgentBlock = body.match(/User-agent:\s*\*\s*\n([\s\S]*?)(?:\n\s*\n|$)/);
  expect(userAgentBlock).not.toBeNull();
  const rules = (userAgentBlock![1].match(/Disallow:\s*(\S+)/g) ?? [])
    .map((line) => line.replace(/^Disallow:\s*/, ''));
  expect(rules.length).toBeGreaterThan(0);

  // 受保护路由盘点中的每条路径必须被某条 Disallow 规则覆盖。
  for (const href of protectedHrefs) {
    expect(
      rules.some((rule) => disallowCovers(href, rule)),
      `protected route ${href} must be covered by a Disallow rule`,
    ).toBe(true);
  }

  // 公开路由不得被任何规则误伤，也不得出现全站封禁行。
  for (const rule of rules) {
    expect(rule).not.toBe('/');
    for (const href of publicHrefs) {
      expect(
        disallowCovers(href, rule),
        `public route ${href} must not be disallowed by ${rule}`,
      ).toBe(false);
    }
  }
});

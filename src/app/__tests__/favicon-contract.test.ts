import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(__dirname, '../../..');
const faviconPath = path.join(rootDir, 'src/app/favicon.ico');

/**
 * 站点图标契约（#1937）：`src/app/favicon.ico` 走 App Router 文件约定，
 * `/favicon.ico` 必须返回图片而非 404 页面。ICO 从品牌套件
 * `public/assets/platform-brand/favicon.svg` 派生（多尺寸、PNG 压缩层）。
 */
describe('site favicon delivery contract (#1937)', () => {
  it('serves a multi-size ICO through the App Router file convention', () => {
    expect(existsSync(faviconPath)).toBe(true);
    const data = readFileSync(faviconPath);
    // ICO 头：reserved 0x0000、type 0x0001、entry count。
    expect(data.length).toBeGreaterThan(0);
    expect(data.readUInt16LE(0)).toBe(0);
    expect(data.readUInt16LE(2)).toBe(1);
    const entryCount = data.readUInt16LE(4);
    expect(entryCount).toBeGreaterThanOrEqual(2);

    const sizes = new Set<string>();
    for (let index = 0; index < entryCount; index += 1) {
      const offset = 6 + index * 16;
      const width = data[offset] === 0 ? 256 : data[offset];
      const height = data[offset + 1] === 0 ? 256 : data[offset + 1];
      sizes.add(`${width}x${height}`);
    }
    // 浏览器标签页与 Retina 至少覆盖 16/32；多尺寸避免收藏夹/快捷方式模糊。
    expect(sizes.has('16x16')).toBe(true);
    expect(sizes.has('32x32')).toBe(true);
  });

  it('keeps the icon lighter than the 20KB 404 page it replaces', () => {
    expect(statSync(faviconPath).size).toBeLessThan(20 * 1024);
  });

  it('derives from the governed platform-brand favicon source', () => {
    expect(existsSync(path.join(rootDir, 'public/assets/platform-brand/favicon.svg'))).toBe(true);
  });
});

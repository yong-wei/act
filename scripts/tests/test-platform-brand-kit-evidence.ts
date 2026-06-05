import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { chromium } from 'playwright';

const repoRoot = process.cwd();
const evidenceUrl = `${pathToFileURL(path.join(repoRoot, 'artifacts/commercial-ui/brand-kit-evidence.html')).href}?template=dark`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });

  try {
    await page.goto(evidenceUrl);
    await page.waitForSelector('[data-brand-evidence-board]');
    const assets = await page.locator('[data-brand-asset]').evaluateAll((nodes) => nodes.map((node) => {
      const element = node as HTMLImageElement;
      const rect = element.getBoundingClientRect();
      return {
        asset: element.dataset.brandAsset,
        width: rect.width,
        height: rect.height,
        naturalWidth: element.naturalWidth,
        naturalHeight: element.naturalHeight,
      };
    }));

    assert.equal(assets.length, 7, 'brand evidence page should render lockup plus six surface assets');
    for (const asset of assets) {
      assert.ok(asset.width > 0, `${asset.asset} should have visible width`);
      assert.ok(asset.height > 0, `${asset.asset} should have visible height`);
      assert.ok(asset.naturalWidth > 0, `${asset.asset} should load SVG pixels`);
      assert.ok(asset.naturalHeight > 0, `${asset.asset} should load SVG pixels`);
    }
    console.log('test-platform-brand-kit-evidence passed');
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

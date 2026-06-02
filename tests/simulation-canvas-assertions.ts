import { expect, type Page } from '@playwright/test';
import sharp from 'sharp';

export async function expectRenderedCanvas(page: Page) {
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible({ timeout: 30000 });

  const box = await canvas.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(240);
  expect(box?.height ?? 0).toBeGreaterThan(180);

  const hideNonCanvas = await page.addStyleTag({
    content: `
      body * {
        visibility: hidden !important;
      }
      canvas {
        visibility: visible !important;
      }
    `,
  });

  try {
    const screenshot = await canvas.screenshot({ timeout: 30000 });
    const { data, info } = await sharp(screenshot)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const buckets = new Set<string>();
    let visiblePixels = 0;
    let minLuma = 255;
    let maxLuma = 0;
    const sampleStride = Math.max(1, Math.floor((info.width * info.height) / 2000));

    for (let pixel = 0; pixel < info.width * info.height; pixel += sampleStride) {
      const offset = pixel * 4;
      const alpha = data[offset + 3] ?? 0;
      if (alpha < 10) continue;

      const red = data[offset] ?? 0;
      const green = data[offset + 1] ?? 0;
      const blue = data[offset + 2] ?? 0;
      const luma = (red + green + blue) / 3;
      visiblePixels += 1;
      minLuma = Math.min(minLuma, luma);
      maxLuma = Math.max(maxLuma, luma);
      buckets.add(`${red >> 4}:${green >> 4}:${blue >> 4}`);
    }

    expect(visiblePixels).toBeGreaterThan(50);
    expect(buckets.size).toBeGreaterThan(3);
    expect(maxLuma - minLuma).toBeGreaterThan(8);
  } finally {
    await hideNonCanvas.evaluate((node) => node.parentNode?.removeChild(node));
  }
}

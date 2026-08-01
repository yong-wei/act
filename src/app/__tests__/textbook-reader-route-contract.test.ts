import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { PLATFORM_LAYERS } from '@/components/platform/platform-layers';

const APP_ROOT = path.join(process.cwd(), 'src', 'app');

describe('textbook intercepted-route structure', () => {
  it('keeps standalone and root parallel-slot routes for the same textbook URL', async () => {
    const [standalone, intercepted, layout] = await Promise.all([
      readFile(path.join(APP_ROOT, 'textbooks/[bookId]/[edition]/[...unitPath]/page.tsx'), 'utf8'),
      readFile(path.join(APP_ROOT, '@textbookModal/(.)textbooks/[bookId]/[edition]/[...unitPath]/page.tsx'), 'utf8'),
      readFile(path.join(APP_ROOT, 'layout.tsx'), 'utf8'),
    ]);
    expect(standalone).toContain('presentation="standalone"');
    expect(intercepted).toContain('presentation="modal"');
    expect(layout).toContain('{textbookModal}');
  });

  it('provides default and catch-all fallbacks for unmatched modal slots', async () => {
    const [defaultSlot, catchAllSlot] = await Promise.all([
      readFile(path.join(APP_ROOT, '@textbookModal/default.tsx'), 'utf8'),
      readFile(path.join(APP_ROOT, '@textbookModal/[...catchAll]/page.tsx'), 'utf8'),
    ]);
    expect(defaultSlot).toContain('return null');
    expect(catchAllSlot).toContain('return null');
  });

  it('closes the intercepted modal through router history restoration', async () => {
    const [modal, links] = await Promise.all([
      readFile(
        path.join(process.cwd(), 'src', 'features', 'textbook-reader', 'textbook-reader-modal.tsx'),
        'utf8',
      ),
      readFile(
        path.join(process.cwd(), 'src', 'features', 'textbook-reader', 'textbook-reader-link.tsx'),
        'utf8',
      ),
    ]);
    expect(modal).toContain('consumeTextbookModalSession');
    expect(modal).toContain('window.history.go(-session.depth)');
    expect(modal).toContain('router.back()');
    expect(links).toContain('sourceHref: currentHref(), depth: 1');
    expect(links).toContain('depth: session.depth + 1');
    expect(modal).toContain('data-textbook-reader-modal="true"');
  });

  it('keeps parent structure units navigable alongside expand and collapse', async () => {
    const reader = await readFile(
      path.join(process.cwd(), 'src', 'features', 'textbook-reader', 'textbook-reader.tsx'),
      'utf8',
    );
    expect(reader).toContain('<details open={containsActive}>');
    expect(reader).toContain('href={node.href}');
    expect(reader).toContain('data-textbook-parent-link="true"');
  });

  it('places the textbook workspace above every existing platform surface', () => {
    const lowerLayers = Object.entries(PLATFORM_LAYERS)
      .filter(([name]) => name !== 'textbookWorkspace')
      .map(([, zIndex]) => zIndex);
    expect(PLATFORM_LAYERS.textbookWorkspace).toBeGreaterThan(Math.max(...lowerLayers));
  });

  it('provides a real application source link for intercepted navigation', async () => {
    const reviewSource = await readFile(
      path.join(APP_ROOT, 'review/unified-textbook-reader/page.tsx'),
      'utf8',
    );
    expect(reviewSource).toContain('<TextbookReaderLink');
    expect(reviewSource).toContain('data-textbook-review-entry="true"');
  });
});

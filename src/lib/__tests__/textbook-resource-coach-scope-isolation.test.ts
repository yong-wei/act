import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('textbook resource coach scope isolation', () => {
  it('does not add contextual coaching to unsupported resource surfaces', () => {
    const resourceRenderer = read('src/features/lesson-engine/resource-renderer.tsx');
    const knowledgePage = read('src/app/knowledge/page.tsx');
    const knowledgePanel = readFileSafe('src/features/knowledge/resource-panel.tsx')
      || readFileSafe('src/features/knowledge/knowledge-workspace.tsx')
      || '';
    const staticText = readFileSafe('src/features/lesson-engine/resources/static-text.tsx')
      || readFileSafe('src/resources/static-text.tsx')
      || resourceRenderer;

    expect(resourceRenderer).toContain("mode: 'resource-coach'");
    expect(resourceRenderer).not.toContain('structured-textbook-unit');
    expect(resourceRenderer).not.toContain('对本页提问');
    expect(knowledgePage).not.toContain('structured-textbook-unit');
    expect(knowledgePage).not.toContain('对本页提问');
    expect(knowledgePanel).not.toContain('structured-textbook-unit');
    expect(staticText).not.toContain('structured-textbook-unit');
  });

  it('keeps textbook coaching entry on the unified textbook reader only', () => {
    const coaching = read('src/features/textbook-reader/textbook-reader-coaching-surface.tsx');
    const route = read('src/features/textbook-reader/textbook-reader-route.tsx');
    expect(coaching).toContain('STRUCTURED_TEXTBOOK_UNIT_KIND');
    expect(coaching).toContain('对本页提问');
    expect(coaching).toContain("from '@/lib/textbook-reader-contracts'");
    expect(coaching).not.toContain("from '@/lib/textbook-reader'");
    expect(route).toContain('TextbookReaderCoachingSurface');
  });
});

function readFileSafe(relativePath: string) {
  try {
    return read(relativePath);
  } catch {
    return '';
  }
}

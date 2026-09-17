import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGovernedRehypeKatexOptions } from '@/lib/governed-math';
import { readPublishedLearnerCardByToken } from '../learning-content';

let root: string | undefined;
afterEach(() => {
  vi.restoreAllMocks();
  if (root) rmSync(root, { recursive: true, force: true });
  root = undefined;
});

function readFixture(formula: string) {
  root = mkdtempSync(join(tmpdir(), 'learner-card-math-'));
  const directory = join(root, 'course-content/runtime/knowledge/cards/authority/nodes');
  mkdirSync(directory, { recursive: true });
  const raw = `---\nnode_id: routh-fixture\nstatus: ready\n---\n## 首页\n**一句话定义**：检查劳斯表。\n## 详情\n### 完整解释\n${formula}\n\n**核对要点**：稳定范围为 $0<K<6$。\n### 关联节点\n稳定性。`;
  writeFileSync(join(directory, 'routh-fixture.md'), raw);
  vi.spyOn(process, 'cwd').mockReturnValue(root);
  const hash = createHash('sha256').update(raw).digest('hex');
  return readPublishedLearnerCardByToken('routh-fixture', `content:${hash}`);
}

function render(markdown: string) {
  return renderToStaticMarkup(createElement(ReactMarkdown, {
    remarkPlugins: [remarkGfm, remarkMath],
    rehypePlugins: [[rehypeKatex, createGovernedRehypeKatexOptions()]],
  }, markdown));
}

describe('published learner card math rendering', () => {
  it('preserves an array whose opening and closing delimiters share formula lines', () => {
    const card = readFixture('$$\\begin{array}{c|cc}\ns^3&1&2\\\\\ns^2&3&K\n\\end{array}.$$');
    expect(card).not.toBeNull();
    const html = render(card!.explanation);
    expect(html).not.toContain('katex-error');
    expect(html).toContain('mtable');
    expect(html).toContain('核对要点');
    expect(html).toContain('<strong>核对要点</strong>');
  });

  it('keeps standard display fences and following prose renderable', () => {
    const card = readFixture('$$\n\\begin{array}{cc}\n1&2\\\\\n3&4\n\\end{array}\n$$');
    const html = render(card!.explanation);
    expect(html).not.toContain('katex-error');
    expect(html).toContain('mtable');
    expect(html).toContain('<strong>核对要点</strong>');
  });

  it('keeps inline math and content hash verification intact', () => {
    const card = readFixture('误差为 $1/6$。');
    expect(card!.explanation).toContain('误差为 $1/6$。');
    expect(readPublishedLearnerCardByToken('routh-fixture', `content:${'0'.repeat(64)}`)).toBeNull();
  });
});

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { createGovernedRehypeKatexOptions } from '@/lib/governed-math';
import { readPublishedLearnerCardByToken } from '@/lib/authority-domain-shards/learning-content';

const root = process.cwd();
const waves = join(root, 'course-content/authoring/knowledge/cards/authority/waves');
const temporary = mkdtempSync(join(tmpdir(), 'modeling-card-render-'));
const target = join(temporary, 'course-content/runtime/knowledge/cards/authority/nodes');
mkdirSync(target, { recursive: true });
const results: Array<{ batchId: string; cards: number; status: string }> = [];
try {
  for (const name of ['teaching-core-09a']) {
    const inventory = JSON.parse(readFileSync(join(waves, name, 'inventory.json'), 'utf8'));
    for (const row of inventory.cards) {
      const bytes = readFileSync(join(root, row.authoringPath));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), row.cardSha256);
      for (const formula of bytes.toString('utf8').matchAll(/\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$/gu)) {
        assert(!/(?<!\\)\bqquad\b/u.test(formula[1] ?? formula[2]), 'Bare LaTeX spacing command: ' + row.name);
      }
      writeFileSync(join(target, row.cardId + '.md'), bytes);
    }
    process.chdir(temporary);
    for (const row of inventory.cards) {
      const card = readPublishedLearnerCardByToken(row.cardId, 'content:' + row.cardSha256);
      assert(card);
      const html = renderToStaticMarkup(createElement(ReactMarkdown, {
        remarkPlugins: [remarkGfm, remarkMath],
        rehypePlugins: [[rehypeKatex, createGovernedRehypeKatexOptions()]],
      }, card.summary + '\n\n' + card.explanation));
      assert(!html.includes('katex-error'), row.name);
      assert(html.includes('核对要点'), row.name);
    }
    process.chdir(root);
    results.push({ batchId: name, cards: inventory.cards.length, status: 'passed' });
  }
} finally {
  process.chdir(root);
  rmSync(temporary, { recursive: true, force: true });
}
writeFileSync(join(waves, 'teaching-core-09a/author-markdown-verification.json'), JSON.stringify({ status: 'passed', runtimeWritten: false, results }, null, 2) + '\n');
console.log(JSON.stringify(results));

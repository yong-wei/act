import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const cssPath = path.join(process.cwd(), 'src/app/globals.css');
const css = fs.readFileSync(cssPath, 'utf8');

const requiredSelectors = [
  '--premium-lesson-surface',
  '--premium-lesson-surface-soft',
  '--premium-lesson-foreground',
  '--premium-lesson-muted',
  '.light .text-cyan-100',
  '.light .text-cyan-200',
  '.light .text-sky-100',
  '.light .text-emerald-100',
  '.light .text-amber-100',
  '.light .text-rose-100',
  '.premium-lesson-shell',
  '.premium-lesson-panel',
  '.premium-lesson-panel-soft',
  '.premium-lesson-accent-panel',
  '.premium-lesson-input',
  '.premium-lesson-kicker',
  '.light .premium-lesson-shell',
  '.light .premium-lesson-panel',
  '.light .premium-lesson-panel-soft',
  '.light .premium-lesson-accent-panel',
  '.light .premium-lesson-input',
  '.light .premium-lesson-muted',
  '.premium-lesson-shell .bg-white',
  '.premium-lesson-shell .text-slate-900',
  '.premium-lesson-shell .border-slate-200',
  '.premium-lesson-shell .bg-cyan-50',
  '.premium-lesson-shell .text-cyan-700',
];

for (const selector of requiredSelectors) {
  assert.equal(css.includes(selector), true, `globals.css missing light contrast selector: ${selector}`);
}

console.log('theme light contrast test passed');

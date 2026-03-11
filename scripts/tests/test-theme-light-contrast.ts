import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const cssPath = path.join(process.cwd(), 'src/app/globals.css');
const css = fs.readFileSync(cssPath, 'utf8');

const requiredSelectors = [
  '.light .text-cyan-100',
  '.light .text-cyan-200',
  '.light .text-sky-100',
  '.light .text-emerald-100',
  '.light .text-amber-100',
  '.light .text-rose-100',
];

for (const selector of requiredSelectors) {
  assert.equal(css.includes(selector), true, `globals.css missing light contrast selector: ${selector}`);
}

console.log('theme light contrast test passed');

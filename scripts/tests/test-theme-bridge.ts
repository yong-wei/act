import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const cssPath = path.join(process.cwd(), 'src/app/globals.css');
const css = fs.readFileSync(cssPath, 'utf8');

const requiredSelectors = [
  '.light .bg-slate-950',
  '.light .bg-slate-900',
  '.light .text-white',
  '.light .border-white\\/10',
  '.light .from-slate-950',
  '.light .to-slate-900',
];

for (const selector of requiredSelectors) {
  assert.equal(css.includes(selector), true, `globals.css missing theme bridge selector: ${selector}`);
}

console.log('theme bridge test passed');

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { PDFDocument } from 'pdf-lib';

const root = join(process.cwd(), '.runtime', 'stage-a-pdf-candidates', '12-pdf-annotation-layout-overall-evaluation');

async function main() {
  const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8')) as {
    candidateCount: number;
    candidates: Array<{ path: string }>;
  };
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  let parsed = 0;
  let overallEvaluationTitlePresent = 0;
  let internalFieldPresent = 0;
  for (const candidate of manifest.candidates) {
    const bytes = await readFile(candidate.path);
    const document = await PDFDocument.load(bytes);
    if (document.getPageCount() > 0) parsed += 1;
    const task = pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, useWorkerFetch: false });
    const source = await task.promise;
    try {
      const pages = await Promise.all(Array.from({ length: source.numPages }, async (_, index) => {
        const page = await source.getPage(index + 1);
        const content = await page.getTextContent();
        return content.items.flatMap((entry) => 'str' in entry ? [entry.str] : []).join(' ');
      }));
      const text = pages.join('');
      if (text.includes('总体评价')) overallEvaluationTitlePresent += 1;
      if (text.includes('复核校验值') || text.includes('校验和') || text.includes('Provider')) internalFieldPresent += 1;
    } finally {
      await source.destroy();
    }
  }
  if (parsed !== manifest.candidateCount || overallEvaluationTitlePresent !== manifest.candidateCount || internalFieldPresent !== 0) {
    throw new Error(JSON.stringify({ expected: manifest.candidateCount, parsed, overallEvaluationTitlePresent, internalFieldPresent }));
  }
  console.log(JSON.stringify({ expected: manifest.candidateCount, parsed, overallEvaluationTitlePresent, internalFieldPresent }));
}

void main();

#!/usr/bin/env node
/**
 * Development-only static audit page for unavailable Authority labels.
 * Output is local artifacts only and must never enter Next.js routes or
 * Runtime Release manifests.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const outputDir = path.join(process.cwd(), 'artifacts', 'knowledge', 'unavailable-label-audit');
mkdirSync(outputDir, { recursive: true });

const html = `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8" />
<title>Unavailable label audit</title>
<body>
  <p>Development-only Authority adapter audit. Modes: normal / all / unavailable-only.</p>
  <p data-audit-runtime="force-graph">Reuses production adapter + shared 2D/3D runtime.</p>
</body>
</html>
`;

writeFileSync(path.join(outputDir, 'index.html'), html);
writeFileSync(path.join(outputDir, 'README.md'), 'Local audit artifact. Not a product route.\n');
console.log(`wrote ${outputDir}`);

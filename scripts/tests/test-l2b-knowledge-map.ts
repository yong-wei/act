import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const stepPanels = fs.readFileSync(
  path.join(root, 'src/features/interactive/l2b-root-locus/step-panels.tsx'),
  'utf8',
);

assert.equal(
  stepPanels.includes('MapNode title="L-2a 时域直觉" status="上一课"') &&
    stepPanels.includes('MapNode title="L-2b 根轨迹直觉" status="当前高亮" active') &&
    stepPanels.includes('MapNode title="L-2c 频域直觉" status="下一课"'),
  true,
  'L-2b 知识地图应只保留三次课节点，并将本课放在中间高亮',
);

assert.equal(
  stepPanels.includes('L-0 → L-1 → L-2a ✓') || stepPanels.includes('[L-2b 你在这里]'),
  false,
  'L-2b 知识地图不应继续使用旧的长链文本条',
);

console.log('l2b knowledge map test passed');

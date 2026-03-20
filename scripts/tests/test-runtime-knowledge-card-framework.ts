import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const knowledgeCard = fs.readFileSync(
  path.join(root, 'src/features/knowledge/knowledge-card.tsx'),
  'utf8',
);
const entryRuntimeSections = fs.readFileSync(
  path.join(root, 'src/features/interactive/l2b-root-locus/entry-runtime-sections.tsx'),
  'utf8',
);
const stepDrawer = fs.readFileSync(
  path.join(root, 'src/features/interactive/shared/step-knowledge-drawer.tsx'),
  'utf8',
);

assert.equal(
  knowledgeCard.includes('extractMarkdownSection') &&
    knowledgeCard.includes('首页') &&
    knowledgeCard.includes('详情'),
  true,
  '统一知识卡组件应支持解析 runtime 节点卡中的“首页/详情”分节',
);

assert.equal(
  knowledgeCard.includes('\\Z'),
  false,
  '统一知识卡组件提取 markdown 分节时不应使用 JS 不支持的 \\Z 结尾匹配，避免最后一个“详情”分节失效',
);

assert.equal(
  knowledgeCard.includes('详情') &&
    knowledgeCard.includes('概览') &&
    knowledgeCard.includes('overflow-y-auto'),
  true,
  '统一知识卡组件应支持详情/概览切换，并在内容较长时可滚动',
);

assert.equal(
  knowledgeCard.includes('${title} · 详情') || knowledgeCard.includes('${title} · 概览'),
  false,
  '统一知识卡组件切换概览/详情时不应改写卡片标题文本',
);

assert.equal(
  entryRuntimeSections.includes('KnowledgeCard'),
  true,
  '课程首页应复用统一知识卡组件渲染节点卡片',
);

assert.equal(
  stepDrawer.includes('KnowledgeCard'),
  true,
  '步骤知识卡抽屉应复用统一知识卡组件渲染节点卡片',
);

console.log('runtime knowledge card framework test passed');

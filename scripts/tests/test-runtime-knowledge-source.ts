import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const knowledgeSource = read('src/lib/knowledge-graph-source.ts');
const mdxRoute = read('src/app/api/content/mdx/route.ts');
const runtimeContentPath = read('src/lib/runtime-content-path.ts');
const knowledgeCard = read('src/features/knowledge/knowledge-card.tsx');

assert.equal(
  knowledgeSource.includes("course-content', 'runtime', 'knowledge', 'graph', 'nodes.json'") ||
    knowledgeSource.includes('course-content/runtime/knowledge/graph/nodes.json'),
  true,
  'knowledge-graph-source 应从 course-content/runtime/knowledge/graph/nodes.json 读取',
);

assert.equal(
  knowledgeSource.includes("course-content', 'runtime', 'knowledge', 'graph', 'relations.jsonl'") ||
    knowledgeSource.includes('course-content/runtime/knowledge/graph/relations.jsonl'),
  true,
  'knowledge-graph-source 应从 course-content/runtime/knowledge/graph/relations.jsonl 读取',
);

assert.equal(
  knowledgeSource.includes("path.join(process.cwd(), 'data', 'knowledge_graph.json')"),
  false,
  'knowledge-graph-source 不应继续读取根目录 data/knowledge_graph.json',
);

assert.equal(
  mdxRoute.includes('resolveReadableContentPath') &&
    runtimeContentPath.includes("const RUNTIME_PREFIX = 'course-content/runtime/'") &&
    runtimeContentPath.includes("path.join(PROJECT_ROOT, 'course-content', 'runtime')"),
  true,
  'mdx route 应支持读取 course-content/runtime 下的 Markdown 资源',
);

assert.equal(
  mdxRoute.includes(".endsWith('.md')") || mdxRoute.includes(".endsWith('.mdx')"),
  true,
  'mdx route 应支持 .md/.mdx 文件',
);

assert.equal(
  knowledgeCard.includes("path.endsWith('.md')") || knowledgeCard.includes("path.endsWith('.mdx')"),
  true,
  '知识卡片组件应同时支持 .md 与 .mdx 资源',
);

console.log('runtime knowledge source test passed');

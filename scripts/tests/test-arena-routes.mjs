import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const detailRoutePath = path.join(root, 'src/app/arena/challenges/[taskId]/page.tsx');
const detailComponentPath = path.join(root, 'src/features/arena/challenge-detail.tsx');
const hallPath = path.join(root, 'src/features/arena/arena-hall.tsx');

assert.equal(
  fs.existsSync(detailRoutePath),
  true,
  '竞技场挑战详情路由应存在',
);

assert.equal(
  fs.existsSync(detailComponentPath),
  true,
  '竞技场挑战详情组件应存在',
);

const detailRouteContent = fs.readFileSync(detailRoutePath, 'utf8');
const detailContent = fs.readFileSync(detailComponentPath, 'utf8');
const hallContent = fs.readFileSync(hallPath, 'utf8');

assert.equal(
  detailRouteContent.includes('notFound'),
  true,
  '无效挑战任务路由应调用 notFound',
);

assert.equal(
  detailContent.includes('对象说明') &&
    detailContent.includes('评价规则') &&
    detailContent.includes('相关知识点') &&
    detailContent.includes('进入工作台'),
  true,
  '挑战详情页应展示对象、评价规则、知识点和工作台入口',
);

assert.equal(
  hallContent.includes('filterArenaChallengeTasks') &&
    hallContent.includes('筛选挑战任务') &&
    hallContent.includes('暂无匹配的挑战任务'),
  true,
  '竞技场大厅应接入任务筛选与空状态',
);

assert.equal(
  hallContent.includes('href={`/arena/challenges/${challenge.id}`}'),
  true,
  '竞技场大厅的“查看挑战”应链接到真实挑战详情路由',
);

assert.equal(
  /<button[^>]*>\s*查看挑战/.test(hallContent),
  false,
  '竞技场大厅不应渲染无动作的“查看挑战”按钮',
);

console.log('arena routes test passed');

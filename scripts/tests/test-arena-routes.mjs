import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const detailRoutePath = path.join(root, 'src/app/arena/challenges/[taskId]/page.tsx');
const detailComponentPath = path.join(root, 'src/features/arena/challenge-detail.tsx');
const hallPath = path.join(root, 'src/features/arena/arena-hall.tsx');
const teacherConfigPath = path.join(root, 'src/features/arena/teacher/teacher-arena-config.tsx');

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
const teacherConfigContent = fs.readFileSync(teacherConfigPath, 'utf8');

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
  hallContent.includes('challenge.topScore') || hallContent.includes('challenge.participantCount'),
  false,
  '竞技场大厅不得从挑战种子读取硬编码榜单数据',
);

assert.equal(
  detailContent.includes('样例方案') || detailContent.includes('提交示例 PID'),
  false,
  '挑战详情页不得渲染硬编码样例提交或样例榜单',
);

assert.equal(
  hallContent.includes('{challenge.title}') && hallContent.includes('对象：{object.name}'),
  true,
  '竞技场大厅任务卡应以挑战任务标题为主标题，对象名作为副信息',
);

assert.equal(
  /<button[^>]*>\s*查看挑战/.test(hallContent),
  false,
  '竞技场大厅不应渲染无动作的“查看挑战”按钮',
);

assert.equal(
  teacherConfigContent.includes("fetch('/api/teacher/arena/preview'") &&
    teacherConfigContent.includes('setTaskId') &&
    teacherConfigContent.includes('setClassId') &&
    teacherConfigContent.includes('setDeadline') &&
    teacherConfigContent.includes('setLeaderboardPolicyId'),
  true,
  '教师竞技场页面应提供真实配置表单并连接发布预览 API',
);

console.log('arena routes test passed');

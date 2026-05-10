import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const homePath = path.join(root, 'src/app/page.tsx');
const arenaPagePath = path.join(root, 'src/app/arena/page.tsx');
const arenaHallPath = path.join(root, 'src/features/arena/arena-hall.tsx');

const homeContent = fs.readFileSync(homePath, 'utf8');

assert.equal(
  homeContent.includes('href="/arena"') || homeContent.includes("href: '/arena'"),
  true,
  '首页应提供指向 /arena 的竞技场入口',
);

assert.equal(
  homeContent.includes('竞技场'),
  true,
  '首页入口应使用“竞技场”作为学生可见名称',
);

assert.equal(
  homeContent.includes('四个核心入口'),
  true,
  '首页平台入口矩阵应与四个入口数量一致',
);

assert.equal(
  fs.existsSync(arenaPagePath),
  true,
  '/arena 页面文件应存在',
);

const arenaContent = fs.readFileSync(arenaPagePath, 'utf8');
const arenaHallContent = fs.existsSync(arenaHallPath) ? fs.readFileSync(arenaHallPath, 'utf8') : '';
const combinedArenaContent = `${arenaContent}\n${arenaHallContent}`;

assert.equal(
  combinedArenaContent.includes('竞技场大厅'),
  true,
  '/arena 页面应呈现竞技场大厅',
);

assert.equal(
  combinedArenaContent.includes('挑战任务'),
  true,
  '/arena 页面应以挑战任务作为核心入口语义',
);

assert.equal(
  combinedArenaContent.includes('串联校正') && combinedArenaContent.includes('PID'),
  true,
  '/arena MVP 应展示白箱阶段支持的串联校正与 PID 方法',
);

console.log('arena home entry test passed');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const homePath = path.join(root, 'src/app/page.tsx');
const arenaPagePath = path.join(root, 'src/app/arena/page.tsx');
const arenaHallPath = path.join(root, 'src/features/arena/arena-hall.tsx');
const arenaShellPath = path.join(root, 'src/features/arena/arena-page-shell.tsx');

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
  homeContent.includes('三个核心入口'),
  true,
  '首页平台入口矩阵应与三个入口数量一致',
);

assert.equal(
  homeContent.includes('评审入口') || homeContent.includes("href: '/review'") || homeContent.includes('href="/review"'),
  false,
  '首页不应继续公开评审入口',
);

assert.equal(
  fs.existsSync(arenaPagePath),
  true,
  '/arena 页面文件应存在',
);

const arenaContent = fs.readFileSync(arenaPagePath, 'utf8');
const arenaHallContent = fs.existsSync(arenaHallPath) ? fs.readFileSync(arenaHallPath, 'utf8') : '';
const arenaShellContent = fs.existsSync(arenaShellPath) ? fs.readFileSync(arenaShellPath, 'utf8') : '';
const combinedArenaContent = `${arenaContent}\n${arenaHallContent}\n${arenaShellContent}`;

assert.equal(
  combinedArenaContent.includes('竞技场大厅'),
  true,
  '/arena 页面应呈现竞技场大厅',
);

assert.equal(
  combinedArenaContent.includes('ArenaPageShell') &&
    combinedArenaContent.includes('首页') &&
    combinedArenaContent.includes('竞技场首页'),
  true,
  '/arena 页面应使用首页 > 竞技场首页面包屑和竞技场页面壳层',
);

assert.equal(
  combinedArenaContent.includes('虚拟仿真') &&
    combinedArenaContent.includes('竞技场') &&
    combinedArenaContent.includes('知识图谱') &&
    combinedArenaContent.includes('互动学习') &&
    combinedArenaContent.includes('个人中心'),
  true,
  '/arena 页面壳层应使用首页一致的四入口导航和个人中心入口',
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

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const homePath = path.join(root, 'src/app/page.tsx');
const navigationPath = path.join(root, 'src/lib/platform-role-navigation.ts');
const arenaPagePath = path.join(root, 'src/app/arena/page.tsx');
const arenaHallPath = path.join(root, 'src/features/arena/arena-hall.tsx');
const arenaShellPath = path.join(root, 'src/features/arena/arena-page-shell.tsx');

const homeContent = fs.readFileSync(homePath, 'utf8');
const navigationContent = fs.readFileSync(navigationPath, 'utf8');

assert.equal(
  homeContent.includes('getStudentCoreNavigationEntries') && navigationContent.includes("href: '/arena'"),
  true,
  '首页应通过共享学生入口提供指向 /arena 的竞技场入口',
);

assert.equal(
  navigationContent.includes('竞技场'),
  true,
  '共享学生入口应使用“竞技场”作为学生可见名称',
);

assert.equal(
  homeContent.includes('六个核心入口'),
  true,
  '首页平台入口矩阵应与六个核心入口数量一致',
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
  combinedArenaContent.includes('getStudentCoreNavigationEntries') &&
    navigationContent.includes('虚拟仿真') &&
    navigationContent.includes('竞技场') &&
    navigationContent.includes('知识资源') &&
    navigationContent.includes('控制工作台') &&
    navigationContent.includes('自适应学习') &&
    navigationContent.includes('个人中心'),
  true,
  '/arena 页面壳层应使用首页一致的六入口学生导航',
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

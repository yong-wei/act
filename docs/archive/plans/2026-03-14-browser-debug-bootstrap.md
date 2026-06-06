# 浏览器调试基线与测试账号收口 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让本地 `startup` 启动后的浏览器页面稳定完成资源加载，并将浏览器验收测试账号切换为复杂密码、统一到脚本与文档。

**Architecture:** 保持本地浏览器调试继续使用 `next dev`，在 `scripts/ops/start.sh` 中增加页面就绪探针和固定测试账号密码同步。测试账号通过 `scripts/db/update-fixed-account-passwords.mjs` 统一接管，浏览器闭环参考文档与快速文档同步更新。

**Tech Stack:** Bash, Node.js, Prisma, bcryptjs, Markdown

### Task 1: 启动脚本就绪探针

**Files:**
- Modify: `scripts/ops/start.sh`
- Test: `scripts/tests/test-browser-debug-bootstrap.mjs`

**Step 1: 写失败测试**

校验 `start.sh`：
- 继续使用 `npm run dev -- --hostname 127.0.0.1 --port 3001`
- 包含 `curl -fsS` 页面探针
- 包含 `npm run seed:fixed-passwords`

**Step 2: 运行测试确认失败**

Run: `node scripts/tests/test-browser-debug-bootstrap.mjs`

**Step 3: 实现最小改动**

- 在 `start.sh` 中增加登录页和 L-2d 入口页就绪轮询
- 在启动阶段同步固定测试账号密码

**Step 4: 重跑测试确认通过**

Run: `node scripts/tests/test-browser-debug-bootstrap.mjs`

### Task 2: 固定测试账号复杂密码

**Files:**
- Modify: `scripts/db/seed-demo-user.mjs`
- Modify: `scripts/db/update-fixed-account-passwords.mjs`
- Modify: `scripts/tests/test-account-password-overrides.mjs`
- Test: `scripts/tests/test-browser-validation-accounts.mjs`

**Step 1: 写失败测试**

校验：
- `test_teacher` 使用 `TestTeacher@Just2026!`
- `demo` 使用 `DemoStudent@Just2026!`
- 固定密码脚本、密码校验脚本、demo 种子脚本一致

**Step 2: 运行测试确认失败**

Run:
- `node scripts/tests/test-browser-validation-accounts.mjs`
- `node scripts/tests/test-account-password-overrides.mjs`

**Step 3: 实现最小改动**

- demo 种子密码改为复杂密码
- 固定密码脚本接管 `test_teacher` 与 `demo`
- 修复密码校验脚本的 ESM `bcryptjs` 兼容导入

**Step 4: 更新数据库并重跑测试**

Run:
- `npm run seed:fixed-passwords`
- `node scripts/tests/test-account-password-overrides.mjs`

### Task 3: 浏览器验收参考与文档同步

**Files:**
- Modify: `.agents/skills/interactive-lesson-implementation/references/closed-loop-browser-validation.md`
- Modify: `docs/QUICKSTART.md`
- Modify: `scripts/README.md`
- Modify: `docs/ProjectDescription.md`

**Step 1: 更新说明**

- 明确本地浏览器验收使用 `npm run startup`
- 明确不要使用 `npm run start`
- 写入新的教师/学生测试账号密码
- 记录弹窗与 hydration 风险

**Step 2: 验证**

Run:
- `./scripts/ops/start.sh`
- `npm run lint`

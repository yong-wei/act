# GitHub Actions CI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为当前 Next.js / Prisma 项目补齐最小可用的 GitHub Actions CI，让 PR 和 `main` 分支自动跑基础质量检查。

**Architecture:** 采用单一 GitHub Actions workflow，在 `pull_request` 与 `push` 到 `main` 时触发。单个 job 统一完成依赖安装、`npm run lint`、`npm run test`、`npm run build`，避免重复安装依赖，同时保证当前 PR 能直接出现 checks。

**Tech Stack:** GitHub Actions、Node.js 20、npm、Next.js 14、Prisma

### Task 1: 记录实施方案

**Files:**
- Create: `docs/plans/2026-03-20-github-actions-ci.md`

**Step 1: 明确最小 CI 范围**

- 使用现有稳定命令：`npm run lint`、`npm run test`、`npm run build`
- 触发范围：`pull_request` 到任意分支，`push` 到 `main`
- Node 版本：`20`

**Step 2: 确认依赖安装方式**

Run: `ls package-lock.json`
Expected: 存在 `package-lock.json`，可直接使用 `npm ci`

### Task 2: 新增 GitHub Actions workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: 定义触发条件**

- `pull_request`
- `push` 到 `main`
- 可选加 `workflow_dispatch`

**Step 2: 配置基础执行环境**

- `runs-on: ubuntu-latest`
- `actions/checkout@v4`
- `actions/setup-node@v4`
- `cache: npm`

**Step 3: 串行执行质量检查**

Run in workflow:
- `npm ci`
- `npm run lint`
- `npm run test`
- `npm run build`

**Step 4: 增加并发取消**

- 对同一分支/PR 的重复运行做 `concurrency`，减少浪费

### Task 3: 本地验证并回推 PR

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: 本地复跑等价验证**

Run:
- `npm run lint`
- `npm run test`
- `npm run build`

Expected: 全部退出码为 0

**Step 2: 提交并推送**

Run:
- `git add docs/plans/2026-03-20-github-actions-ci.md .github/workflows/ci.yml`
- `git commit -m "ci: add GitHub Actions workflow"`
- `git push`

**Step 3: 检查 PR checks**

Run: `gh pr checks 1`
Expected: 出现新的 GitHub Actions check；若仍未出现，检查 workflow 触发条件与文件路径

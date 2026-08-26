# 脚本使用说明

脚本按职责分层，避免把一次性工具堆在 `scripts/` 根目录。

```text
scripts/
├── analysis/      # 分析与诊断脚本
├── db/            # 数据迁移、种子、回填和数据库同步脚本
├── figures/       # 教学图、控制图和旧课程媒体生成脚本
├── migrations/    # 数据治理与学习事实迁移脚本
├── ops/           # 启停、日志和本地运维辅助脚本
├── tests/         # 各类测试与校验脚本
├── wasm/          # Rust/WASM 构建入口
├── workers/       # 数据治理 worker 与 scheduler
├── build.sh       # 统一镜像构建入口
├── remote-deploy.sh
└── README.md
```

## 常用入口

| 命令 | 功能 |
|------|------|
| `npm run startup` | 启动完整本地服务 |
| `npm run shutdown` | 停止本地服务 |
| `npm run dev` | 前台启动 Next.js 开发服务器 |
| `npm run build` | 构建生产版本，包含 WASM 与 Prisma 生成 |
| `npm run lint` | 代码检查 |
| `npm test` | PR 默认测试合同（发现 + 快速确定性集合） |
| `npm run test:integration` | PostgreSQL/Redis/worker 等适配层测试 |
| `npm run test:e2e:playwright` | 历史 Playwright 全量，现由 nightly/E2E 组件保留 |
| `npm run db:sync-remote` | 用远端数据库替换本地开发库，脚本会先备份本地库 |

## 本地启停

```bash
npm run startup
npm run shutdown
```

`startup` 会检查 PostgreSQL、Redis、`.env`、依赖和固定测试账号，启动数据治理 worker、scheduler 与 Next.js 服务，并把日志写入 `.logs/`。

## 数据脚本

数据库脚本位于 `scripts/db/`。优先使用 `package.json` 中的 npm 入口，例如：

```bash
npm run seed:knowledge
npm run seed:fixed-passwords
npm run db:backfill-facts
npm run db:repair-class-session-attribution -- --session-id=<session-id> --class-id=<class-id>
```

`npm run seed:knowledge` 以 `course-content/runtime/knowledge/graph/nodes.json` 与
`relations.jsonl` 为唯一真源，同步 `KnowledgeNode` / `KnowledgeLink` 到数据库；
它不再读取已废弃的根目录 `content/` 或 MDX concepts 卡片。

课堂历史归属修复必须由审核人员提供单个已结束课堂与班级的显式映射。命令默认
仅校验并输出脱敏摘要；确认 dry-run 后追加 `--apply` 才会写入：

```bash
npm run db:repair-class-session-attribution -- --session-id=<session-id> --class-id=<class-id>
npm run db:repair-class-session-attribution -- --session-id=<session-id> --class-id=<class-id> --apply
```

兼容入口 `db:backfill-class-attribution` 调用同一安全命令，不再按参与者画像或当前
默认班级自动推断，也不支持批量筛选。可选 `--teacher-id=<teacher-id>` 仅用于复核
课堂教师是否与审核记录一致。

直接运行脚本时使用 `node`、`npx tsx` 或 `bash`，保持与 `package.json` 中的调用方式一致。

## 制图脚本

历史教学图生成脚本位于 `scripts/figures/`。例如：

```bash
python3 scripts/figures/generate_control_plots.py
python3 scripts/figures/control_diagrams_matplotlib.py
```

这些脚本主要服务历史教学图和迁移资料。新课媒体制作优先使用 `course-content/authoring/lessons/<lesson>/media/` 下的作者态链路。

## 日志

本地运行日志位于 `.logs/`：

```bash
npm run logs
npm run logs:error
node scripts/ops/clear-logs.mjs
```

## 相关文档

- [项目说明](../docs/ProjectDescription.md)
- [仿真规范](../docs/Simulation_Guidelines.md)
- [文档索引](../docs/README.md)

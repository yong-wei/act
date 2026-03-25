# Control Odyssey AI History DB

## Goal
- 完成 AI 建议历史落库与迁移，并通过 lint/test/build/integration

## Scope
- in: 创建/应用 Prisma 迁移、确保 AI 历史读写可用、修复相关错误、运行测试与构建、提交推送
- out: 新增功能或 UI 重构

## Steps
1) 处理 Prisma 迁移（使用 shadow schema 方式或可行替代）并生成客户端
2) 复核 AI 历史读写与页面表现，修复构建/类型问题
3) 运行 lint/test/build/test:integration，修复直至通过
4) 更新文档与提交推送

## Tests
- npm run lint
- npm run test
- npm run build
- npm run test:integration

## Acceptance
- AI 建议历史可落库并可读取最新记录
- 全部测试与构建通过
- 分支已提交并推送

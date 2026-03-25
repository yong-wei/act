# Prisma Migration Squash

## Goal
- 将现有迁移压缩为单一基线迁移，修复 shadow 重放失败的问题

## Scope
- in: 生成基线迁移、移除旧迁移文件、重置 _prisma_migrations 记录、验证数据库与 schema 一致性、运行测试与构建
- out: 业务功能改动

## Steps
1) 生成基线迁移 SQL 并替换迁移目录
2) 重置 `_prisma_migrations` 并将基线迁移标记为已应用
3) 校验数据库与 schema 一致性
4) 运行 lint/test/build/test:integration
5) 提交与推送

## Tests
- npm run lint
- npm run test
- npm run build
- npm run test:integration

## Acceptance
- 迁移目录只保留基线迁移
- `_prisma_migrations` 与基线迁移对齐
- lint/test/build/integration 通过

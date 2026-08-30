# KnowledgeLink 多关系迁移部署顺序

本迁移只移除端点唯一约束、增加 provenance 列和查询索引。它无法从旧折叠行恢复已经丢失的关系语义。

## 前向部署

以下命令均应使用发布环境明确提供的 `DATABASE_URL`：

```bash
pg_dump "$DATABASE_URL" --format=custom --file="knowledge-link-before-$(date +%Y%m%d%H%M%S).dump"
npx prisma migrate deploy
node scripts/db/seed-all-knowledge.mjs
KNOWLEDGE_POSTGRES_E2E_REQUIRED=1 npx tsx scripts/tests/test-knowledge-link-postgres-e2e.ts
npm run test:runtime-knowledge
```

安全部署顺序：

1. 暂停知识图谱 seed 写入。
2. 部署完整 migration chain，包括本迁移。
3. 在同一发布窗口立即运行 `node scripts/db/seed-all-knowledge.mjs`，以 canonical `relations.jsonl` 恢复全部 relation ID。
4. 运行 runtime knowledge 与 DB fallback 校验后恢复写入。

迁移不会根据端点或节点 metadata 猜测历史关系 ownership。历史行保持 external/unowned；canonical seed 仅按 canonical relation ID 精确 upsert 并写入当前 `runtimeSource`。首次 seed 会恢复当前 canonical 多关系，但不会删除任何未带当前 ownership 标记的历史或外部关系。

## 验证

```sql
SELECT "metadata"->>'runtimeSource' AS owner, count(*)
FROM "KnowledgeLink"
GROUP BY 1 ORDER BY 1 NULLS FIRST;

SELECT "sourceId", "targetId", count(*)
FROM "KnowledgeLink"
GROUP BY "sourceId", "targetId"
HAVING count(*) > 1
ORDER BY "sourceId", "targetId";
```

第二条查询出现记录是多关系能力的预期结果，也是旧唯一约束不能直接恢复的证据。隔离 PostgreSQL E2E 会在本次迁移前插入 runtime-endpoint、external 和 mixed 历史关系，应用迁移与 seed 后验证所有未声明 ownership 的行仍保留；测试还会真实执行旧 `CREATE UNIQUE INDEX`，断言 PostgreSQL 以 `23505` 拒绝，并核对索引未创建且全部关系数据指纹保持不变。

## 降级合同

本迁移不可无损自动回滚。恢复旧 `UNIQUE (sourceId, targetId)` 前必须：

1. 停止关系写入并保留上述 `pg_dump`。
2. 导出所有重复端点关系及 provenance，形成可恢复归档。
3. 由数据治理负责人明确每个端点对保留哪个 relation ID；禁止用任意 `MIN(id)` 或关系类型默认值静默折叠。
4. 执行上面的重复端点查询并确认返回零行。
5. 才可运行 `CREATE UNIQUE INDEX "KnowledgeLink_sourceId_targetId_key" ON "KnowledgeLink"("sourceId", "targetId");` 并回退应用代码。

若不能完成第 2–4 步，应恢复前向版本及备份，不能直接应用旧唯一约束。

# 发布检查清单

状态: draft
最后更新: 2026-03-17
摘要: 记录发布前后应检查的最小闭环，尤其覆盖构建、迁移、关键 API 和公网验证。
上游:
- [00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/70-workflows/00-index.md)
下游: []
相关:
- [../30-operations/30-database-and-migrations.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/30-operations/30-database-and-migrations.md)

## 最小闭环

1. 完成本地构建与必要测试
2. 执行远端部署与运行时资源同步
3. 验证公网首页
4. 验证 `/api/auth/session`
5. 验证一个关键课程页和一个关键课堂接口
6. 抽查数据库关键表和迁移状态

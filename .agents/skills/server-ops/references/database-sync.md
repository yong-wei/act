# 数据库导出、下载与本地恢复

适用场景：

- 需要把线上当前数据拉回本地分析
- 需要在本地重现线上数据问题

默认连接：

- 远端：容器 `act-obe-postgres`
- 本地：`postgresql://act_user:act_pass@localhost:5432/act_obe`

推荐顺序：

1. 默认直接执行同步脚本
```bash
bash scripts/db/sync-remote-db-to-local.sh
```

脚本会先备份本地库，再导出远端并重建本地库；涉及“远端数据库全量替换本地开发数据库”时，默认就走这一条，不再手工拼命令。

如果只是在排查脚本行为，或需要理解脚本展开后的关键步骤，再看下面：

2. 远端导出并下载
```bash
ssh root@121.40.124.135 "podman exec act-obe-postgres pg_dump -U act_user -d act_obe -Fc" > /tmp/act_obe_remote.dump
mv /tmp/act_obe_remote.dump data/backups/remote_act_obe_sync_$(date +%Y%m%d_%H%M%S).dump
```

3. 如需完全覆盖本地，优先整库重建再恢复
```bash
psql -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'act_obe' AND pid <> pg_backend_pid();"
dropdb --if-exists act_obe
createdb -O act_user act_obe
export PGPASSWORD=act_pass
pg_restore -h localhost -U act_user -d act_obe --no-owner --no-privileges data/backups/remote_act_obe_sync_xxx.dump
```

4. 恢复后核对关键计数
```bash
export PGPASSWORD=act_pass
psql -h localhost -U act_user -d act_obe -c "select (select count(*) from \"User\") as users, (select count(*) from \"StudentCompetencySnapshot\") as student_snapshots, (select count(*) from \"ClassCompetencySnapshot\") as class_snapshots;"
```

注意事项：

- 本仓库把 `SHADOW_DATABASE_URL` 也放在同一数据库里，用 `shadow` schema 承载；如果做覆盖恢复，直接重建整库最稳
- 如果只在现有库上 `pg_restore --clean`，容易被 `shadow` schema 依赖关系卡住
- 脚本默认通过当前系统用户对应的本地 PostgreSQL 管理角色重建数据库；如果本机管理角色不是 `$USER`，可先覆写 `LOCAL_ADMIN_USER`

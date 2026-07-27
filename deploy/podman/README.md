# Podman 部署脚本说明

## 文件
- `load-images.sh`：导入离线镜像包（无需服务器构建）
- `deploy.sh`：启动 PostgreSQL + 应用容器
- `restore-db.sh`：恢复数据库备份
- `status.sh`：查看容器状态和日志
- `stop.sh`：停止并删除容器
- `.env.server`：部署配置（可直接改）
- `nginx-act.adapt-learn.online.conf`：子域名反向代理配置片段

## 快速执行
```bash
cd deploy/podman
./load-images.sh
./deploy.sh
./restore-db.sh ../../data/backups/act_obe_20260301_full.dump
./status.sh
```

## 迁移说明
- 应用容器启动时会自动执行 `prisma migrate deploy`（可通过环境变量 `RUN_MIGRATIONS_ON_START=0` 关闭）。
- 若数据库从旧备份恢复，首次启动会自动补齐缺失表结构（如 `PlatformSetting`）。
- 智能课件发布所需密钥、固定浏览器回执和部署后验证见 [智能课件发布 P0 运行手册](../../docs/operations/smart-courseware-p0-runbook.md)。

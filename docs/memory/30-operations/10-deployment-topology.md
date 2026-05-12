# 部署拓扑

状态: active
最后更新: 2026-03-19
摘要: 说明项目从本地构建到远端运行的大致拓扑，帮助快速定位问题落在哪一层，也记录本地课堂调试所需的 Redis / worker / scheduler 基线。
上游:
- [00-index.md](00-index.md)
下游:
- [30-database-and-migrations.md](30-database-and-migrations.md)
相关:
- [scripts/remote-deploy.sh](../../../scripts/remote-deploy.sh)

## 当前已知拓扑

- 本地课堂调试不再只是 `next dev`，默认基线是 `scripts/ops/start.sh`
- `start.sh` 现在会检查或拉起 Redis，执行 `npm run worker:scheduler`，启动 `npm run worker:dev`，再启动 Next.js
- 本地使用 `scripts/build.sh` 构建镜像产物
- 远端部署通过 `scripts/remote-deploy.sh` 上传镜像和运行时资源
- 生产环境由 Nginx + Podman 容器提供服务
- `course-content/runtime` 已从镜像中拆出，通过远端同步和只读挂载提供

## 本地课堂链路最小组成

- Web: Next.js 应用
- DB: PostgreSQL
- Cache / queue broker: Redis
- Background processing: `worker:dev`
- Recurring job registration: `worker:scheduler`（一次性初始化，不是长期常驻服务）

## 排障分层

- 浏览器层: 旧 chunk、缓存、登录态
- Nginx 层: 反向代理与静态资源
- App 容器层: Next.js + Prisma + NextAuth
- 本地后台进程层: Redis + data-governance worker + scheduler
- DB 层: PostgreSQL schema、迁移状态、表结构

# 环境变量与密钥

状态: draft
最后更新: 2026-03-17
摘要: 记录哪些环境变量对应用启动与鉴权最敏感，避免部署时遗漏关键配置。
上游:
- [00-index.md](00-index.md)
下游: []
相关:
- [src/lib/auth.ts](../../../src/lib/auth.ts)
- [deploy/podman/deploy.sh](../../../deploy/podman/deploy.sh)

## 当前关键环境变量

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- 远端部署脚本中用于应用、数据库容器连接的运行时变量

## 维护约束

- 这里记录变量名称和作用，不记录真实密钥值
- 真实生产值应保留在服务器侧安全存储中

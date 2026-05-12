# 排障手册

状态: active
最后更新: 2026-03-19
摘要: 记录通用排障顺序，减少一上来就改代码的冲动，并补充课堂链路排障时必须先确认的本地运行基线。
上游:
- [00-index.md](00-index.md)
下游: []
相关:
- [../60-incidents/00-index.md](../60-incidents/00-index.md)

## 推荐顺序

1. 先确认问题是否仍能复现
2. 若是课堂链路或教师端页面问题，先确认本地是否通过 `npm run startup` 拉起了 Redis、worker 和 Next.js，而不是只跑 `npm run dev`
3. 若 `startup` 自称成功但页面仍报 `502/500`，先查 `lsof -nP -iTCP:3001 -sTCP:LISTEN`、`.logs/error.log` 与 `.logs/pids/frontend.pid`，确认不是旧 `next-server` 残留或 pid 文件记录了错误进程
4. 先确认接口返回码，再看浏览器控制台
5. 再看服务端日志、Redis 可用性和数据库状态
6. 先区分鉴权失败、查询失败、轮询成本问题和部署混合态
7. 最后才提出修复方案

# 观测入口

状态: active
最后更新: 2026-03-17
摘要: 记录排障时应优先查看哪些日志和信号，避免每次重新摸索。
上游:
- [00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/30-operations/00-index.md)
下游: []
相关:
- [.logs](/Users/YW/Documents/Site/act.just.edu.cn/.logs)

## 本地观测入口

- `.logs/frontend.log`
- `.logs/error.log`
- `.logs/database.log`

## 代码侧信号

- `console.error` / `console.info`
- Prisma `warn` / `error` 日志
- 课堂相关的 `[classroom]` 事件日志

## 使用建议

- 先看接口返回码，再看服务端日志
- 先区分鉴权失败和查询失败，再进一步定位

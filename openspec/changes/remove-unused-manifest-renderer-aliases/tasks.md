## 1. 删除无用分支

- [ ] 1.1 核对 design 中 55 个 handler 的课程和动态入口调用，删除无实际消费者的 entries，保留 13 个现用 handler 与必要 alias 元数据。
- [ ] 1.2 更新或删除只要求旧 handler 存在的测试，保留现用课程、精确 plugin lookup、角色投影和缺失 renderer 检查。

## 2. 验证

- [ ] 2.1 运行 manifest-runtime-plugin-registry、interactive-manifest-runtime、interactive-module-registry-gate 和受影响课程测试，确认现用 runtime manifest 可渲染、旧 kind 不绕过现有验证。
- [ ] 2.2 运行 typecheck、相关 lint、OpenSpec strict 与 git diff --check；说明实际减少的分支和代码量，不新增统计工具。

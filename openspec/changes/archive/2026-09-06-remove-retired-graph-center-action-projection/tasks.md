## 1. 删除旧按钮投影

- [x] 1.1 删除 graph-center 的 actions 字段、三角色 builder、路由 helper 和专属类型、常量、导出；保留证据构建链。
- [x] 1.2 删除只验证旧按钮的测试，调整混合测试与过时规范引用，不删除有效权限、隐私和资源判断用例。

## 2. 验证

- [x] 2.1 运行 graph-center、teacher-kaq-evidence-trace、konling-kaq-graph-context、resource-field-completion-audit 的相关测试，确认现有输出和权限行为保持。
- [x] 2.2 运行 typecheck、相关 lint、OpenSpec strict 与 git diff --check；用普通 diff 简述生产代码和测试净减少量。

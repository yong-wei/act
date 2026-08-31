## 1. 请求层升级实现

- [x] 1.1 在 `prepareSiliconFlowRequestBody` 实现 json_object → json_schema 升级（白名单 gate + `必须遵循的 JSON Schema：` 标记提取 + `strict:false` + `name: governed_output`），三个条件任一不满足保持原样
- [x] 1.2 单测：升级生效（白名单 + json_object + 有效标记）、无标记保持、标记 JSON 损坏保持、非白名单模型保持、无 response_format 保持、`enable_thinking` 注入不受影响

## 2. 验证

- [x] 2.1 真实生产规模探测：44KB 诊断 prompt + 生产诊断 schema + 2400 tokens + 120s 窗口经完整生产链路（`generateUnvalidatedJson` → adapter）窗口内成功返回合法报告
- [x] 2.2 `rtk npm run typecheck` 零错误、`rtk npm run lint` 不引入新错误、相关单测全量通过
- [x] 2.3 #1729 live 评测恢复可执行（每场景 ≥3 次重复出阈值结论）作为修复后验收步骤

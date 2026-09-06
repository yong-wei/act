## Context

`buildGraphCenterPayload` 的生产调用方是 `konling-kaq-graph-context.ts` 和 `teacher-kaq-evidence-trace-server.ts`。前者取覆盖率和 overlay，后者通过 `createTeacherKaqEvidenceTracePayload` 投影节点、SAR、资源缺口和返回链接；均不读取 `selectedNode.actions`。路径规划仅引用覆盖率等类型。

`graph-center.ts` 中 `buildGraphCenterActions` 到 `formatGraphCenterActionQuery` 约 320 行，另有专属 action 类型与映射。`graph-center.test.ts` 仍测试这些按钮，不能据此保留旧实现。`graph-center-ui` 已明确 `/knowledge` 不包装旧 Graph Center payload。

## Goals / Non-Goals

目标是直接删除无消费者的展示逻辑，减少 Data Governance 遗留复杂度。

不删除整个 graph-center 模块，不重命名所有 GraphCenter 类型，不移动领域目录，不改 Konling、教师证据查询和目标页面的实际业务行为；尤其不删除 SAR 授权、脱敏、overlay 小样本抑制或资源资格判断。

## Decisions

1. 删除 `actions` 而非保留空数组兼容层；它是内部旧展示字段，现有生产输出不依赖它。
2. 一并删除三角色 action builder、target/query helper 和因此失去用途的映射、导出。保留同文件内仍被证据投影使用的 helper。
3. 删除仅验证旧按钮及其字符串的测试；混合测试保留有效业务断言。不新增通用退役扫描器或单独证据清单。
4. 普通 diff 统计即可说明净减少量。预期删除数百行生产代码，具体以实现结果为准；不新增摘要生成器或收益校验脚本。

## Risks / Trade-offs

同文件还包含正在使用的证据实现 → 以删除 action 构建链为范围，运行现有 graph-center、teacher-kaq-evidence-trace、konling-kaq-graph-context 与 resource-field-completion-audit 相关测试。目标页面的访问控制和可访问性不属于删除范围。

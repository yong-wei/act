## Context

调查基于 `integration` 的 `f0399d234`。`src/lib/control-engine/server-consumers.ts`（77 行）只包含手写数组和常量，生产消费者直接调用 `server.ts`，未读取该表。`server-control-engine-consumers.test.ts`（67 行）检查登记表、源码片段及已退役路径；`index.ts:85–92` 仍导出这些元数据。运维文档仍把已完成的 loader 删除称为未来 R6 工作。

## Goals / Non-Goals

删除这组相互支撑但不参与生产的元数据与测试。保留 façade、数值执行、Arena 官方评分权威、预览持久化和 `control-engine/inventory.ts` 的现行 Practice 约束。

## Decisions

- 直接删除登记表、对应测试和 re-export，不把数组迁入另一个文件。
- 复用 `control-engine-facade.test.ts` 的 generated-import 检查，以及 simulation、Practice、Odyssey、Arena 的实际执行测试。文档描述稳定入口即可，不再维护逐 caller 清单。
- 当前生成包曾在调查中触发 `stale-generated-package`。实施时按仓库已有 WASM 构建命令刷新后运行数值测试；不得放宽包身份检查，也不得把静态测试通过写成数值测试通过。

## Risks / Trade-offs

删除逐 caller 字符串检查后，生产入口约束继续由现有通用导入检查和实际执行测试验证。若发现某项仍有效的行为确无覆盖，只在现有对应测试中补充最小用例，不恢复登记表。

## Migration Plan

无数据或运行时迁移。删除文件、导出与过期文档同批提交。

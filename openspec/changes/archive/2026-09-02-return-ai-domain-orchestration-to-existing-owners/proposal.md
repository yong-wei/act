## Why

AI 相关调用逐步集中到通用 runtime 后，部分课程、评估、学习记录、个性化、Arena、知识资源和发布流程仍从 AI 层直接读取或编排领域内部状态。这样会把 AI 误当成业务事实 owner，扩大跨域依赖，也使领域自己的鉴权、幂等、审计和生命周期难以保持一致。

本 change 是 M7 的收口变更（C30）：在 C28 provider/stream runtime 与 C29 legacy bridge 退役完成后，把业务编排返回既有 canonical owners。AI 只负责受作用域约束的上下文、建议和工具意图；事实、写入和状态机仍由各领域 owner 决定。

## What Changes

- 以现有 charter owner 为唯一业务事实边界：assessment、personalization、learning-record、course、classroom、assignment、practice-lab、arena、knowledge、identity 和 platform/ delivery。
- 将 AI route、tool adapter、assistant workflow 及报告/课件/教案调用改为依赖对应领域的 `public-api`、application use case 和 infrastructure-neutral ports；删除跨域 deep import 和 AI 内部重复状态机。
- 让 AI 只产生 advisory response 或经 registry 授权的 tool intent；领域 owner 负责校验、写入、幂等、审计、事件和失败状态。
- 保留现有 provider、session、PlatformSetting、ingress schema、timeout/privacy、AppShell/角色、SSR/R3F 和 release/rollback validator 边界。
- 增加“AI 建议不等于业务事实”、跨域调用方向、未授权工具、并发/重试和旧结果隔离测试，证明没有第二套 AI workspace 或事实 store。

## Capabilities

### New Capabilities

- `ai-domain-orchestration-boundaries`: 规定 AI 与既有领域 canonical owner 之间的只读上下文、工具意图和业务事实边界。

### Modified Capabilities

None. `modular-domain-dependency-contracts`、`konling-agent-runtime` 和各领域规范继续保持其既有要求；本 change 将调用实现对齐到这些 owner，不复制或削弱它们。

## Impact

- 主要范围：`src/app/api/ai/**`、`src/lib/konling-agent-runtime.ts`、`src/lib/ai/**`、`src/features/ai/**`、各领域 `public-api` / application / adapter 以及相关 tests。
- 前置依赖：C28 `consolidate-ai-provider-and-stream-runtime`、C29 `retire-legacy-chat-bridges`，并要求上述各领域 canonical owner 已登记可用的 public/application contract。
- 不改领域数据模型、PlatformSetting schema、课程 runtime、学生提交/学习事实、生产 selector、部署或发布流程。
- C33 依赖本 change 与 C9/C16 的 canonical owner/read-model 合同；C31/C32 可与本 change 平行但不得借 AI layer 添加新业务事实。

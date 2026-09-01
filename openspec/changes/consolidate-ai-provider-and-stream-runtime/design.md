## Context

provider 配置已经由 `src/lib/ai/provider-settings.ts` 读取 `PlatformSetting` 并通过 provider registry 选择 adapter；`model-provider-compatibility.ts` 负责能力矩阵和 provider-independent response contract。与此同时，旧的 `ai-client`、message compatibility、stream compatibility 和各业务路由仍各自做一部分转换。C28 只处理实现重复和入口分散，不把 AI 提升为业务编排中心。

## Goals / Non-Goals

**Goals:**

- 让 provider selection、adapter invocation、stream event normalization 和 redacted error projection 各有一个可定位的 owner。
- 让同步结果与流式结果共享同一消息、工具、引用和终止状态语义。
- 保持 PlatformSetting、secret reference、ingress schema、timeout、Abort、privacy 和审计行为。
- 为 C29 提供稳定的 canonical seam，并能证明删除 alias 不改变可观察行为。

**Non-Goals:**

- 不创建新的万能 AI workspace、第二套 conversation store、第二套 shell 或第二套门禁。
- 不让模型决定课程事实、评分、LearningFact、画像、发布资格或生产状态。
- 不新增 provider kind、数据库模型、业务领域 use case 或跨领域 orchestrator。
- 不改变 AppShell、角色权限、SSR/R3F 或 release/rollback 唯一安全 validator。

## Decisions

### 1. Extend the existing provider owner

以 `src/lib/ai/provider-registry.ts`、`src/lib/ai/providers/*` 和现有 compatibility types 作为唯一 runtime owner。必要的共享 helper 放回该 owner 的现有边界；不新建另一个 `ai-runtime` 根目录或平台级 façade。`src/lib/ai-client.ts` 只在确认所有调用者迁移后删除或缩为明确的非权威适配入口。

### 2. Normalize once at the provider boundary

每个 adapter 将请求、非流式响应和 provider stream 映射到现有 `NormalizedAIResponse` / `NormalizedAIStreamEvent` 语义。业务路由不再解析 provider-specific chunks、DSML、tool parts 或引用字段。重复 parser 必须由 characterization fixture 证明等价后再删除。

### 3. Preserve configuration and ingress authority

运行时从 `PlatformSetting` 读取已验证配置，保留 service id、capability、health、priority、secret reference 和 runtime adapter 支持检查。请求仍先经过当前 route/schema ingress、作用域鉴权和 timeout/Abort；provider error 只能经过现有 redaction 后进入日志或用户状态。

### 4. Keep AI advisory and side-effect-free by default

provider runtime 只返回规范化模型结果或工具事件。需要写入的工具仍由所属领域 registry/use case 执行并自行鉴权、幂等和审计；AI response 本身不得成为业务事实，也不得绕过课程、评估、学习记录或发布 owner。

### 5. Verify before deleting compatibility aliases

先建立 route、interactive hook、smart-lesson/courseware、diagnosis 和 admin provider test 的行为基线，再按调用图迁移。删除顺序为调用者 → compatibility import → 未使用 wrapper；若仍存在外部兼容调用，保留薄 adapter 并标记 owner、删除条件和不具备 authority 的状态。

## Risks / Trade-offs

- [Risk] 不同 provider 的流终止或 tool event 细节被过度合并。→ 保留 event type、finish reason、provider kind 和 failure code；每类 adapter 必须有反例 fixture。
- [Risk] 删除旧 wrapper 后某个 SSR 或 worker 入口失效。→ 先做生产 Web/worker/tool/test graph 的 import inventory 和运行 smoke，再删除文件。
- [Risk] Provider 错误泄露 secret 或内部诊断。→ 复用现有 redaction 和公开错误 contract，测试日志、HTTP body 和 UI 都不含敏感字段。
- [Risk] AI runtime 被误用为事实写入入口。→ design、spec 和测试明确业务 side effect 必须回到 canonical owner；没有 owner 的调用 fail closed。

## Migration Plan

1. 记录现有 provider、message、stream、tool、citation、timeout 和错误行为；为每个生产图建立调用者清单。
2. 在现有 provider owner 内补齐一个共享规范化入口和最小 fixtures，保持现有 API contract。
3. 逐个迁移 route、interactive hook、smart-preparation、diagnosis 和 admin smoke caller；每批运行直接回归与 typecheck。
4. 删除无调用者的 parser/wrapper/alias；剩余兼容入口只能是明确的 ingress adapter，不能形成第二 authority。
5. 运行 affected AI suites、`typecheck`、lint、`verify:commit`/`verify:push` contract 和 OpenSpec strict validation；交给 C29 前冻结 canonical owner 及删除清单。

回滚只恢复被删除的兼容入口或调用映射，不回滚 PlatformSetting、provider matrix、业务事实或生产 selector；恢复后的入口仍受相同 schema、timeout、privacy 和 adapter support gate 约束。

## Open Questions

无。若某个调用者无法证明等价迁移，应保留为非权威适配器并记录删除条件，不通过新增抽象绕过不确定性。

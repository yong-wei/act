## Why

当前 AI 请求、provider 选择、消息兼容转换和流式解析分散在 `src/lib/ai-client.ts`、`src/lib/ai/`、`src/lib/ai-message-compat.ts`、`src/lib/ai-stream-compat.ts` 以及多个路由和 Hook 中。相同的 provider 语义在不同入口被重复包装，容易造成超时、工具调用、引用和错误脱敏口径漂移，也让后续退役旧 chat bridge 变成高风险操作。

本 change 是 M7 的第一项基础变更（C28）：在现有 `src/lib/ai` provider owner 内收敛 provider 与 stream runtime 的唯一实现边界，减少派生 wrapper 和 alias，同时保持现有业务 owner、PlatformSetting 真源及 AI 非业务事实边界不变。

## What Changes

- 在现有 `src/lib/ai/provider-registry.ts`、provider adapters 和 compatibility contracts 中明确唯一 provider/stream runtime owner；各业务入口只依赖已存在的公开 runtime contract。
- 将 provider 选择、消息转换、流事件、工具调用、引用和 provider 错误脱敏收敛到一次规范化流程；删除已迁移调用者不再需要的重复 wrapper、alias 和 route-specific parser。
- 保留 `PlatformSetting` 作为 provider 配置持久化真源、secret reference 及 admin/service 作用域；不新增 provider 配置表或平行配置文件。
- 保留所有 ingress schema、请求超时、取消、隐私脱敏和审计边界；不可验证或超时的 provider 结果继续显式失败或降级。
- 明确 AI 输出只能作为建议、候选或解释，不能写成课程、评估、学习事实、画像、发布或其他业务权威。
- 增加旧/新 provider fixture、流事件、工具调用、引用、超时和敏感信息回归证据，为 C29 的 bridge 退役提供可复用 seam。

## Capabilities

### New Capabilities

- `ai-provider-stream-runtime`: 规定现有 provider owner 的单一选择、适配、流规范化、错误和隐私边界。

### Modified Capabilities

None. `model-provider-compatibility` 和其他 AI 业务规范仍分别拥有 provider 能力、运行时支持和业务语义；本 change 只收敛其实现入口，不改变业务结论。

## Impact

- 主要范围：`src/lib/ai/`、`src/lib/ai-client.ts`、`src/lib/ai-message-compat.ts`、`src/lib/ai-stream-compat.ts`、AI API routes、interactive AI hooks 及其测试。
- 依赖现有 provider compatibility matrix、`PlatformSetting`、ingress Zod schema、timeout/Abort 处理、privacy redaction 和 `verify:commit` / `verify:push` / `typecheck` 门禁。
- 不改 Prisma schema、课程/评估/学习记录事实模型、AppShell、角色边界、SSR/R3F 边界、生产 selector 或 release/rollback validator。
- 这是 C28；C29 依赖本 change 的稳定 canonical runtime，C30 还需等待 C29 及各领域 canonical owner。

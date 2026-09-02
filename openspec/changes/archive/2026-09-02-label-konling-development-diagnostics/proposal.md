## Why

控灵流式引用诊断已经通过环境开关控制：生产默认不注入原始 reason code，开发环境可以为排障显示完整诊断。但当前可见前缀只有“控灵证据提示”，没有说明这是开发模式诊断；`missing-learner-state`、`missing-path-execution` 等内部标识会和普通学习回答混在一起。

这不构成生产默认泄露，却违反 `konling-agent-runtime` 对开发诊断显式标识、并与正式引用分离的要求。学生或测试使用者无法判断哪些文字是学习内容，哪些只是内部排障信息。

## What Changes

- 为所有允许注入浏览器文本的开发/支持引用诊断增加明确的开发模式或支持诊断标识。
- 让诊断区块与正式引用状态在文本语义和 UI 呈现上保持可区分。
- 保留 #693 的开发排障信息、生产默认隐藏策略和服务端诊断持久化。
- 增加开发、生产和显式支持调试覆盖的回归，防止标识缺失或生产 raw token 回归。

## Capabilities

### Modified Capabilities

- `konling-agent-runtime`: 流式引用诊断必须显式标识环境身份，并与正式引用呈现分离。

## Impact

- 生产代码：`src/lib/konling-streaming-citation-fallback.ts` 及其测试。
- 主要收益：学生端/开发端能区分学习回答、正式引用与排障文本，避免把内部 reason code 误认为课程内容。
- 不改变生产默认安全策略、引用算法、诊断持久化或模型上下文。

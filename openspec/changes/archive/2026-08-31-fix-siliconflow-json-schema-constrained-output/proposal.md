## Why

诊断基准 live 评测（#1729）24 次真实调用中 22 次失败（11 次超时、11 次空输出）。逐层排查证实：SiliconFlow 服务可用、`enable_thinking=false` 已正确注入、大 prompt 本身仅 9.8s——根因是 ai-sdk v5 `Output.json` 走 `response_format: json_object` 无约束解码，Qwen3.5-35B-A3B 在诊断规模 prompt 下输出膨胀，2400 token 输出预算处截断（finish=length），`Output.json` 解析失败后 text-JSON fallback 二次请求同样截断；负载慢时两段请求超出 120s 生产窗口。裸测同规模 `json_schema` 约束解码 14s 内 `finish=stop` 完成且 JSON 合法。ai-sdk 该版本不支持把 json_schema 传入 response_format。

## What Changes

- 在 `prepareSiliconFlowRequestBody`（既有 `enable_thinking` 注入所在的请求改写点）增加结构化输出升级：当请求满足以下全部条件时，把 `response_format` 从 `json_object` 升级为 `json_schema`（`name: governed_output`、`strict: false`）：
  1. 模型在既有 `QWEN_MODELS_WITH_THINKING_TOGGLE` 白名单内；
  2. 请求携带 `response_format: {"type": "json_object"}`；
  3. 最后一条 user message 的 content 尾部能确定性提取 `必须遵循的 JSON Schema：<json>` 标记（`generateUnvalidatedJson` 拼接的固定格式）且 JSON 解析成功。
- 三个条件任一不满足即保持原请求不变（fail-open，不破坏既有行为与非白名单模型）。
- `enable_thinking` 注入行为不变。

## Capabilities

### New Capabilities

- `siliconflow-structured-output`: SiliconFlow 适配器对结构化输出的请求形态约束（约束解码升级与 fail-open 语义）。

### Modified Capabilities

- None.

## Impact

- 受影响代码：`src/lib/ai/providers/siliconflow.ts`、相关单测。
- 行为影响：白名单内模型（Qwen3.5-35B-A3B / Qwen3.6-35B-A3B）的 governed structured 调用（smart-lesson-plan、诊断等共享 `generateUnvalidatedJson` 链路）从无约束解码升级为约束解码，消除输出膨胀截断；其余模型与非结构化请求不变。
- 验证：单测覆盖升级/保持/fail-open 分支；真实生产规模探测（44KB prompt + 生产诊断 schema + 2400 tokens + 120s 窗口）窗口内成功；#1729 live 评测恢复可执行。

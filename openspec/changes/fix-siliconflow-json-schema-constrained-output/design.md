## Context

生产 structured provider 链路：`resolveSmartLessonStructuredProvider` → `generateUnvalidatedJson`（ai-sdk `generateText` + `Output.json`，prompt 尾部拼接 `必须遵循的 JSON Schema：<json>` 标记）→ `createSiliconFlowAdapter` 的 fetch 包装（`prepareSiliconFlowRequestBody` 已在此注入 `enable_thinking`）。#1744 排查钉死失败链：`json_object` 无约束解码 → 输出膨胀 → 2400 tokens 截断 → `Output.json` 解析失败 → fallback 二次截断 → 失败/超时。

## Goals / Non-Goals

**Goals:**

- 白名单模型的结构化调用获得约束解码（`json_schema`），在既有输出预算内产出完整合法 JSON。
- fail-open：任何提取/gate 条件不满足时保持现状请求，绝不因升级逻辑引入新失败。
- 修复点集中单一（既有请求改写函数），不扩散到 ai-sdk 或调用方。

**Non-Goals:**

- 不改 ai-sdk 或引入新 SDK 版本。
- 不调整生产输出 token 预算或超时窗口（约束解码后无截断，预算已充分）。
- 不为非白名单模型开启 json_schema（其他模型兼容性未验证）。
- 不处理 DeepSeek-V4-Flash 专用 curl 分支。

## Decisions

1. **升级在 fetch 包装层做**。ai-sdk v5 `Output.json` 无 response_format 选项（类型与实现均确认），而 `prepareSiliconFlowRequestBody` 已是 `enable_thinking` 注入的既定改写点——同一函数扩展，风险面集中。
2. **schema 提取依赖自有固定标记**。`generateUnvalidatedJson` 拼接的 `必须遵循的 JSON Schema：` 前缀 + 紧随其后的 JSON 文本是确定性格式；用 `lastIndexOf` 定位最后一条 user content 中的标记，取标记后的子串 `JSON.parse`。解析失败即放弃升级（fail-open）。提取范围限定 messages 数组最后一条 user role 的字符串 content，避免歧义。
3. **`strict: false`**。生产 zod 生成的 JSON Schema 未必满足 OpenAI strict 形态（全字段 required、additionalProperties 显式声明），strict:false 已实测（2.1s、finish=stop、合法输出）且不要求 schema 形态，是兼容面最大的选择；约束解码效果与 strict:true 无实测差异。
4. **复用 `QWEN_MODELS_WITH_THINKING_TOGGLE` 白名单**。这两个模型（Qwen3.5-35B-A3B / Qwen3.6-35B-A3B）是本次验证过 enable_thinking 与 json_schema 行为的集合；新模型加入白名单时两个开关一起生效，语义一致。
5. **升级仅当请求已带 `json_object`**。这是 ai-sdk structured 路径的标志；fallback 裸文本请求（无 response_format）不受影响，保持 fallback 语义纯粹。

## Risks / Trade-offs

- SiliconFlow 未来对 json_schema 的行为变化 → fail-open 只退回现状（json_object），不产生新失败面；探测与 live 评测可持续回归。
- 其他共享链路（smart-lesson-plan 等）也升级为约束解码 → 输出更合规是预期收益；若个别调用依赖宽松输出形态，退路是移除标记或离开白名单。
- 标记文本属于内部实现细节，若 `generateUnvalidatedJson` 改格式需同步 → 单测双向锁定（改写函数测试 + generateUnvalidatedJson 拼接测试），格式变更会先红测试。

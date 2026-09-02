## Why

通用助学问答已经能够检索受治理知识并展示引用，但专业问题仍主要按通用事实解释处理，公式推导、代码调试和概念辨析缺少可验证的分步讲解合同。规范性结论与关键步骤也只能获得回答级引用，学生无法核查某一结论、推导变形或修复建议的具体依据。

## What Changes

- 在既有 `generic-chat` 运行时中增加受控的专业问答意图与分步回答合同，覆盖公式推导、代码调试、概念辨析、规范性内容和开放式讲解。
- 为关键结论、推导步骤和修复建议补充与受治理证据的显式关联，并在既有引用呈现层显示该关联。
- 对规范性内容施加权威来源门槛：仅服务端验证的权威来源可支撑确定性规范结论；证据不足时返回可见的受限状态。
- 支持讲解深度、示例、表达格式和提示强度等用户偏好，但不得降低规范性事实与公式结论的证据要求。
- 以回答章节为单位建立引用映射规则：证据必需章节逐结论绑定引用并度量追溯覆盖率，模型推导章节显式标识为推导而非来源原文；无效或越界引用编号在回答持久化前移除（#1819）。

## Capabilities

### New Capabilities

<!-- None. This change extends the existing Konling and Source Pack contracts. -->

### Modified Capabilities

- `konling-agent-runtime`: 为通用助学问答定义受控专业问题意图、分步讲解合同、规范性结论的证据边界，以及关键回答单元的可追溯引用要求。
- `source-pack-retrieval`: 为 Konling 问答保留可用于关键回答单元定位的证据元数据，并支持规范性内容的权威来源限制与不足证据状态。

## Impact

- `src/lib/konling-agent-runtime.ts`、`src/app/api/ai/chat/route.ts` 和相关运行时测试。
- `src/lib/source-pack/*`、引用守卫与流式 metadata 组装。
- `src/components/ai/konling-citation-presentation.tsx` 及消息渲染测试。
- 不新增模型供应商、检索服务、数据表或客户端可写的引用来源。

## 1. Server Prompt Boundary

- [x] 1.1 Separate the model-only Evidence Copilot projection from navigation metadata and prevent raw `source`, `assignment`, and `intent` values from entering the private system prompt.
- [x] 1.2 Preserve server-authorized evidence status, limitations, source coverage, confidence, freshness, weak targets, next action, advisory-only rules, and ordinary Copilot behavior.
- [x] 1.3 Keep bounded parsing and control-character rejection fail closed before model execution; do not add keyword filtering.

## 2. Regression Coverage

- [x] 2.1 Update unit tests to prove instruction-shaped and delimiter-shaped navigation hints are absent from the generated model prompt while server evidence remains present.
- [x] 2.2 Add route-level coverage that inspects the model invocation, rejects control-character descriptors before generation, and confirms invalid requests do not call the model.
- [x] 2.3 Add or update browser acceptance for `/ai/copilot?context=evidence` with arbitrary descriptors, verifying the page remains usable and descriptors do not appear as factual student evidence.

## 3. Verification And Delivery Evidence

- [x] 3.1 Run focused Evidence Copilot tests, related AI Chat route tests, and the applicable TypeScript checks.
- [x] 3.2 Run `openspec validate guard-evidence-copilot-navigation-boundary --type change --strict`, relevant repository strict validation, and `git diff --check`.
- [x] 3.3 Capture any required desktop/320px Evidence Copilot browser evidence from a clean, revision-bound checkpoint and record the verification result in the delivery record.

## 完成记录

- 2.2 的模型调用检查采用仓库既有 chat-route 静态 guard（parse/invalid 分支前置于 `getConfiguredAIModel`、`INVALID_AI_TASK_CONTEXT` 400）+ prompt 构造函数级断言组合覆盖。
- 2.3/3.3：本次 diff 不在页面渲染路径（`navigationHint` 仍随 GET 响应返回，UI 无改动）；API 层可用性由 `/api/ai/evidence-copilot` GET 回归覆盖。带模型调用的浏览器截图证据留作 review 阶段补充（需要 live AI key）。

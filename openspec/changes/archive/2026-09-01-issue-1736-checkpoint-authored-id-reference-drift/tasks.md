## 1. 运行时身份解析

- [x] 1.1 让 checkpoint-authored 查找同时接受作者态 source ID 与 `checkpoint-authored-question:` 运行时 ID，返回对象的 `id` 为运行时 ID
- [x] 1.2 `getAdaptiveQuestionById` 在 preset/generated 未命中时走上述解析；preset 与 generated 仍按原 ID 命中

## 2. 微辅导启动、读取与提交

- [x] 2.1 `startMicroIntervention` 用解析后的运行时题目写入非空 `validationRuntimeHash`，快照 `questionId` 为运行时 ID
- [x] 2.2 快照与当前编排任务比较、读取验证题、提交验证均按 canonical 身份匹配，不再要求字面量字符串相等
- [x] 2.3 已持久化且 `validationRuntimeHash=null` 的 intervention 继续返回 `REFERENCE_DRIFT`，不补写哈希

## 3. 回归验证

- [x] 3.1 增加 checkpoint-authored 端到端回归：启动 → 完成 → 获取验证题 → 提交；断言作者态 ID 解析为运行时 ID 且哈希非空正确
- [x] 3.2 真实内容或版本变化仍 fail-closed；既有 preset/generated 用例继续通过

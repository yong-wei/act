# 控灵开发诊断标识 Receipt

基线：`becb9746d7`（claim branch 建立点）。

## 1. 复现与合同确认（task 1.1 / 1.2）

- 开发注入分支（`shouldInjectStreamingCitationFallbackNotice` 为真时的详细诊断文本）此前使用与学生回退提示相同的前缀「【控灵证据提示】」，`missing-learner-state` 等内部 reason code 与学习内容无标识区分（1.1 回归：新增用例证明开发注入含内部字段但（修复前）无开发身份标识）。
- 生产默认与显式 override 行为对照 #693 合同确认不变：生产默认只保留学生安全短提示；`KONLING_STREAMING_CITATION_DEBUG_INJECTION` 显式开启才注入详细诊断。

## 2. 标识与分离（task 2.1 / 2.2）

- 开发/支持调试注入的详细诊断前缀改为「【控灵开发诊断｜仅排障，非学习内容】」，与生产学生提示「【控灵证据提示】」在文本语义上明确区分。
- 生产分支（含 raw token 抑制与学生安全短提示）逐字保留；引用算法、诊断持久化、模型上下文未改。

## 3. 回归（task 3.1 / 3.2）

- `konling-streaming-citation-fallback.test.ts` 6→7 项：新增身份回归（开发注入含标签 + 内部字段；生产默认无 raw reason、无开发标识、保留学生提示）；两处调试注入用例期望更新为开发标签；生产用例保持旧标签断言。
- 受影响面：route guard + smart-prep binding 测试通过；typecheck exit 0；`git diff --check` 干净。

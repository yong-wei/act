## Why

已合并的错答归因、微辅导编排和微干预后端能力没有学生端入口：自适应练习的错题反馈只能打开解析对话，无法开始、完成或验证一次受治理的微辅导。现在需要把这条已存在的服务端闭环接入学生的真实错题场景。

## What Changes

- 在自适应练习的持久化错题反馈中增加显式“开始微辅导”入口和完整的内嵌流程面板。
- 以持久化答案 ID 为前端唯一输入，由服务端重新核验归因所有权并创建或读取编排结果；浏览器不获得内部归因 ID。
- 接入任务可用/不可用、开始干预、资源使用、提示、完成、验证作答和下一步建议状态。
- 增加学生已开始干预后的受限验证题读取接口，只返回当前学生安全作答所需的题面和选项，绝不返回答案、解析或内部治理数据。
- 保持微辅导显式启动、幂等、授权和“不得更新掌握度或正式路径”的现有约束。

## Capabilities

### New Capabilities

- `student-micro-tutoring-flow`: 自适应练习错题反馈中的学生微辅导入口、执行状态、验证与受控建议体验。

### Modified Capabilities

None.

## Impact

- 修改 `src/app/assessment/adaptive-practice/page.tsx`，并新增可复用的学生微辅导客户端组件和契约。
- 扩展 assessment remediation API，使其可以由当前学生拥有的持久化答案安全启动流程，并提供干预实例的安全验证题读取。
- 复用 `wrong-answer-attribution`、`remediation-orchestration`、`micro-intervention-outcomes` 和现有授权模型；不修改 Prisma schema、迁移或教师端界面。

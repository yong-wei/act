## Why

学情诊断教师交付版（#2074）的主要结论处置区存在两个问题：

1. **无效占位与越界职责**：每条主要结论的处置区展示「暂无已注册补练资源」。当前实现（`src/lib/diagnosis-report-delivery.ts` 的 `resolveTeacherDeliveryActions`）在教师打开交付版时，按 finding 的 `knowledgeNodeId` 查询教师名下 `TeachingResource`、校验 `registryId` 是否已注册，再生成 `remediation` 类型操作。没有匹配资源时形成无效占位文案；有资源时把资源检索逻辑混入报告处置区域，与教师处置流程关系较弱。
2. **操作按钮视觉层级不足**：「已查看」「待处理」「已完成处置」「进入备课工作台」等按钮统一使用 `btn-ghost-themed` 浅色 ghost 样式，操作优先级与不同处置语义之间没有视觉区分。

仓库事实：`DiagnosisDeliveryAction` 的 `remediation` kind 仅由 `resolveTeacherDeliveryActions` 生成、仅被 `diagnosis-report-delivery-view.tsx` 消费（教师报告页面只透传）；`intervention-arranged` 处置输入属教师处置事件合同（spec 要求 SHALL allow，#2074 非目标明确不动处置事件模型与提交语义），API 路由不感知 action kind。

## What Changes

- `resolveTeacherDeliveryActions` 移除补练资源查询、registry 匹配与 `remediation` 操作生成；函数退化为纯投影（不再需要 `teacherId` 与 `getAllRegisteredResourceMetadata`）。报告级与 finding 级备课入口、学生详情入口保留。
- `DiagnosisDeliveryAction.kind` 收敛为 `'student' | 'preparation'`。
- 交付视图移除 finding 处置区的 `remediation` 分支（「标记已安排干预」按钮）与「暂无已注册补练资源」空态占位。
- 处置按钮视觉层级：新增 `btn-disposition` 系列样式（globals.css，遵循既有 chip 类 `@apply` + `dark:` 惯例），待处理用较深警示色、已完成处置用较深成功色、查看/备课入口用清晰主色，覆盖默认、悬停、键盘聚焦、禁用与记录中状态；状态语义不只依赖颜色（文字标签不同）。
- 更新教师交付动作解析与交付视图单元测试，增加「不再渲染补练资源空态/入口」「不再查询 TeachingResource」回归断言。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `teacher-diagnosis-report-delivery`：交付动作只保留学生详情与备课入口，不再查询/匹配已注册补练资源，不再渲染补练资源空态；处置操作按钮获得明确视觉层级需求。

## Impact

- `src/lib/diagnosis-report-delivery.ts`（动作解析简化；处置输入合同、幂等与审计语义不变）。
- `src/features/teacher/diagnosis-report-delivery-view.tsx`（移除 remediation 分支与空态；按钮样式）。
- `src/app/globals.css`（`btn-disposition` 系列）。
- `src/lib/__tests__/diagnosis-report-delivery.test.ts`、`src/features/teacher/__tests__/diagnosis-report-delivery-view.test.tsx`（测试更新与回归断言）。
- 不改：`DiagnosisReportDispositionEvent` 模型与处置输入 schema（`intervention-arranged` 仍被接受，`actionRef` 校验对剩余动作照常生效）、诊断结论/风险计算/报告证据、平台全局 ResourceNode/TeachingResource/学生端微辅导资源能力、PDF 交付链路。

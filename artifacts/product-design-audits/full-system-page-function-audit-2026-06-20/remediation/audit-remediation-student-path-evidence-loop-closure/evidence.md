# #725 Student path evidence loop closure evidence

整改变更：`audit-remediation-student-path-evidence-loop-closure`

关联审计 finding：
- 123：路径生成空状态与进度文案冲突
- 124：`evidence-review` intent 未形成证据复盘视图
- 229：`evidence-review` 空路径只显示选择历史
- 230：`path-selection` 真实 `path:null` 仍展示可比较路径
- 231：`path-execution` 无活动路径时降级为练习资源入口
- 334：真实学习路径 API 为空时 UI 仍展示进度和执行入口
- 336：path-selection、path-execution 和坏 pathId 状态仍被普通页面吞掉

## 本次覆盖

- `/assessment/adaptive-practice` 为 selection、execution、evidence-review 三类需要路径上下文的 intent 增加显式恢复态。
- 页面记录路径上下文加载状态；真实 `path:null`、无 latest path 和坏 `pathId` 不再继续展示可比较路径、路径执行面板或路径资源入口。
- 恢复态保留请求 intent、pathId、来源任务上下文，并提供生成学习路径、查看学习证据、返回来源三类动作。
- 恢复态使用 `role="status"` 与 `aria-live="polite"`，避免状态变化只依赖视觉差异。

## 既有闭环引用

- 任务完成、报告反馈写回、成长页和作品集候选收录状态沿用 `audit-remediation-student-learning-closure` 的合同与证据。
- 证据文件：`remediation/audit-remediation-student-learning-closure/evidence.md`。
- 本变更不重复实现该归档能力，只把剩余路径上下文恢复状态接入同一反馈任务上下文。

## 本地验证

- `rtk npx vitest run src/lib/__tests__/adaptive-path-execution-state.test.ts src/features/assessment/__tests__/adaptive-practice-page.test.ts`
- `rtk npx vitest run src/lib/__tests__/adaptive-learning-center-ui.test.ts`
- `rtk npx vitest run src/lib/__tests__/student-feedback-task-contract.test.ts src/lib/__tests__/student-feedback-task-ui-source.test.ts`
- `rtk npx eslint src/app/assessment/adaptive-practice/page.tsx src/lib/adaptive-path-execution-state.ts src/lib/__tests__/adaptive-path-execution-state.test.ts src/features/assessment/__tests__/adaptive-practice-page.test.ts --max-warnings=0`

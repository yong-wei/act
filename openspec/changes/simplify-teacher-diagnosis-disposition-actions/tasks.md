## 1. 交付动作解析简化

- [x] 1.1 `resolveTeacherDeliveryActions` 移除 `knowledgeNodeId` 汇总的 `teachingResource` 查询、registry 注册集匹配与 `remediation` 操作生成；签名退化为只吃 report（`teacherId` 不再需要），两处调用点同步。
- [x] 1.2 `DiagnosisDeliveryAction.kind` 收敛为 `'student' | 'preparation'`；删除 `getAllRegisteredResourceMetadata` 导入。
- [x] 1.3 保持处置输入 schema、`intervention-arranged` 接受性、`actionRef` 校验、幂等与审计语义不变。

## 2. 交付视图与样式

- [x] 2.1 移除 finding 处置区 `remediation` 分支（「标记已安排干预」按钮）与「暂无已注册补练资源」空态占位。
- [x] 2.2 globals.css 新增 `btn-disposition` 系列（neutral/pending/success），遵循既有 `@apply` + `dark:` chip 惯例；覆盖默认、悬停、`focus-visible`、禁用状态。
- [x] 2.3 交付视图中「已查看」「待处理」「已完成处置」与备课/学生详情入口改用对应 tone；记录中状态保持禁用 + 「记录中…」文案；打印输出继续不含处置控件。

## 3. 测试

- [x] 3.1 `diagnosis-report-delivery.test.ts`：动作解析测试改为断言仅 `student`/`preparation` kind；新增「教师交付读取不查询 `teachingResource`」回归断言；`intervention-arranged` 伪造引用拒绝、幂等冲突与学生安全预览测试保持通过。
- [x] 3.2 `diagnosis-report-delivery-view.test.tsx`：fixture 去掉 remediation 动作；新增「不渲染『暂无已注册补练资源』、不渲染『标记已安排干预』」回归断言；断言处置按钮携带区分 tone 的样式类；学生面与打印断言保持。

## 4. 验证

- [x] 4.1 定向 vitest：`src/lib/__tests__/diagnosis-report-delivery.test.ts` 与 `src/features/teacher/__tests__/diagnosis-report-delivery-view.test.tsx`。
- [x] 4.2 `rtk npm run typecheck` 零错误。
- [x] 4.3 `openspec validate simplify-teacher-diagnosis-disposition-actions --type change --strict` 通过。

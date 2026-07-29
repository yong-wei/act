## 1. 风险标记后台扫描 pipeline

- [ ] 1.1 在 `src/lib/` 下创建 `risk-scanner.ts`，实现确定性规则引擎
  - 定义规则接口：`type RiskScanRule = { evaluate(studentId: string): Promise<StudentRiskFlag | null> }`
  - 实现 `stagnation` 规则：连续 N 个评估窗口 KnowledgeProgress 未提升
  - 实现 `participation` 规则：连续 M 天无活动记录
  - 实现 `constraint` 规则：进度锁在特定节点超过阈值时间
  - 实现 `cross_domain` 规则：能力向量维度间标准差超过阈值
- [ ] 1.2 注册 scheduler worker 定时执行扫描
  - 在 `scripts/` 或 worker 配置中新增定时任务（参考现有 scheduler 模式）
  - 扫描周期建议：每日凌晨执行，单次处理不超过 500 名学生
- [ ] 1.3 扫描结果写入 StudentRiskFlag 表
  - 去重：同 student + flagType 且未 resolved 的不重复创建
  - 附加 evidenceJson：触发条件的具体数据

## 2. Konling TA 诊断 mode 注册

- [ ] 2.1 在 `KonlingTeachingAssistantModeId` 联合类型中新增 `teacher-diagnosis`
- [ ] 2.2 在 `KONLING_TEACHING_ASSISTANT_MODE_REGISTRY` 中注册 mode：
  - id: `teacher-diagnosis`，label: `学情诊断`
  - supportedRoles: `[teacher]`
  - mountingSurfaces: `[teacher-dashboard-diagnosis]`
  - requiredContext: 无（手动触发不依赖上下文）
  - permittedTools: `[get_student_risk_flags, get_class_competency_summary, get_student_knowledge_progress]`
  - outputStatus: `advisory-only`（诊断建议，不自动执行教学动作）
- [ ] 2.3 实现三个诊断专有工具（在 `src/lib/ai-tools.ts` 或新建 `src/lib/diagnosis-tools.ts`）
  - `get_student_risk_flags`: 输入 studentId/classId → 返回 StudentRiskFlag[]
  - `get_class_competency_summary`: 输入 classId → 返回 ClassCompetencySnapshot 最新聚合
  - `get_student_knowledge_progress`: 输入 studentId + nodeId 列表 → 逐节点进度 0-100

## 3. 诊断报告持久化

- [ ] 3.1 扩展 Prisma schema 新增 `DiagnosisReport` 模型
  - `id`, `scopeType` (class/student), `scopeId`, `reportBody` (Json), `generatedAt`, `generatorVersion`, `userId` (触发教师)
- [ ] 3.2 生成 migration
- [ ] 3.3 在 `/api/ai/chat` Konling mode 流程中，识别 `teacher-diagnosis` mode 完成后自动持久化报告

## 4. 诊断 → 备课链接实现

- [ ] 4.1 在诊断报告渲染中，薄弱知识点作为可点击链接
  - 链接格式：`/teacher/preparation?knowledgeNodeId=<id>&scope=<classId>`
- [ ] 4.2 在备课工作台接收 `knowledgeNodeId` query 参数，定位到对应知识点位置

## 5. 前端集成

- [ ] 5.1 在教师仪表盘（`teacher-dashboard-data.ts` / `teacher-dashboard.tsx`）中新增诊断入口
  - 展示当前班级风险标记摘要（从 StudentRiskFlag 读取）
  - "生成诊断"按钮 → 调用 `/api/ai/chat` 并指定 `teachingAssistantModeId: "teacher-diagnosis"`
- [ ] 5.2 引用 `role-based-learning-diagnosis` spec 的视图规范，实现班级级和学生级诊断报告渲染
  - 班级级：弱知识点分布、能力趋势、风险学生列表 → 教师备课参考
  - 学生级：个体知识点薄弱点、错题归因、学习行为异常 → 教师个别辅导入口

## 6. 验证

- [ ] 6.1 Vitest 单元测试：`risk-scanner.test.ts`（三条确定性规则的输入/输出）
- [ ] 6.2 Playwright E2E：教师仪表盘 → 点击生成诊断 → 查看班级报告 → 点击薄弱知识点跳转备课工作台
- [ ] 6.3 `rtk npm run typecheck` 通过
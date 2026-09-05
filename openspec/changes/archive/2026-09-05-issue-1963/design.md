## Context

`DiagnosisReport`（`prisma/schema.prisma`）已具备 `scopeType/scopeId`、`classId`、`evidenceCutoff`、`generationJobId`（唯一）、`previousReportId` 链；`persistDiagnosisReport`（`src/lib/diagnosis-persistence.ts:469`）是唯一写入口，已做教师班级范围与证据截止校验。班级页历史 UI 在 `src/features/teacher/teacher-diagnosis-report-history.tsx`（880 行）+ `teacher-diagnosis-report-history-projection.ts`（525 行）。班级成员经 `StudentProfile`（classId + userId）读取。七维画像主源是 portrait v2（`abilityVector` 仅兼容字段）。

## Goals / Non-Goals

- Goals：版本化指标快照与报告同边界冻结；演变板块三层结构与可比性断连；旧报告降级；教师页面独占。
- Non-Goals：学生级趋势、日/周/月实时重算、教学成效判断、从文字反推指标、画像目录与干预流（Issue 非目标）。

## Decisions

### D1: 快照为独立表 `DiagnosisMetricSnapshot`，1:1 挂 `DiagnosisReport`

不把指标塞进 `reportBody` JSON：指标需要独立 schema 版本演进与不可变审计，独立表使「AI 不可写指标」可由持久化边界强制（快照列只由服务端计算路径写入）。字段：`reportId`（唯一外键）、`schemaVersion`、`computationVersion`、`scopeType/scopeId`、`memberSetFingerprint`（成员集合身份哈希，不含 learner id）、`evidenceCutoff`、`metrics`（Json，七维/成绩/风险/薄弱点与分母、可用性）、`generatedAt`。旧报告无行即「历史指标不可用」，无需迁移回填。

### D2: 指标计算为服务端纯函数，输入在 `evidenceCutoff` 内冻结

`computeClassDiagnosisMetrics(inputs, computationVersion)` 纯函数：输入为 cutoff 内的学习证据聚合（七维画像均值与置信度、作业/测评成绩、风险桶、薄弱知识点覆盖），输出带分母与可用性的 metrics JSON。`persistDiagnosisReport` 在既有校验通过后于同一 `create` 边界嵌套创建快照（Prisma 嵌套写保证同一成功边界）。缺失维度输出 `null`/`unavailable`，不补零。

### D3: 可比性由投影层判定，趋势点只来自快照

读取侧（沿用 `read-report-history` 的 ports/adapters 结构）取最近 6 次同 scope 报告 + 快照；投影纯函数按 `(scopeType, scopeId, memberSetFingerprint, coverageBasis, schemaVersion, computationVersion)` 五元组比较相邻快照，不一致处产出 `break` 记录与原因文案，前端据此断开趋势线。旧报告无快照 → `historical-unavailable` 降级点。

### D4: UI 三层结构挂在既有班级历史页

`teacher-diagnosis-report-history.tsx` 新增演变板块区（不进 `diagnosis-report-delivery-view.tsx` 等交付/打印/学生安全面）。单指标趋势图用纯 SVG/既有图表模式（不引新依赖），指标切换为受控状态。

## Risks / Trade-offs

- [快照与报告非原子] → 用 Prisma 嵌套 create（同一事务边界）；测试断言两者同生同灭。
- [指标口径漂移] → `computationVersion` 参与可比性；升版本即全量断连，明确提示版本变化。
- [班级页文件已 880 行] → 演变板块为独立子组件文件，经 props 组合；页面不因本变更继续膨胀。
- [成员指纹碰撞] → fingerprint 采用排序 learner id 集合的确定性哈希，仅用于相等性比较，不承担隐私标识。

## Migration Plan

新表 `DiagnosisMetricSnapshot`（无回填）。迁移 + `prisma generate`；兼容读取：无快照行的旧报告走降级路径（已由 D3 覆盖）；回滚验证：删除表不影响既有报告读写。

## Open Questions

（无）

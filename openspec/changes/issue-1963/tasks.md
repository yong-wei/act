## 1. Schema 与指标计算

- [ ] 1.1 `prisma/schema.prisma` 新增 `DiagnosisMetricSnapshot`（reportId 唯一外键、schemaVersion、computationVersion、scope、memberSetFingerprint、evidenceCutoff、metrics Json、generatedAt）+ 迁移；处理 `DiagnosisReport` 反向关系。
- [ ] 1.2 服务端纯函数 `computeClassDiagnosisMetrics`：七维均值/平均置信度/纳入与缺失人数、作业与测评均值及分母、风险分布、薄弱知识点身份/弱势人数/覆盖人数、逐指标可用性；缺失保留 null/unavailable 不补零。
- [ ] 1.3 `persistDiagnosisReport` 同边界嵌套创建快照（成员指纹为排序 id 集合确定性哈希）；模型输出仅写报告文字字段。

## 2. 读取投影与可比性

- [ ] 2.1 读取路径返回最近 6 次同 scope 报告 + 各自快照（无快照 → 降级标记），教师班级授权 fail closed。
- [ ] 2.2 投影纯函数：相邻快照按 scope/成员指纹/覆盖口径/schema/计算版本五元组比较，产出差值、趋势点、断连记录与原因；不产出改善/恶化判断。

## 3. 演变 UI

- [ ] 3.1 班级历史页新增独立演变子组件：关键差值层、可切换单指标趋势层（断连可视化）、快照明细层（生成时间/证据截止/纳入人数/版本）。
- [ ] 3.2 旧报告显示「历史指标不可用」；板块不进入交付版、打印页、学生安全版与 PDF。

## 4. 验证与交付

- [ ] 4.1 回归测试：指标物化与确定性（同输入同输出）、同边界原子性、不可变性（AI 文本不影响指标）、不补零、可比性断连与原因、旧报告降级、教师授权拒绝、打印/交付范围排除。
- [ ] 4.2 迁移与兼容读取验证（旧报告无快照路径）；typecheck、lint、聚焦套件全绿。
- [ ] 4.3 `openspec validate issue-1963 --strict` 通过；实现、主 specs 同步与 archive 同 PR 交付。

# 设计：增强班级学生学情检索并连接诊断报告入口

## Context

`src/app/teacher/classes/[classId]/page.tsx` 的"班级学生"表当前直接渲染 `classData.students`（来自 `/api/teacher/classes/[classId]`），学情字段来自 `insights.students`（来自 `/api/teacher/classes/[classId]/insights` 批量投影，通过 `studentInsightMap` 按 `user.id` 关联）。两份数据在页面加载时已全量在内存。诊断报告历史由 `TeacherDiagnosisReportHistory` 自包含组件渲染（`#diagnosis-report-history`）。

字段口径（来自 `TeacherClassInsightsPayload`）：
- 风险：`riskLevel: 'none' | 'low' | 'medium' | 'high'`
- 趋势：`trendDirection: 'up' | 'stable' | 'down' | 'not-comparable'`
- 证据缺失：`evidenceStatus.state === 'missing'`
- 画像不可用：insight 缺失（`studentInsightMap` 无记录）或 `availabilityReason !== 'available'`

## Goals / Non-Goals

**Goals**：检索、组合筛选、稳定排序、命中反馈、空状态、报告区域入口、口径标注，全部客户端完成，零新增 API。

**Non-Goals**（沿用 Issue #1964 非目标）：不新建画像模型或重算画像、不做学生级报告历史趋势、不在班级报告中内嵌完整画像、不做干预/通知/批注、不做批量操作与导出、不做风险或低分排名。

## Decisions

### D1：客户端过滤排序，零服务端改动

数据已全量在内存（班级成员 + 批量学情投影），筛选与搜索在渲染时派生。备选"服务端筛选 API"被否决：会新增请求路径且违背"不逐生请求"与最小改动原则。

### D2：过滤排序逻辑抽为纯函数模块

新增 `src/features/teacher/class-student-roster.ts`，导出筛选状态类型、`filterClassStudents(students, insightMap, filters)` 与稳定比较键。理由：页面组件保持渲染职责，纯函数可直接单测（搜索、组合筛选、稳定排序、空状态口径），页面用 `useMemo` 调用。

稳定排序键：`studentNumber ?? name ?? id`，使用 `localeCompare(..., 'zh-CN')`；学号存在时优先学号，无学号学生按姓名排在有学号学生之后（避免无学号学生插乱学号序）。同键保持入参顺序（`Array.prototype.sort` 稳定）。

### D3：筛选 UI 复用页面既有控件风格

搜索输入与 select 沿用"课堂历史"区域既有样式（`Search` 图标输入框 + `btn-ghost-themed` select）。风险/趋势为单选下拉（含"全部"）；证据缺失与画像不可用为下拉三态（全部/仅缺失/仅不可用）以统一风格，不引入 checkbox 新样式。清除操作为一个 `type="button"` 按钮，仅在存在任一激活条件时启用。命中人数展示"命中 X / 共 Y 人"。

### D4：诊断报告入口用可选 prop 注入

`TeacherDiagnosisReportHistory` 新增可选 prop `currentStudentsEntry?: { href: string; label?: string }`，存在时在 header 操作区渲染 `Link`。页面传入 `{ href: '#students' }`。理由：组件保持自包含可复用（其他调用点如学生详情页不受影响），默认不渲染保证既有测试与交付面不变。锚点 `#students` 已存在。

### D5：口径标注为表头说明文案

学生表标题区加"数据口径：当前累计画像（非历史诊断报告快照）"说明行。"证据截至"列已存在，无需新增。

### D6：空状态区分两种情况

- 班级无学生：保留既有"暂无学生加入此班级"空状态。
- 有学生但无命中：新空状态"没有符合条件的学生"，附清除筛选按钮。两者文案与图标区分，避免误导。

## Risks / Trade-offs

- [大班级全量客户端过滤性能] → 班级规模为数十人量级，派生过滤为 O(n)，无需虚拟化；若未来规模显著增长再评估。
- [筛选状态与 insights 未加载竞态] → 过滤函数对 `insight` 缺失按"画像不可用"归类，insights 加载完成前后均稳定。
- [a11y 治理计数] → 新增控件全部带 `aria-label`/可见标签，新增按钮带 `type="button"`；治理测试读静态 artifact 快照，不重扫源码，计数不受影响。
- [入口泄漏到交付物] → 交付版/打印页/PDF 为独立页面与投影，本变更不触碰；prop 默认不渲染进一步隔离。

## Migration Plan

纯前端增量，无数据迁移。回滚 = 还原两个组件文件即可。

## Open Questions

无。

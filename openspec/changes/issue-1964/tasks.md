# 任务：增强班级学生学情检索并连接诊断报告入口

## 1. 纯函数模块

- [ ] 1.1 新增 `src/features/teacher/class-student-roster.ts`：筛选状态类型、稳定排序键（学号优先，缺失按姓名）、`filterClassStudents` 组合过滤（姓名/学号搜索、风险、趋势、证据缺失、画像不可用）、命中计数与"是否有激活条件"派生
- [ ] 1.2 单测 `src/features/teacher/__tests__/class-student-roster.test.ts`：搜索命中（姓名/学号/大小写）、组合筛选交集、稳定排序（学号优先与同键稳定）、无命中结果、insight 缺失按画像不可用归类

## 2. 学生表 UI

- [ ] 2.1 `page.tsx` 接入筛选状态与 `useMemo` 派生过滤排序；表头区加筛选行（搜索框、风险/趋势/证据缺失/画像不可用下拉、清除按钮）与"命中 X / 共 Y 人"计数
- [ ] 2.2 学生表标题区加"当前累计画像"口径标注；新增"无命中"空状态（区别于"班级暂无学生"），空状态含清除筛选操作
- [ ] 2.3 组件测试覆盖：默认渲染含筛选控件与口径标注、无命中空状态、清除筛选恢复全量、移动端卡片 `data-label` 保留、详情链接仍走 `buildTeacherStudentInsightsHref`

## 3. 诊断报告入口

- [ ] 3.1 `teacher-diagnosis-report-history.tsx` 新增可选 `currentStudentsEntry` prop，header 操作区渲染入口 Link（默认不渲染）
- [ ] 3.2 组件测试：传入入口时渲染"查看当前学生学情"并指向 `#students`；不传时不渲染；既有断言不回归

## 4. 验证

- [ ] 4.1 相关 Vitest 套件全过；`rtk npm run typecheck` 零错误；eslint 相关文件零新增告警
- [ ] 4.2 核验交付面隔离：教师交付版/打印页/学生安全版/PDF 无新入口与学生表筛选控件（静态检查引用面）

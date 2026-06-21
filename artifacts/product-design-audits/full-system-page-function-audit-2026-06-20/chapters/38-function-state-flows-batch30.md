# 功能状态流审计续篇（三十）

日期：2026-06-20
基线：`dev1` 已对齐 `origin/integration`，HEAD `89a826ee53`。
范围：教师课前包复核入口、班级分析来源页、直达页和移动端阻断状态。
截图目录：`screenshots/65-function-state-flows-batch30/`
Manifest：`screenshots/function-state-flows-batch30-manifest.json`
本批新增截图：6 张，全部带 DOM/a11y JSON 快照。
教师账号：`201300000012`。

## 1. 本批审计顺序

1. 打开教师工作台桌面态，检查课前包与报告槽位入口。
2. 打开真实班级 `2024自动化` 的班级分析页，检查是否能从诊断进入课前包复核。
3. 直接访问 `/teacher/prep-packs`。
4. 访问 `/teacher/prep-packs?cluster=cluster-1` 深链。
5. 打开教师工作台移动态，检查课前包入口可发现性。
6. 移动端直接访问 `/teacher/prep-packs`。

## 2. 教师工作台入口与报告槽位

证据：

- `01-teacher-dashboard-prep-pack-entry-desktop.png`
- `05-teacher-dashboard-prep-pack-entry-mobile.png`

API 证据：

- `/api/auth/session` 返回 200，当前会话为 `role=TEACHER`，教师名为张永韡。

观察：

- 教师工作台顶部主导航有“课前包”入口，href 为 `/teacher/prep-packs`。
- 桌面态“学习分析槽位”中有 `data-report-ledger-surface="teacher-prep-pack-review-slot"`，并标注“预览、复核、激活、归档、回滚、不修改基础 manifest”和“进入课前包复核”。
- 该报告槽位在桌面首屏偏下，在移动端位于很深的滚动位置；移动端 manifest 中 report ledger rect 为不可见。
- 工作台同时显示“分析能力未启用时仅展示状态与可执行入口，不生成占位指标”，但用户点击可执行入口会进入当前阻断页。
- 本批结构化快照未发现 live/status 区域，课前包入口、报告槽位和未开放状态缺少状态播报。

问题：

- P1：教师工作台给出课前包入口，但入口当前通向 500 页面。入口语义是可执行复核，实际结果是运行时错误。
- P1：移动端课前包报告槽位位置过深。教师在移动端第一屏能看到顶部“课前包”标签，但看不到“预览、复核、激活、归档、回滚”的报告槽位解释。
- P2：报告槽位缺少可达状态说明。页面提示 feature-flagged 和 deferred export，但没有解释为什么未启用、如何启用或何时能复核。

建议：

- 在 `/teacher/prep-packs` 未可用时，教师工作台入口应显示明确的不可用/需迁移/待初始化状态，而不是保持普通可执行链接。
- 移动端报告槽位需要上移或提供固定快捷入口，至少让教师能看到“课前包复核当前不可用/待初始化”。
- 对 feature-flagged、deferred export 和不可用报告槽位增加 `role=status` 或 `aria-live`，并展示恢复动作或管理员联系路径。

## 3. 班级分析来源页

证据：

- `02-teacher-class-analytics-prep-pack-source-desktop.png`

观察：

- `/teacher/classes/cmma7g0590004g9q2nl2jyzdf/analytics-v2` 返回 200，能展示 `2024自动化` 班级的能力维度、画像分布、能力矩阵和学生列表。
- 页面带 `data-report-ledger-surface="teacher-class-analytics-report"` 和 `data-report-ledger-export="restricted"`。
- 结构化控件里只稳定发现全局“课前包”入口；截图中的班级分析主体没有形成“从诊断簇生成/打开课前包”的近场动作。
- 该页面很长，教师需要先穿过能力矩阵和长学生表，才能继续寻找后续报告、补强或课前包动作。

问题：

- P1：班级诊断结果没有就地连接课前包复核。课前包应该从学生簇、短板或诊断来源发起，但当前证据只显示全局入口。
- P2：班级分析页仍是长报告阅读形态，后续动作不够靠近诊断结论。即使课前包入口恢复，教师也需要自己把短板、学生群体和复核页关联起来。

建议：

- 在能力维度、重点学生和补强建议旁增加“生成课前包/打开课前包复核”近场动作，并携带 classId、clusterId 和诊断依据。
- 班级分析页的报告 ledger 区域应明确“受限导出”和“可生成课前包”的关系，避免教师把它理解为只读统计页。

## 4. 课前包直达页阻断

证据：

- `03-teacher-prep-packs-direct-desktop.png`
- `04-teacher-prep-packs-cluster-deeplink-desktop.png`
- `06-teacher-prep-packs-direct-mobile.png`

路由证据：

- `/teacher/prep-packs` 桌面返回 500。
- `/teacher/prep-packs?cluster=cluster-1` 返回 500。
- `/teacher/prep-packs` 移动端返回 500。

运行时错误证据：

- manifest 的 ignoredErrors 记录 `prisma.courseEnhancementPack.findFirst()` 失败。
- 错误信息为 `The table public.CourseEnhancementPack does not exist in the current database.`
- `prisma/schema.prisma` 和迁移目录中存在 `CourseEnhancementPack` 模型与 `20260612131500_add_course_enhancement_packs` 迁移，说明当前本地数据库基线没有应用该迁移或迁移状态不一致。

观察：

- 直达页没有产品级错误态、空态或初始化说明，只显示 Next 开发错误层。
- 桌面和移动端错误页都没有返回教师工作台、查看班级分析、联系管理员或重试的产品动作。
- cluster 深链同样失败，说明从诊断簇进入课前包的预期路径也被数据库表缺失阻断。

问题：

- P0：教师课前包复核页被数据库表缺失阻断。该页面是 route inventory 中的教师端页面，当前无法审计实际复核体验。
  - 整改状态（2026-06-21，`audit-remediation-p0-stability`）：已修复。缺表、无候选包和 cluster/class 深链进入受控恢复/空态，不返回 500；证据见 `../remediation/audit-remediation-p0-stability/evidence.md`。
- P1：错误状态不面向教师。教师看到的是开发错误层，而不是“课前包功能未初始化/数据库迁移缺失/请联系管理员”的产品说明。
- P1：cluster 深链无法降级为安全空态。即使没有对应课前包，也应展示“当前诊断簇暂无课前包”或“先生成候选包”，而不是 500。

建议：

- 先修复本地/集成环境的 `CourseEnhancementPack` 迁移状态，再继续审计课前包复核、预览、激活、回滚、归档和影响证据动作。
- 在页面层增加 defensive empty/error state：表不存在、无候选包、无权限、cluster 不存在应分别给出可恢复路径。
- cluster 深链应在失败时保留 classId/clusterId 上下文，回到班级分析或生成候选包，而不是丢失任务。

## 5. 本批新增优先问题

132. P0：教师课前包复核页当前返回 500。
     `/teacher/prep-packs` 桌面和移动端均返回 500，页面只显示 Next 错误层。
     整改状态（2026-06-21，`audit-remediation-p0-stability`）：已修复入口 500 阻断，证据见 `../remediation/audit-remediation-p0-stability/evidence.md`。

133. P0：`CourseEnhancementPack` 表缺失阻断复核页。
     manifest 记录 `prisma.courseEnhancementPack.findFirst()` 失败，错误为 `The table public.CourseEnhancementPack does not exist in the current database.`
     整改状态（2026-06-21，`audit-remediation-p0-stability`）：已修复为受控恢复态，证据见 `../remediation/audit-remediation-p0-stability/evidence.md`。

134. P1：教师工作台课前包入口通向阻断页。
     桌面和移动端都有 `/teacher/prep-packs` 入口，但点击后无法进入复核体验。

135. P1：班级诊断结果没有就地连接课前包复核。
     班级分析页能展示大量能力和学生数据，但没有在短板或学生簇旁提供稳定可见的课前包复核动作。

136. P1：课前包错误状态没有产品级恢复动作。
     直达页、cluster 深链和移动端都没有返回教师工作台、回到班级分析、重试或联系管理员。

137. P2：移动端课前包报告槽位过深。
     教师工作台移动端顶部能看到“课前包”标签，但报告槽位的复核/激活/归档说明在长页深处，首屏不可见。

## 6. 本批脚本与统计备注

- 本批 manifest 为 6 张截图、6 条 DOM/a11y JSON、1 个 API 检查、0 条 errors、3 条 ignoredErrors。
- ignoredErrors 均为本批正在审计的已知课前包表缺失阻断。
- 本批没有提交表单、没有激活课前包、没有写入数据库。
- 本批重新统计整份审计真实 PNG 数量后，预期总数为 726。

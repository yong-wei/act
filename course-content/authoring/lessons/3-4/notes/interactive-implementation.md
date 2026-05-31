# 3-4 互动课程实现记录

更新时间：2026-04-19

## 本轮结论

- `3-4` 已从旧的 14 步实现整改为与作者态双轨真源一致的 17 步课堂主线。
- 页内显式 AI 助手已移除，统一改为隐藏式页面上下文，由全局课程 AI 接管。
- 教师控制已按作者态拆分为四类：释放互动、开放浏览、逐步显影、揭示参考答案。
- `UNIT_3_4_PAGE_CONTRACTS` 已补齐作者态要求的模板区域、互动类型、教师洞察、遥测字段、误区标签与演示页预览路径。

## 17 步对齐表

| step | 作者态页面语义 | 实现侧落点 | 本轮状态 |
|---|---|---|---|
| step-01 | 路径地图页 | `unit-3-4-course.ts` + `step-panels.tsx` | 已对齐 |
| step-02 | 目标链与三张记录表 | `unit-3-4-course.ts` + `step-panels.tsx` | 已对齐 |
| step-03 | 对象与 A/B/C 初判 | `unit-3-4-course.ts` + `workspace.ts` + `step-panels.tsx` | 已对齐 |
| step-04 | 固定读图顺序排序 | `unit-3-4-course.ts` + `workspace.ts` + `step-panels.tsx` | 已对齐 |
| step-05 | 关键节点证据板与热点定位 | `unit-3-4-course.ts` + `workspace.ts` + `step-panels.tsx` | 已对齐 |
| step-06 | 关键节点读图记录 | `unit-3-4-course.ts` + `workspace.ts` + `step-panels.tsx` | 已对齐 |
| step-07 | 稳定窗口与可接受窗口判断 | `unit-3-4-course.ts` + `workspace.ts` + `step-panels.tsx` | 已对齐 |
| step-08 | `k = 0.01715K` 换算显影例题 | `unit-3-4-course.ts` + `workspace.ts` + `step-panels.tsx` | 已对齐 |
| step-09 | 三域角色与总表配对 | `unit-3-4-course.ts` + `workspace.ts` + `step-panels.tsx` | 已对齐 |
| step-10 | 时域验证与主导极点近似边界 | `unit-3-4-course.ts` + `workspace.ts` + `step-panels.tsx` | 已对齐 |
| step-11 | 频域验证与高频差异 | `unit-3-4-course.ts` + `workspace.ts` + `step-panels.tsx` | 已对齐 |
| step-12 | 收益代价双证据对照 | `unit-3-4-course.ts` + `workspace.ts` + `step-panels.tsx` | 已对齐 |
| step-13 | 为什么不是“再调一次 K” | `unit-3-4-course.ts` + `workspace.ts` + `step-panels.tsx` | 已对齐 |
| step-14 | 广义根轨迹改写链显影 | `unit-3-4-course.ts` + `workspace.ts` + `step-panels.tsx` | 已对齐 |
| step-15 | 非增益参数窗口判断 | `unit-3-4-course.ts` + `workspace.ts` + `step-panels.tsx` | 已对齐 |
| step-16 | 后测 | `unit-3-4-course.ts` + `workspace.ts` + `step-panels.tsx` | 已对齐 |
| step-17 | 出口页与 3-5 去向 | `unit-3-4-course.ts` + `step-panels.tsx` | 已对齐 |

## 关键整改点

### 1. 课程定义与契约

- [src/lib/unit-3-4-course.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/lib/unit-3-4-course.ts) 现以 17 步定义课程主线，`step-17` 作为独立总结页。
- `UNIT_3_4_PAGE_CONTRACTS` 已逐步对齐作者态 `interactive-contract.yaml` 的 `layout / interactionKind / teacherInsightWidgets / telemetrySummaryFields / misconceptionTags / teacherControls / previewDemoPath`。
- `UNIT_3_4TeacherCourseSyncState` 与 `UNIT_3_4TeacherSyncInput` 已扩展 `browseEnabled`、`teacherRevealProgress`，用于显影页和教师浏览控制。

### 2. AI 策略

- [src/lib/unit-3-4-ai-contexts.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/lib/unit-3-4-ai-contexts.ts) 已重写为 17 步页面上下文。
- `isUNIT_3_4AiPageType()` 现不再暴露页内 AI 页面，而是全部走隐藏式页面上下文，避免再回到旧版页内助手实现。

### 3. 工作区与面板

- [src/features/interactive/unit-3-4-root-locus-reading-validation/workspace.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-3-4-root-locus-reading-validation/workspace.ts) 已切换到新版数据结构：`READING_SEQUENCE_OPTIONS`、`HOTSPOT_LABEL_FIELDS`、`ACTIVITY_CARD_FIELDS`、`TRIPLE_MATCH_FIELDS`、`WORKED_EXAMPLE_FIELDS`、`POST_QUIZ_QUESTIONS`。
- [src/features/interactive/unit-3-4-root-locus-reading-validation/step-panels.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-3-4-root-locus-reading-validation/step-panels.tsx) 已按 17 步重组静态蓝图、学生作答区与教师汇总区，并保留显影锚点：
  - `显示下一步`
  - `重置步骤`
  - `点击当前步骤可继续显影下一层`

### 4. 教师/学生双端同步

- [src/features/interactive/unit-3-4-root-locus-reading-validation/student-page.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-3-4-root-locus-reading-validation/student-page.tsx) 现按页面契约动态计算 `released / browseEnabled / answerVisible / revealProgress`。
- [src/features/interactive/unit-3-4-root-locus-reading-validation/teacher-page.tsx](/Users/YW/Documents/Site/act.just.edu.cn/src/features/interactive/unit-3-4-root-locus-reading-validation/teacher-page.tsx) 已新增本地草稿态与同步输入，覆盖浏览开关与逐步显影深度。

## 验证记录

已通过：

- `rtk npm run test:unit -- src/features/interactive/__tests__/unit-3-4-course.test.ts`
- `rtk npm run test:unit -- src/features/interactive/__tests__/module-3-4-formula-rendering.test.ts`
- `rtk python3 .agents/skills/interactive-lesson/scripts/check_contract_alignment.py --lesson 3-4`
- `rtk npm run lint`

待与仓库其余改动一并回归：

- `rtk npm run test`

# 单元 2-2 互动课程实现说明

## 目标与范围

本说明服务于 `authoring/lessons/2-2/design/2-2-interactive-page.md` 的前端实现准备，优先覆盖 P0 互动项：

- `ic-02` 一阶时间常数滑块联动
- `ic-03` 二阶响应家族切换器
- `ic-04` 动态指标叠加标注器
- `ic-06` AI 对照工作区
- `ic-07` 指标到极点联动面板

本课实现原则：

1. 讲义是唯一事实来源，互动只做预测、验证、迁移；
2. 教师端控制“何时揭示”，学生端负责“先判断再验证”；
3. AI 只能做逻辑核验和反思提示，不能直接跳过学生思考过程；
4. 所有互动都要能回退到静态图示，不把课堂成功建立在复杂交互是否可用上。

## 页面级共享状态

建议页面级状态拆为以下几类：

```ts
interface Lesson22InteractiveState {
  lessonId: '2-2';
  currentItemId: string;
  revealStageByStep: Record<string, number>;
  teacherLocks: Record<string, boolean>;
  mediaHighlightByStep: Record<string, string[]>;
  assessmentRelease: {
    pretestOpen: boolean;
    posttestOpen: boolean;
  };
  aiGateByStep: Record<string, { enabled: boolean; mode: 'hint' | 'check'; }>;
}
```

补充约束：

- `currentItemId` 是唯一主导航状态，驱动教师端与学生端同步跳步；
- `revealStageByStep` 用于公式分步揭示，不要把“显示/隐藏”散落在组件局部状态里；
- `teacherLocks` 解决课堂演示时的“学生先不要拖动/先不要看答案”；
- `mediaHighlightByStep` 负责让静态 SVG 与互动标注统一高亮语言；
- `aiGateByStep` 用于控制 AI 面板什么时候从只读切到可提问。

## 互动项实现细化

### ic-02 | 一阶时间常数滑块联动

**服务步骤**：`step-06`

**教学任务**：让学生观察 $T$ 增大时，响应如何整体“拉长”，并把这种变化与时间常数定义绑定。

**输入状态**：

- `timeConstant: number`，推荐范围 `0.2 ~ 5.0`
- `gain: number`，固定为 `1`
- `teacherPreset?: 0.5 | 1 | 2 | 4`

**派生状态**：

- 一阶响应曲线数据
- $t=T$ 的垂线位置
- $0.632K$ 水平线
- 快/中/慢语言标签

**教师端控制**：

- 一键切到 `T=0.5 / 1 / 2`
- 锁定滑块，仅保留观察模式
- 点亮“63.2%”标记

**学生端反馈**：

- 拖动滑块后实时更新曲线
- 文本提示同步刷新：`当前 T 较大，响应更慢`
- 留一个判断框：`若 T 翻倍，调节时间会如何变化？`

**埋点建议**：

- `lesson22_ic02_slider_changed`
- `lesson22_ic02_prediction_submitted`
- `lesson22_ic02_teacher_preset_applied`

### ic-03 | 二阶响应家族切换器

**服务步骤**：`step-08`

**教学任务**：把层0“看图认形态”升级成“看阻尼比认家族”。

**输入状态**：

- `familyMode: 'undamped' | 'underdamped' | 'critical' | 'overdamped'`
- `zetaPreset: 0 | 0.2 | 1.0 | 1.5`

**派生状态**：

- 当前曲线数据
- 当前阻尼区间标签
- 一句工程语言描述

**教师端控制**：

- 支持按顺序轮播四种家族
- 支持切换“单图模式 / 四图总览模式”

**学生端反馈**：

- 切换标签页时显示对应阻尼比区间
- 展示一句非公式化解释，例如“欠阻尼：会冲过头，但能收回来”

**埋点建议**：

- `lesson22_ic03_family_switched`
- `lesson22_ic03_compare_view_toggled`

### ic-04 | 动态指标叠加标注器

**服务步骤**：`step-12`

**教学任务**：在同一条欠阻尼曲线上分层显示 $t_r$、$t_p$、$M_p$、$t_s$，帮助学生建立“同图多指标”视角。

**输入状态**：

- `visibleMetrics: Array<'tr' | 'tp' | 'mp' | 'ts'>`
- `settleBand: 0.02 | 0.05`
- `teacherRevealStage: 0 | 1 | 2 | 3 | 4`

**派生状态**：

- 对应指标的标记点与箭头
- 误差带上下边界
- 指标摘要栏

**教师端控制**：

- 按顺序揭示四个指标
- 一键切换 `2% / 5%` 误差带
- 一键隐藏全部标记，只留裸曲线做提问

**学生端反馈**：

- 可手动重新打开某个指标重看
- 切换误差带后提示“调节时间定义会变化”

**埋点建议**：

- `lesson22_ic04_metric_toggled`
- `lesson22_ic04_band_changed`
- `lesson22_ic04_teacher_reveal_advanced`

### ic-06 | AI 对照工作区

**服务步骤**：`step-14`

**教学任务**：坚持“先做 -> 再问 AI -> 再反思”的流程，避免学生把 AI 当答案机。

**三区布局**：

1. 左栏：学生草稿区，只能先填写自己的不等式推导；
2. 中栏：AI 对照区，默认只读；
3. 右栏：极点区域图，显示约束几何结果。

**状态设计**：

```ts
interface AiCompareState {
  draftSubmitted: boolean;
  aiEnabled: boolean;
  aiMode: 'logic-check' | 'reflection';
  promptTemplateId: 'lesson22-reverse-spec-check';
}
```

**AI 提示词限制**：

- 第一轮只允许：指出哪一步逻辑不充分；
- 不允许：直接返回最终 `zeta` 和 `omega_n` 数值；
- 第二轮在学生点击“我已修改”后，才允许给更完整提示；
- 系统提示里要明确：`不要替学生完成最终求解，只指出推理缺口与下一步建议。`

**埋点建议**：

- `lesson22_ic06_draft_submitted`
- `lesson22_ic06_ai_opened`
- `lesson22_ic06_ai_round_completed`
- `lesson22_ic06_revision_confirmed`

### ic-07 | 指标到极点联动面板

**服务步骤**：`step-15`

**教学任务**：把 $M_p$、$t_s$ 的文字约束变成复平面中的阻尼射线与实部边界。

**输入状态**：

- `mpUpperBound: number`
- `tsUpperBound: number`
- `showRay: boolean`
- `showSigmaLine: boolean`
- `showFeasibleRegion: boolean`

**派生状态**：

- 阻尼比射线
- `Re(s) = -sigma0` 边界线
- 双约束阴影区域
- 参数到几何的映射说明

**教师端控制**：

- 先只开 `M_p -> zeta`
- 再开 `t_s -> sigma`
- 最后合成可行域

**学生端反馈**：

- 每次调节输入后，右侧文字同步解释“是哪个指标在收紧区域”
- 鼠标悬停可显示：该边界来自哪条公式

**埋点建议**：

- `lesson22_ic07_constraint_changed`
- `lesson22_ic07_layer_toggled`
- `lesson22_ic07_hover_formula`

## AI 面板统一约束

所有带 AI 的步骤统一遵循：

1. 学生端先提交自己的预测或推导；
2. 未提交前，AI 面板显示“请先完成你的判断”；
3. AI 返回内容优先级：逻辑漏洞 > 反思问题 > 可参考下一步；
4. 不直接给最终答案，不替代公式推导；
5. 教师端可强制关闭 AI，以回到纯讲授模式。

## 静态素材与互动联动

已落地静态素材优先服务以下步骤：

- `td-01` -> `step-05`
- `td-02` -> `step-06`
- `td-03` -> `step-08`
- `td-04` -> `step-12`

建议前端实现时不要重复绘制完全相同的静态图，而是：

- 展示 SVG 基底；
- 在其上叠加高亮层和可交互标记；
- 保持讲义图、教师页、学生页的视觉语言一致。

## 验收口径

达到“可实现”状态的最低标准：

1. 每个 P0 互动项都有明确输入、派生状态与教师控制；
2. AI 使用边界明确，能防止直接泄题；
3. 能与 `currentItemId` 和揭示状态联动；
4. 静态素材命名与交互引用完全对齐；
5. 就算互动失效，教师仍能退回静态图 + 口头推进课堂。

## 2026-04-05 契约对齐与入口复核

- 已补齐 `src/lib/unit-2-2-course.ts` 的实现侧平行契约：`UNIT_2_2_PAGE_CONTRACTS` 现与作者态 `interactive-contract.yaml` 对齐，覆盖模板、区域、互动类型、教师洞察、telemetry 与学生演示页预览路径。
- `UNIT_2_2_LESSON_STEPS` 的 `pageType` 已从旧的 `display/quiz/form/ai/summary` 粗粒度值升级为契约粒度值，便于严格实现校验。
- `.codex/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py` 已新增 `2-2` 预设，可直接运行：

```bash
python3 .codex/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py --lesson 2-2
```

- `course-content/scripts/review_lesson_content.py --lesson 2-2 --strict-implementation-contract` 已纳入 `2-2` 的实现契约注册表，可作为正式回归命令。
- 互动课程入口复核结果：`2-2` 与 `2-1` 一样，已存在于 `src/features/interactive/learning-catalog.ts` 的 `PREMIUM_LESSONS` 与 `INTERACTIVE_COURSE_MODULES` 中，并继续通过 `/interactive-learning/courses` 页面暴露入口。

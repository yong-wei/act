# 互动课程模块化现状与重构计划

状态日期：2026-04-26

进展补记：`4-6` 静态内容模块已经改为通过 manifest module `payload` 驱动公式、摘要、表格、图片与显影内容；共享 `content-renderers.tsx` 不再识别 `4-6` 专用 module id。

## 现状盘点

当前互动课程运行时已经出现两条形态。第一条是传统课程本地实现：课程目录下维护大体量 `step-panels.tsx`，页面内容、作答区、教师汇总、显影逻辑和少量课程专用工作区混在同一文件中。第二条是 manifest-first 薄适配形态：运行时先加载 `course-content/runtime/lessons/<lesson>/interactive-manifest.json`，课程代码只负责接入共享 renderer、会话状态和课程路由。

按当前代码体量和迁移程度，可分为四类：

1. 已基本薄适配：`4-6`。其 `step-panels.tsx` 只负责读取 manifest step、创建内容 registry 与活动 registry，并把学生端、教师端状态传入共享渲染层。它是后续迁移的基线，但不应被逐课复制成新的课程私有模板。
2. 半模块化：`4-3`。它已经加载 `interactive-manifest.json`，并在部分页面使用 `renderInteractiveManifestStep`，但仍保留大量课程私有图表、作答、工作区和 summary renderer，属于优先收口对象。
3. 未模块化高体量：`2-1`、`2-2`、`4-1`、`3-7`、`3-4`、`3-1`、`3-2`、`4-4`、`3-6`、`3-5`、`3-3`、`2-4`、`4-2`、`2-3`、`3-8`。这些课程的 `step-panels.tsx` 通常超过 1200 行，迁移时不能先复制 4-6，而应先补共享模块。
4. 未模块化中等体量：`4-5`、`3-9`。这两门课体量较小，结构相对清楚，适合在 `4-3` 之后作为第二批迁移对象，用来验证共享层是否能覆盖参数优化、跨域映射和后测题组。

结论：后续改造的主线不是“逐课把 4-6 写法复制一遍”，而是先通用化 manifest runtime，再把课程私有 `step-panels.tsx` 逐步减成薄适配器。

## 组件覆盖分析

现有共享层已经覆盖以下模块：

- 版面编排：`layout-renderer.tsx` 负责读取 step layout、region order 和 module registry，并按 region 顺序输出页面。
- 静态内容：`content-renderers.tsx` 已覆盖公式卡、摘要卡、原生表格、图片面板和逐步显影。
- 活动行为：`activity-renderers.tsx` 已覆盖 `activity_card_set`、`quiz_group`、`teacher_reveal_only` 的学生作答卡、教师控制、提交汇总和参考答案揭示。
- 运行时契约：`src/lib/interactive-lesson-manifest.ts` 负责把 JSON 中的下划线字段规范化为前端类型，并保留 step、module、activity card 的必要字段。

现有覆盖足以支撑 4-6 的课程主线，也能承接 4-3 中一部分静态页面和作答卡。但内容 renderer 仍有明显 4-6 遗留：公式、表格、图片和显影项目仍部分依赖 module id 与 content block 的映射。下一阶段应把这些映射迁入 manifest payload，renderer 只消费 `module.payload` 指定的字段。

## 组件库缺口

当前共享层还不能直接覆盖以下常见互动形态：

- 选择题：单选、多选、即时判断、题组批量提交。
- 排序与匹配：结构步骤排序、概念到公式匹配、时域/频域证据配对。
- 热点标注：在结构图、根轨迹、Bode 图或工程曲线上标出指定区域。
- 路径高亮：结构图信号路径、闭环通道、误差通道和扰动通道的逐步高亮。
- 参数联动：滑块或输入参数改变后，曲线、公式、评价指标同步更新。
- 控制曲线工作区：时域、频域、根轨迹、控制量曲线的多图联动读图。
- 结构化工作区：对象分析卡、方案卡、目标函数卡、约束翻译卡和综合判断卡。

这些缺口决定迁移顺序。若共享层缺少对应组件，就不应在课程本地重新手写一套同类逻辑；应先把组件抽成 manifest module，再迁移具体课程。

## 迁移计划

第一阶段：通用化共享 manifest runtime。

- 将共享层统一放入 `src/features/interactive/shared/manifest-runtime/`。
- 保留 `layout-renderer.tsx`、`content-renderers.tsx`、`activity-renderers.tsx` 三层边界。
- 旧路径只做兼容转发，避免影响已有课程。
- 活动卡标题、参考答案和模块标题优先来自 manifest payload；缺字段时显示诊断信息，不再写课程 id 映射。
- 增加共享 renderer 测试，覆盖 region 顺序、同 region 多模块顺序、`must_be_visible` 缺 renderer 报错，以及三类活动 registry 的学生端与教师端行为。

第二阶段：迁移 `4-3`。

- 保留课程专用控制曲线工作区，但把普通公式、表格、摘要、题组和作答卡迁到共享 registry。
- 清理 `4-3` 中已经能由 manifest 表达的课程本地 switch。
- 迁移后运行 `unit-4-3-course.test.ts`、`interactive-manifest-runtime.test.tsx` 和严格实现契约审查。

第三阶段：处理 `4-5` 与 `3-9`。

- 用中等体量课程验证选择题、比较矩阵、后测题组和跨域映射模块。
- 若出现通用组件缺口，先补共享层，再迁移课程。

第四阶段：进入大文件课程。

- 按 `2-1 / 2-2 / 3-7 / 4-1` 优先顺序拆除大 `step-panels.tsx`。
- 每门课先核对 authoring 双轨真源与 runtime manifest，再迁移。
- 每迁移一门课，运行对应 `unit-*-course.test.ts`、共享 manifest runtime 测试，以及 `review_lesson_content.py --lesson <id> --strict-implementation-contract`。

## 架构边界

`layout-renderer.tsx` 是运行时编排层。它只接收 manifest step、layout region 和 module registry，并决定模块在页面中的顺序与区域位置。

`content-renderers.tsx` 是静态内容 registry。它负责公式、表格、图片、摘要、显影和总结等展示模块，这类模块通常不需要提交状态，也不直接读教师控制状态。

`activity-renderers.tsx` 是活动 registry。它负责学生提交、教师控制、答案揭示和提交汇总。它需要处理 per-card response、发放状态、浏览状态、参考答案显隐和教师端聚合，因此生命周期不同于静态内容。

内容 registry 与活动 registry 不应合并成一个大文件。二者可以共享 manifest 类型，但不共享状态职责。强行合并会把纯展示模块和课堂同步模块耦合在一起，后续迁移大课程时会重新形成新的大文件。

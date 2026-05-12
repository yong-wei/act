# Resource Library Fusion Execution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在既有 5 模块课程框架不被 legacy 资源反向推翻的前提下，建立“旧资源 -> 新单元”的正式映射层，并把模块级资源融合规则写回大纲与资源索引。

**Architecture:** 先补资源库统一映射表作为转译层，再更新思政与船舶索引，使其能按新单元调用；随后为缺失资源融合层的模块文稿补齐资源锚点，重点修复模块4中“legacy 频域校正资源如何服务新设计链”的悬空问题；最后把这次融合决策回写到课程摘要与决策日志，确保后续课程制作直接以新映射层为准。

**Tech Stack:** Markdown、课程大纲文稿、资源索引文档、`apply_patch`、`rg`

---

### Task 1: 写入执行计划并固定修改边界

**Files:**
- Create: `docs/plans/2026-03-28-resource-library-fusion-execution.md`

**Step 1: 记录本轮目标文件**

涉及：
- `course-content/resource-library/integration-framework.md`
- `course-content/resource-library/indexes/`
- `course-content/resource-library/civics-cases/indexes/unit-mapping.md`
- `course-content/resource-library/ship-control-cases/indexes/section-map.md`
- `course-content/syllabus-refactor/unit-design-details/module1.md`
- `course-content/syllabus-refactor/unit-design-details/module4.md`
- `course-content/syllabus-refactor/unit-design-details/module5.md`
- `course-content/syllabus-refactor/decisions.md`
- `course-content/syllabus-refactor/main.md`

**Step 2: 固定本轮不做的事**

不改：
- `blueprint.md` 的总模块骨架
- 模块2/3的主线结构
- 单课讲义/教案/互动页成稿

### Task 2: 建立统一映射层

**Files:**
- Create: `course-content/resource-library/indexes/syllabus-fusion-map.md`
- Modify: `course-content/resource-library/integration-framework.md`

**Step 1: 写一张总映射表**

内容至少覆盖：
- legacy `pptx` 主题 -> 新模块/单元
- 船舶案例章节簇 -> 新模块/单元
- 思政主题 -> 新模块/单元
- 建议落点（导入 / 正文 / 例题 / 互动 / 总结 / 练习）
- 采用方式（改写吸收 / 直接复用图片 / 仅作灵感）

**Step 2: 在 integration-framework 中补入口**

将 `syllabus-fusion-map.md` 升级为正式读取入口，避免后续仍只靠人工查三份索引。

### Task 3: 更新资源索引到新单元语境

**Files:**
- Modify: `course-content/resource-library/civics-cases/indexes/unit-mapping.md`
- Modify: `course-content/resource-library/ship-control-cases/indexes/section-map.md`

**Step 1: 思政映射从“待对接”改为可执行映射**

把当前课程主题映射到新单元编号或模块段落，不追求每一项都绑定，但要明确：
- 优先接入单元
- 建议使用时机
- 需要避免的错误用法

**Step 2: 船舶案例从旧章节目录改成可供新框架调用**

为 `section-map.md` 增加：
- 推荐模块/单元
- 建议用途
- 采用边界

### Task 4: 补齐模块资源融合层

**Files:**
- Modify: `course-content/syllabus-refactor/unit-design-details/module1.md`
- Modify: `course-content/syllabus-refactor/unit-design-details/module4.md`
- Modify: `course-content/syllabus-refactor/unit-design-details/module5.md`

**Step 1: 给 module1 补资源融合清单**

重点：
- `1反馈_控制原理的核心思想`
- 轻量思政导入
- 资源只服务总图建立与课程气质，不提前深讲后续方法

**Step 2: 给 module4 补资源融合清单与 legacy 频域校正转译线**

重点：
- `20宽备窄用_稳定裕度`
- `21三频段_各司其职`
- `22串联校正`
- `23滞后超前`
- 船舶 `6.1-6.3`

要求明确每类资源如何分别服务：
- `4-2` 选型解释
- `4-3` 初始方案形成
- `4-5/4-6` 优化与修正
- 不允许模块4退化回旧“频域校正章”

**Step 3: 给 module5 补资源融合清单**

重点：
- 船舶非线性与离散案例只服务边界意识
- 不因资源现状削弱 `MASS / 数据驱动 / 策略学习` 的课程位阶

### Task 5: 回写课程级决策与摘要

**Files:**
- Modify: `course-content/syllabus-refactor/decisions.md`
- Modify: `course-content/syllabus-refactor/main.md`

**Step 1: 在 decisions 中新增一条融合决策**

固定结论：
- 总框架不改
- 模块1-3补资源锚点
- 模块4做资源转译修订
- 模块5保持主线，资源只作边界案例

**Step 2: 在 main 中补“最近确认原则”**

让后续会话初始化时直接知道：
- 资源库不再是松散附件
- 正式调用顺序是什么
- 模块4的 legacy 资源转译线已经成立

### Task 6: 最小验证

**Files:**
- Verify: `course-content/resource-library/indexes/syllabus-fusion-map.md`
- Verify: `course-content/resource-library/integration-framework.md`
- Verify: `course-content/resource-library/civics-cases/indexes/unit-mapping.md`
- Verify: `course-content/resource-library/ship-control-cases/indexes/section-map.md`
- Verify: `course-content/syllabus-refactor/unit-design-details/module1.md`
- Verify: `course-content/syllabus-refactor/unit-design-details/module4.md`
- Verify: `course-content/syllabus-refactor/unit-design-details/module5.md`
- Verify: `course-content/syllabus-refactor/decisions.md`
- Verify: `course-content/syllabus-refactor/main.md`

**Step 1: 路径与关键字校验**

用 `rg` 检查：
- `syllabus-fusion-map`
- `资源融合清单`
- `legacy 频域校正`
- `推荐模块/单元`

**Step 2: 逻辑一致性校验**

确认：
- 模块4不再悬空
- 模块5没有被旧资源反向压回传统章节
- 资源索引与模块文稿使用同一批新单元编号

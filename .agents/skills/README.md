# 项目技能索引

技能位于 `.agents/skills/`；按任务选择技能，再只读取对应工作流。`manifest.json` 是机器索引，`upstream-lock.json` 记录本次上游基线与本地适配摘要。

外部来源更新先在临时目录获取与比较，保留本地适配；不要运行会覆盖其他项目、hooks 或生产状态的全局更新。`skills-lock.json` 保留原安装器来源记录，不能作为适配后文件的内容校验。

`openspec-buddy` 与 `openspec-buddy-auto` 是指向 OpenSpec-buddy 仓库的符号链接；本轮只提 Issue，不改链接目标。OpenSpec 六个工作流使用缓存中的固定 CLI 1.13.0，不改全局 CLI。

上游刷新与 Astra 适配详情见 [审查记录](../../docs/maintenance/astra-skills-2026-09-15.md)。

## agents

| 技能 | 用途 |
| --- | --- |
| [agent-evolver](agent-evolver/SKILL.md) | 审查或维护项目命名代理的职责、模型配置及验证记录。 |
| [cursor-subagent-routing](cursor-subagent-routing/SKILL.md) | 在 Cursor 中选择已授权子代理的模型与任务角色。 |
| [skillopt-sleep](skillopt-sleep/SKILL.md) | 按用户要求从会话提取 Buddy 技能改进候选并验证，不自动采用。 |

## visual-design

| 技能 | 用途 |
| --- | --- |
| [brandkit](brandkit/SKILL.md) | 生成品牌识别方案、品牌指南图或品牌应用参考。 |

## code

| 技能 | 用途 |
| --- | --- |
| [debug-issue](debug-issue/SKILL.md) | 诊断本项目的错误、回归、运行异常或失败测试。 |
| [explore-codebase](explore-codebase/SKILL.md) | 在陌生模块中定位入口、模块边界或调用关系时使用图谱辅助探索。 |
| [refactor-safely](refactor-safely/SKILL.md) | 进行已授权的重命名、移动或职责调整，并核验受影响行为。 |

## frontend-design

| 技能 | 用途 |
| --- | --- |
| [design-taste-frontend](design-taste-frontend/SKILL.md) | 设计新网页或整体改版，建立符合品牌与内容的视觉方向。 |
| [gpt-taste](gpt-taste/SKILL.md) | 为需要叙事动效的网页设计布局与交互；适用于用户选择该视觉方向时。 |
| [high-end-visual-design](high-end-visual-design/SKILL.md) | 为网页或产品界面建立精细的字体、留白、色彩与组件视觉关系。 |
| [image-to-code](image-to-code/SKILL.md) | 将用户选定的图像、截图或设计参考实现为响应式网页。 |
| [industrial-brutalist-ui](industrial-brutalist-ui/SKILL.md) | 为用户选择的工业、蓝图或终端式界面设计视觉系统。 |
| [minimalist-ui](minimalist-ui/SKILL.md) | 为明确采用极简编辑式风格的界面设计视觉层次。 |
| [redesign-existing-projects](redesign-existing-projects/SKILL.md) | 审查并改进现有界面的视觉与可用性，保持已授权范围内的功能。 |
| [stitch-design-taste](stitch-design-taste/SKILL.md) | 为 Google Stitch 设计任务编写或更新可实施的 DESIGN.md。 |

## output-control

| 技能 | 用途 |
| --- | --- |
| [full-output-enforcement](full-output-enforcement/SKILL.md) | 用户明确要求完整文件、完整实现或不省略的交付时检查完整性。 |

## course-content

| 技能 | 用途 |
| --- | --- |
| [homework](homework/SKILL.md) | 生成、检查、修订或汇编指定题号的课程作业与考试题。 |
| [infograph](infograph/SKILL.md) | 生成、审核、注册或导出本项目知识节点的信息图。 |
| [interactive-design](interactive-design/SKILL.md) | 设计或修订课程互动页面蓝图及其机读契约。 |
| [lesson](lesson/SKILL.md) | 创作或修订自动控制原理讲义、教案、知识节点及课程媒体。 |
| [lesson-content-review](lesson-content-review/SKILL.md) | 审查指定课次或指定内容的教学、科学与作者态/runtime 一致性。 |
| [refine](refine/SKILL.md) | 润色学生讲义的中文表达，保留事实、公式和教学结构。 |

## image-generation

| 技能 | 用途 |
| --- | --- |
| [imagegen-frontend-mobile](imagegen-frontend-mobile/SKILL.md) | 生成移动应用屏幕概念图或指定流程的视觉参考，不编写应用代码。 |
| [imagegen-frontend-web](imagegen-frontend-web/SKILL.md) | 生成网页视觉概念或分区参考图，不承担网页代码实现。 |
| [imagen](imagen/SKILL.md) | 按指定用途生成或编辑图像，并保存图片与提示词。 |

## course-implementation

| 技能 | 用途 |
| --- | --- |
| [interactive-lesson](interactive-lesson/SKILL.md) | 依据已批准的课程设计实现互动页面或修复指定课次。 |

## openspec

| 技能 | 用途 |
| --- | --- |
| [openspec-apply-change](openspec-apply-change/SKILL.md) | 根据已有 OpenSpec 变更实施任务并完成相关验证。 |
| [openspec-archive-change](openspec-archive-change/SKILL.md) | 在归档已获授权且实现完成时归档指定 OpenSpec 变更。 |
| [openspec-buddy](openspec-buddy/SKILL.md) | Run explicitly invoked OpenSpec buddy claim, propose, apply, or achieve workflows coordinated through GitHub Issues. |
| [openspec-buddy-auto](openspec-buddy-auto/SKILL.md) | Automatically process GitHub Issue-backed or local-only OpenSpec changes end to end. |
| [openspec-explore](openspec-explore/SKILL.md) | 在实现前澄清想法、问题和需求；不自动修改产品代码。 |
| [openspec-propose](openspec-propose/SKILL.md) | 为明确的新变更生成 proposal、design、spec delta 和 tasks。 |
| [openspec-sync-specs](openspec-sync-specs/SKILL.md) | 将指定变更的 delta 合并到主规范，保持其他需求和场景。 |
| [openspec-update-change](openspec-update-change/SKILL.md) | 修订已有 OpenSpec 规划工件，使本次决策在相关工件中一致。 |

## context

| 技能 | 用途 |
| --- | --- |
| [openwolf](openwolf/SKILL.md) | 恢复任务上下文、查询项目历史或维护 OpenWolf 交接记录时使用。 |

## code-review

| 技能 | 用途 |
| --- | --- |
| [review-changes](review-changes/SKILL.md) | 按指定 diff 或 PR 增量审查当前变更引入的实际缺陷。 |

## operations

| 技能 | 用途 |
| --- | --- |
| [server-ops](server-ops/SKILL.md) | 部署本项目，或执行必须访问远端服务器的诊断与运维。 |

## course-design

| 技能 | 用途 |
| --- | --- |
| [syllabus-refactor](syllabus-refactor/SKILL.md) | 调整课程、模块、课次或作业架构，并维护已接受的课程蓝图。 |

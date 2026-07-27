# Project-local skills index

状态: active
最后更新: 2026-06-23
用途: 为 ChatGPT、Codex、devspace 和其他本地代理提供 `.agents/skills/` 的人工可读索引，弥补项目内技能不会被所有工具自动完整暴露的问题。

## 使用规则

- 本目录是项目专属技能目录；每个技能以 `<skill-name>/SKILL.md` 为入口。
- 任务明显匹配某个技能时，先读取对应 `SKILL.md`，再执行任务。
- `manifest.json` 是机器可读索引；本文件是人工可读索引。
- 新增、删除或重命名技能时，同步更新本文件与 `manifest.json`。
- 不要只依赖 `devspace.open_workspace` 返回的全局 `skills` 列表；该列表未必包含项目内技能。

## 快速路由

### OpenSpec 工作流

| 技能 | 入口 | 适用场景 |
| --- | --- | --- |
| `openspec-explore` | `openspec-explore/SKILL.md` | 进入 explore mode，澄清想法、问题和需求。 |
| `openspec-propose` | `openspec-propose/SKILL.md` | 一次性生成 OpenSpec change 的 proposal、design、spec delta 和 tasks。 |
| `openspec-apply-change` | `openspec-apply-change/SKILL.md` | 根据已有 OpenSpec change 执行实现任务。 |
| `openspec-archive-change` | `openspec-archive-change/SKILL.md` | 实现完成后归档 change。 |
| `openspec-buddy` | `openspec-buddy/SKILL.md` | 显式调用 GitHub Issue 协调的 claim/propose/apply/achieve 流程。 |
| `openspec-buddy-auto` | `openspec-buddy-auto/SKILL.md` | 自动处理 GitHub Issue-backed 或 local-only OpenSpec changes。 |
| `use-grill-me` | `use-grill-me/SKILL.md` | 在实施前通过隔离任务目录完成 Grill-with-Docs 决策记录与交付清单。 |

### 代码理解、调试、重构与审查

| 技能 | 入口 | 适用场景 |
| --- | --- | --- |
| `explore-codebase` | `explore-codebase/SKILL.md` | 使用 code-review-graph 进行仓库导览、热点定位、架构发现。 |
| `debug-issue` | `debug-issue/SKILL.md` | 诊断 bug、回归、失败测试、启动失败、运行时异常。 |
| `refactor-safely` | `refactor-safely/SKILL.md` | 图谱辅助的安全重构、影响面评估与验证。 |
| `review-changes` | `review-changes/SKILL.md` | 基于实际 diff 的风险优先代码审查。 |
| `agent-evolver` | `agent-evolver/SKILL.md` | 审计、调整、扩展 `.codex/agents/*.toml` 项目子代理。 |

### 课程、互动课、作业与内容生产

| 技能 | 入口 | 适用场景 |
| --- | --- | --- |
| `lesson` | `lesson/SKILL.md` | 自动控制原理讲义、知识图谱节点、BOPPPS 课案、多模态资源。 |
| `interactive-design` | `interactive-design/SKILL.md` | 编写或修订 `interactive-page.md` 与 `interactive-contract.yaml`。 |
| `interactive-lesson` | `interactive-lesson/SKILL.md` | 根据作者态设计实现或优化互动课页面。 |
| `lesson-content-review` | `lesson-content-review/SKILL.md` | 审查 handout、BOPPPS、互动契约、知识卡片、公式和媒体。 |
| `refine` | `refine/SKILL.md` | 对课程讲义进行学生视角的中文专业表达润色。 |
| `homework` | `homework/SKILL.md` | 按 T 系列题号生成、检查、更新或汇编作业题/考试题。 |
| `syllabus-refactor` | `syllabus-refactor/SKILL.md` | 课程整体重构、单元设计、作业架构和评价边界设计。 |
| `infograph` | `infograph/SKILL.md` | 为知识节点生成、审查、注册信息图。 |

### 视觉设计、前端审美与图像生成

| 技能 | 入口 | 适用场景 |
| --- | --- | --- |
| `imagen` | `imagen/SKILL.md` | 生成高质量图片、图形、插画、海报、图示和视觉资产。 |
| `imagegen-frontend-web` | `imagegen-frontend-web/SKILL.md` | 为网页每个 section 生成独立高质量设计参考图。 |
| `imagegen-frontend-mobile` | `imagegen-frontend-mobile/SKILL.md` | 生成移动 App 屏幕概念图和流程图。 |
| `image-to-code` | `image-to-code/SKILL.md` | 先生成设计图，再实现尽量贴近设计图的网页。 |
| `design-taste-frontend` | `design-taste-frontend/SKILL.md` | 反模板化的 landing page、portfolio 和 redesign 前端设计。 |
| `redesign-existing-projects` | `redesign-existing-projects/SKILL.md` | 升级现有网站或应用的视觉品质，同时保持功能。 |
| `high-end-visual-design` | `high-end-visual-design/SKILL.md` | 高端机构级网页视觉标准、字体、间距、阴影、动效。 |
| `gpt-taste` | `gpt-taste/SKILL.md` | 高阶 UX/UI 与 GSAP 动效页面。 |
| `brandkit` | `brandkit/SKILL.md` | 品牌指南、logo 系统、identity deck 和视觉世界板。 |
| `stitch-design-taste` | `stitch-design-taste/SKILL.md` | 为 Google Stitch 生成高标准 DESIGN.md。 |
| `minimalist-ui` | `minimalist-ui/SKILL.md` | 干净、编辑式、低饱和的极简 UI。 |
| `industrial-brutalist-ui` | `industrial-brutalist-ui/SKILL.md` | 机械、军用终端、蓝图式、数据密集 UI。 |

### 输出控制与运维

| 技能 | 入口 | 适用场景 |
| --- | --- | --- |
| `full-output-enforcement` | `full-output-enforcement/SKILL.md` | 要求完整、无省略、无占位符的大段输出。 |
| `server-ops` | `server-ops/SKILL.md` | 服务器运维、在线故障调查、远端部署、数据库同步。 |

### 代理技能优化

| 技能 | 入口 | 适用场景 |
| --- | --- | --- |
| `skillopt-sleep` | `skillopt-sleep/SKILL.md` | 从 Codex 历史会话中提取 Buddy Auto 任务，生成验证门控的技能优化候选。 |

## 当前技能清单

- `agent-evolver`
- `brandkit`
- `debug-issue`
- `design-taste-frontend`
- `explore-codebase`
- `full-output-enforcement`
- `gpt-taste`
- `high-end-visual-design`
- `homework`
- `image-to-code`
- `imagegen-frontend-mobile`
- `imagegen-frontend-web`
- `imagen`
- `industrial-brutalist-ui`
- `infograph`
- `interactive-design`
- `interactive-lesson`
- `lesson`
- `lesson-content-review`
- `minimalist-ui`
- `openspec-apply-change`
- `openspec-archive-change`
- `openspec-buddy`
- `openspec-buddy-auto`
- `openspec-explore`
- `openspec-propose`
- `redesign-existing-projects`
- `refactor-safely`
- `refine`
- `review-changes`
- `server-ops`
- `skillopt-sleep`
- `stitch-design-taste`
- `syllabus-refactor`
- `use-grill-me`

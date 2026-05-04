---
name: lesson-content-review
description: Use when reviewing a lesson under `course-content/authoring/lessons/`, especially when handout correctness, `boppps.md` and `interactive-page.md` coverage, `interactive-contract.yaml` 与本地互动实现契约一致性、知识卡片、事实性结论、科学推理、公式、示例或代码直出媒体需要被审查、回修并导出到 runtime 审查目录。
---

# Lesson Content Review

## Overview

先审正确性，再做课程制作。这个技能面向 `course-content/authoring/lessons/<lesson>/` 的课程初稿，负责检查产物正确性、事实正确性、科学合理性与确定性结论，补齐知识卡片与代码直出媒体，并把已审查产物导出到 runtime。若互动课程设计已完成，还要检查互动步骤、知识卡片顺序与 `sequence.json` 是否一致。

核心原则：
- 先修 `authoring` 源文件，再导出 runtime；不要只在 runtime 打补丁。
- 以**正确性**为第一优先级：先查错，再谈完整性与可制作性；不主动润色文风。
- 所有课型都必须审 `design/{unit}-interactive-page.md` 与 `design/{unit}-interactive-contract.yaml`（若已建立）；互动页不是可有可无的附属稿，而是课堂 PPT 的互动延伸板。
- 互动设计默认采用双轨真源：人读 `interactive-page.md`，机读 `interactive-contract.yaml`；审查时不得只看其中一份。
- 若课次已经落地本地互动实现，还必须把 `interactive-page.md`、`interactive-contract.yaml` 与本地实现契约一起做三层审查；只审作者态而不审实现，视为审查未完成。
- 互动页覆盖审查必须确认：讲义核心概念、公式、图表、例题、结论已经落到页面；静态页合法且必要；关键知识不能只藏在互动组件里。
- 审查还必须确认：人读稿的页面蓝图、机读稿的结构化契约与本地实现契约逐步骤对齐，且默认预览口径固定为学生演示页。
- 互动页面实现审核必须做到元件级：页面模板、区域布局、主阅读顺序、模块清单、互动原型、教师控件、埋点摘要、教师聚合、隐藏式 AI 上下文、预览路径、曲线图镜像布局与控件位置都要逐项核对。
- 对 manifest-first 课程，审查必须做到模块消费级：每个模块都应能被脚本判断 `renderer_owner`、`resolved_content_source`、`resolved_content_type`、`is_empty` 与诊断信息；只看页面截图或只确认路由 200 不足以放行。
- `activity-card`、`activity-card-set`、`single-choice-card`、`quiz-card`、`quiz-group` 等活动模块不得进入正文 content renderer；若页面正文额外出现“本页作答”题面列表，或 `activity_cards[].prompt` 出现多次，应判定为 manifest runtime 分层失败。
- 审查结论分层输出，且每层都要给出 `通过 / 需修订 / 阻塞` 状态：**结构正确性**、**互动页覆盖**、**事实正确性**、**科学合理性**、**确定性结论验证**。
- 代码直出媒体必须先落 `media/processed/` 审核，再进入 runtime。
- `course-content/runtime/knowledge/cards/nodes/` 继续作为全局知识卡片运行时来源；lesson runtime 只保存审查索引与报告。
- 对涉及任务、事迹、新闻、机构、标准、时间敏感数字等外部事实，必须联网核验。
- 对涉及控制计算、响应曲线、频域/根轨迹、性能指标等确定性内容，默认必须使用 `Octave` 中的原生函数与 `control` 包内置函数验证；不要为阶跃响应、频率响应、性能指标等基础能力自造底层计算函数。
- 审查不负责代替生成阶段重写 prose，但必须识别**污染信号**：若正文主干被流程腔、防御腔、管理腔或课程编排说明占据，应明确要求回到生成阶段重写。

## Inputs

始终先读取：
- `course-content/authoring/lessons/<lesson>/manifest.json`
- `design/{unit}-handout.md`
- `design/{unit}-handout.pdf`（若已生成）
- `course-content/authoring/lessons/<lesson>/design/<lesson>-boppps.md`
- `course-content/authoring/lessons/<lesson>/design/<lesson>-interactive-page.md`
- `course-content/authoring/lessons/<lesson>/design/<lesson>-interactive-contract.yaml`（若存在）
- `course-content/authoring/lessons/<lesson>/design/<lesson>-interactive-design-acceptance.json`
- `course-content/authoring/lessons/<lesson>/design/<lesson>-multimedia.md`（如果存在）
- `course-content/authoring/knowledge/cards/lessons/<lesson>/sequence.json`（若已存在；互动设计前可缺失或为草案）
- `course-content/authoring/knowledge/cards/nodes/*.md` 中与本课相关的卡片

若该课已经存在互动课程本地实现，还必须额外读取：
- `course-content/scripts/review_lesson_content.py` 中 `IMPLEMENTATION_CONTRACT_REGISTRY` 对应到的本地实现源码
- 本地实现导出的步骤定义常量与页面契约常量（由审查脚本自动解析）
- 与该课关联的学生页预览路径、教师聚合配置与课程级 AI 页面上下文接入点
- `course-content/authoring/lessons/<lesson>/notes/interactive-implementation-acceptance.json`

若是 legacy 实践课且仍未迁移到讲义主线，可额外读取：
- `design/{unit}-practice-guide.md`
- `design/{unit}-assessment-spec.md`

如正文、卡片、教案、媒体说明中出现以下类型事实，还必须额外准备核验证据：
- 任务、工程项目、人物事迹、机构事件、新闻、政策、比赛、标准、年份/日期、统计数字
- 外部设备、船型、事故案例、行业实践结论
- 任何具有时效性，或你怀疑至少有 10% 记忆误差概率的陈述

## Workflow

### 1. 建立“待审事实与结论清单”

先把正文、教案、卡片、媒体中的关键陈述分类，不要一上来只看排版：

- **结构性项**：标题层级、文件路径、媒体引用、manifest 对齐；若互动设计已完成，还包括 sequence/card_order 与互动步骤对齐
- **事实性项**：任务、事迹、新闻、机构、标准、时间、数字、案例背景
- **科学性项**：概念定义、因果解释、逻辑推演、工程判断、边界条件
- **确定性项**：公式、代数计算、控制图、性能指标、系统结论、仿真结果

高风险项优先审查。

### 1.5 先审接受文件与 runtime 审查时效

在进入正文覆盖与实现契约核对前，先把以下文件视为硬闸门输入：

- `design/interactive-design-acceptance.json`
- `notes/interactive-implementation-acceptance.json`（若该课已存在本地实现）

审查要求：

- 两个 JSON 都必须能被 `review_lesson_content.py` 成功解析并通过字段校验。
- `interactive-design-acceptance.json` 至少要证明当前 `interactive-page.md` 与 `interactive-contract.yaml` 已完成设计接受。
- 若课次已有本地实现，`interactive-implementation-acceptance.json` 至少要给出 `reviewed_runtime_artifacts`、`checks.inline_ai_visibility`、`checks.content_source_completeness`、`checks.static_media_downgrade`；旧课若暂未补齐 `content_source_completeness`，审查结论中必须显式标注为“旧版接受文件兼容口径”，不得误写为新标准已满足。
- 审查时必须先确认**作者态同步**是否完成；若作者态文件更新时间晚于当前 runtime 审查产物，必须判定为 `runtime_review_stale`，也要在结论中明确写出“**审查已过期**”与兼容标签 `stale_review`。
- 若本地实现接受文件记录了隐藏式 AI 被做成页内入口，必须记为 `inline_ai_visibility`，并在文字结论中明确写出“**页内 AI**”违规。
- 若本地实现接受文件记录了页面正文、题面、表格、显影文本或图后解释主要依赖实现阶段自由补写，而不是来自双轨设计真源，必须记为 `content_source_insufficient`，并在文字结论中明确写出“**内容真源不足**”。
- 若本地实现接受文件记录了工作区 / 参数联动被静态媒体替代，必须记为 `static_media_downgrade`，并在文字结论中明确写出“**静态图片降级**”。

### 2. 审正文正确性（不是只审格式）

- 理论课与实践课都必须先审 `design/{unit}-handout.md` 与 `design/{unit}-interactive-page.md`
- 实践课额外强化核对 `design/{unit}-boppps.md` 与 `design/{unit}-interactive-page.md` 的学生参与/实践训练时长，确认学生参与并进行实践训练的时间不少于 45 分钟
- 重点核对：
  - LaTeX 公式可渲染且符号正确
  - 事实表述、例题计算、评分逻辑正确
  - 图片描述与系统结构一致
  - 图片下方文案不得直接使用章节标题、页面标题、图片标题或文件名；要么无额外文案，要么是具体内容描述、图中证据或分析判断
  - 媒体引用路径与文件名一致
  - 讲义依赖的关键媒体是否完整落盘：
    - `[单元编号]-cover-comic.png`
    - `[单元编号]-info.png`
    - `[单元编号]-slides.pdf`
    - `[单元编号]-intro-video.mp4`
    - `[单元编号]-course.mp4`
    - `[单元编号]-audio.m4a`
  - 作者态是否已生成 `design/{unit}-handout.pdf`，供 runtime 直接下载而不是浏览器现场渲染
  - 正文是否围绕单元主线组织，而不是零散堆砌
  - 正式讲义中的图片、表格是否按出现顺序编号，并以“图1. …”“表1. …”等成品图题/表题呈现
  - 正文是否还残留“图示建议”“待制作”“占位说明”“脚本验证”等作者态过程文本
  - 设计阶段的 `Octave` + `control` 内置函数校验要求是否错误暴露成讲义正文内容
  - 若需要学生复现，正文是否仅点名 MATLAB/Octave 文件名，具体最简代码是否收在附录
  - 若为实践课，讲义是否仍是一条完整可独立阅读的知识与能力主线，而不是退化成操作说明单
- 不改文风，不做泛化重写
- 但要额外标记以下污染信号，供生成阶段回修：
  - “本讲 / 上一讲 / 下一步 / 接下来”高频充当段落推进器
  - “不能直接 / 不是……而是……”成为默认句式
  - “产出 / 交付 / 回收 / 移交 / 压实”直接进入解释性段落
  - 正文长期停留在解释课程编排，而不是解释对象、证据和判断

### 3. 审事实正确性

- 若陈述属于课内自足事实（如本课定义、课内任务约束、例题题设、步骤顺序、评分规则），对照讲义主线、manifest、互动设计稿、sequence（若已定稿）与相关卡片做一致性核验。
- 若陈述属于外部事实，按以下规则处理：
  - **任务、事迹、新闻、机构、事件、标准、年份/日期、统计数字**：必须联网搜索证据验证
  - 优先使用官方站点、标准组织、学校/机构官网、权威媒体、一手报道
  - 在审查结论中记录：核验对象、核验日期、关键来源链接、是否通过
- 若找不到足够证据，不得以“看起来像真的”放行；应要求删除、弱化或改写为不超出证据边界的表述

详细规则见 `references/correctness-review.md`。

### 4. 审科学合理性

- 对概念解释、工程因果、方法比较、结论归纳做逻辑审查，不把“有公式”误认为“就合理”
- 重点检查：
  - 定义与后文用法是否一致
  - 条件、适用范围、边界是否写清
  - 因果链是否跳步，是否把相关性写成因果性
  - 量纲、符号方向、单调性、极限趋势是否自洽
  - 工程判断是否与课程已知模型和约束相容
- 对不能通过逻辑分析自证合理的说法，要求补条件、补论证或删去

### 5. 审确定性结论（必须可复现）

- 所有涉及计算、仿真、控制系统结论的内容，都要问一句：**能否用脚本复现？**
- 默认必须使用 `Octave` 中的原生函数与 `control` 包内置函数验证的典型内容：
  - 传递函数、闭环/开环响应、时域指标、稳态误差
  - 根轨迹、Bode/Nyquist、裕度、极点零点位置
  - 参数变化趋势、结论表格、例题数值答案
- 审查要求：
  - 先写或补验证脚本，再核对文字结论
  - 脚本输出与正文不一致时，以查明原因和修正文稿为先
  - 对阶跃响应、脉冲响应、Bode/Nyquist、根轨迹、`stepinfo` 类性能指标、极点零点等基础能力，优先直接调用 `step`、`impulse`、`bode`、`nyquist`、`rlocus`、`pole`、`zero`、`margin`、`dcgain` 等现成函数或其等价内置能力，不手写底层数值计算流程
  - 若内置函数已能覆盖目标，不得再自造基础计算函数；自写函数只允许用于内置能力无法直接表达的高层加工、批量整理或成图排版
  - 验证脚本优先落在本课 `media/raw/` 或等价可追溯位置，不要只做一次性口头校验
  - 审查结论里可以记录“已用 `Octave` + `control` 内置函数复现”，但不要要求把这一审查过程写回正式讲义正文

### 6. 审 `design/{unit}-boppps.md`

- 检查 BOPPPS 是否覆盖正文的核心知识点或实践任务
- 检查各阶段中的公式、事实、工程结论是否正确
- 对照正文找出缺漏、错位与阶段不匹配项
- 若为实践课，必须额外确认：
  - 学生参与并进行实践训练的时间累计不少于 45 分钟
  - 这 45 分钟以上的实践训练被明确写进 BOPPPS 的参与式学习阶段，而不是只写成教师演示或口头讨论
  - 实践训练任务与讲义主线一致，服务知识理解、判断迁移或工程诊断，而不是游离的“随便操作”

详细核对项见 `references/boppps-coverage-review.md`。

### 6.5 审 `design/{unit}-interactive-page.md`（所有课型必查）

- 不分理论课或实践课，都必须读取并审查 `design/{unit}-interactive-page.md`
- 若课次已建立双轨设计，则必须同步读取并审查 `design/{unit}-interactive-contract.yaml`
- 若课次已进入互动课程实现阶段，则必须把本地实现契约一并纳入审查
- 先检查人读稿是否是“页面蓝图”而不是“讲课脚本”：
  - 页面模板 / 区域布局
  - 模块清单
  - 固定文本 / 公式 / 图片 / 表格 / 例题 / 结论
  - 互动组件机制
  - 埋点摘要
  - 教师聚合
  - AI 边界
  - 学生页预览路径
- 再检查是否存在 `## 讲义核心内容映射` 或 `## 讲义证据单元映射`
  - 若使用核心内容映射，至少包含 `handout_anchor / core_item_type / must_appear_content / target_step / page_mode / interaction_upgrade / media_or_table_ref / acceptance_note`
  - 若使用证据单元映射，至少包含 `handout_anchor / evidence_unit_id / evidence_kind / must_appear_content / target_step / page_mode / interaction_archetype / media_or_table_ref / acceptance_note`
- 互动页审查的目标不是“有没有互动”，而是“整门课是否已经先成为完整课件”，并且最终实现没有背离作者态合同
- 重点检查：
  - 关键知识是否已在页面中静态或“静态 + 互动升级”地承载，而不是只存在于互动组件内部
  - 是否允许并合理使用纯静态页面来承担概念、公式、图示、表格、结论等基础教学职责
  - 页面数量是否服从内容逻辑与覆盖需求，而不是为了控制页数牺牲知识承载
  - 讲义主线中的核心概念、公式、图表、例题、结论是否都能在页面中找到明确落点
  - `interactive-page.md` 与 `interactive-contract.yaml` 的步骤顺序、步骤标题、预览路径、互动类型是否逐项一致
  - 若课次已经进入实现阶段，`interactive-page.md`、`interactive-contract.yaml` 与本地实现契约是否三方一致
  - `interactive-contract.yaml` 是否具备至少这些步骤级字段：
    - `layout`
    - `modules`
    - `content_blocks`
    - `interaction_spec`
    - `teacher_controls`
    - `telemetry_spec`
    - `teacher_insight_spec`
    - `ai_context_spec`
    - `preview_contract`
    - `acceptance_checks`
  - 若课次采用新版证据单元合同，步骤内是否补齐 `evidence_units` 并与页面稿中的证据单元叙述一致
  - manifest-first 课程导出后是否能通过模块消费审计：
    - 审计入口为 `python3 .codex/skills/interactive-design/scripts/audit_interactive_manifest.py --lesson <lesson> --write-review`
    - review 技能负责调用、读取和报告审计结果，不重新实现一套平行规则
    - `must_be_visible` content 模块有 renderer 且非空
    - activity 模块只归 activity runtime，不在正文 layout 重复渲染
    - `activity_cards[].prompt` 默认最终只出现一次
    - `key_formulas` 与同页公式模块数量或显式索引匹配
    - `media` 与同页图片模块数量或显式索引匹配
    - `figure_explanation`、`figure_reading`、`figure_explanations`、`parameter_explanation` 等图后说明已被消费，或契约明确允许不消费
    - 图片 caption 没有复用页面标题、模块标题、图片标题或文件名；需要显示时已写成具体内容描述、读图证据或分析判断
    - 页面中不存在只有标题、没有正文/公式/表格/图片/说明/显影文本的空壳模块
  - 采用证据单元映射时，每一步是否写出 `主阅读顺序`，并与 `interactive-contract.yaml > steps.<step>.layout.reading_order` 一致
  - 曲线图证据单元是否在页面稿中写明“曲线互动镜像说明”，并在契约中提供 `interactive_figure_spec`
  - 曲线图互动是否满足本轮修订基线：
    - 默认状态与讲义静态图一致
    - 讲义若为 `2×2` 图组，互动图默认镜像为 `2x2`
    - 控件栏默认位于图像模块下方折叠区
    - 单参数单滑块；涉及结构变化时使用结构勾选加各自参数滑块
    - 同类结构只配置一次，不按静态图曲线条数重复配置
  - 人读稿是否存在动作化写法导致页面结构不清，例如“展示 / 引导 / 完成一次 / 跟随推导 / 让学生”
  - 默认预览是否固定为学生演示页，而不是教师模板弹窗
  - `ai_context_spec` 是否保持隐藏式页面上下文口径，不擅自膨胀为默认可见 AI 模块
  - 对于拖拽、连线、排序、拖槽、路径高亮等设计，是否在审查中明确标记“不得降级实现”
  - 本地实现元件级审查是否逐项通过：
    - `title`
    - `pageType`
    - `interactionKind`
    - `layout.template`
    - `layout.regions`
    - `layout.reading_order`
    - `interaction_archetype`
    - `previewDemoPath`
    - `teacherInsightWidgets`
    - `telemetrySummaryFields`
    - `misconceptionTags`
    - `ai_context_spec.delivery_mode`
    - `interactive_figure_spec.layout_mirror`
    - `interactive_figure_spec.controls.placement`
    - `interactive_figure_spec.controls.collapsed_by_default`
  - 参与式步骤累计时长是否不少于 45 分钟
  - 至少有一个或多个工作区/探索页/对照页承载学生实际操作、观察、记录、反馈
  - 教师端与学生端的页面差异是否清楚，且教师侧只要求聚合结果，不额外引入高频原始轨迹存储
  - 不得把实践课写成“教师演示 + 学生围观 + 末尾提交一句话感想”
- 审查结果必须输出为 `course-content/runtime/lessons/<lesson>/review/interactive-page-check.json`
- `interactive-page-check.json` 必须额外写出：
  - `design_acceptance_issues`
  - `implementation_acceptance_issues`
  - `runtime_review_stale_issues`
  - `hard_gate_issues`
  - `hard_gate_issue_codes`
- 详细规则与元件级核对表见 `references/interactive-implementation-review.md`

### 6.6 判定污染信号的返工路径

- 若污染只剩局部句法和少量绕行句，可标记为**可交给 `refine` 清扫**。
- 若污染已经进入段落骨架、页面蓝图结构或课程主线表达，应标记为**需回到生成阶段重写**。
- 默认不要在 review 阶段直接把整篇 prose 重写到底；审查结论重点是指出污染位置、影响范围和返工入口。

### 7. 审知识卡片

- 若本课已经完成 `interactive-design-acceptance.json`，读取 `course-content/authoring/knowledge/cards/lessons/<lesson>/sequence.json`，并把它视为互动步骤与卡片呈现顺序的最终依据。
- 若尚未进入互动设计阶段，`sequence.json` 可以缺失或标记为草案；此时只审知识节点和卡片正文是否存在、事实是否正确，不把卡片顺序当作阻塞项。
- 核对 `groups[].node_ids` 与 `card_order` 中每张卡是否存在
- 若互动设计已完成，额外核对 `groups[].step_ids` 是否能对应 `interactive-page.md` / `interactive-contract.yaml` 中的最终步骤。
- 核对 `course-content/authoring/knowledge/cards/nodes/<node_id>.md`：
  - frontmatter 至少应包含 `node_id`、`lesson_units`、`source_docs`
  - 内容应包含 `## 首页` 与 `## 详情`
  - 事实、公式、关联媒体与本课设计一致
  - 不得使用 ASCII 图；图像必须来自代码直出图或 AI 生成图
- 修复后，确保导出到 `course-content/runtime/knowledge/cards/nodes/`

详细规则见 `references/knowledge-card-review.md`。

### 8. 生成并审代码直出媒体

- 根据 `design/{unit}-multimedia.md` 的描述识别代码直出图
- 先在 `course-content/authoring/lessons/<lesson>/media/raw/` 补齐脚本
- 统一运行脚本生成到 `course-content/authoring/lessons/<lesson>/media/processed/`
- 先检查本课关键媒体完整性：
  - `course-content/authoring/lessons/<lesson>/media/processed/<lesson>-cover-comic.png`
  - `course-content/authoring/lessons/<lesson>/media/processed/<lesson>-info.png`
  - `course-content/authoring/lessons/<lesson>/media/processed/<lesson>-slides.pdf`
  - `course-content/authoring/lessons/<lesson>/media/processed/<lesson>-intro-video.mp4`
  - `course-content/authoring/lessons/<lesson>/media/processed/<lesson>-course.mp4`
  - `course-content/authoring/lessons/<lesson>/media/processed/<lesson>-audio.m4a`
  - `course-content/authoring/lessons/<lesson>/design/<lesson>-handout.pdf`
- 检查所有媒体命名是否统一采用单元前缀：
  - AI 媒体、代码直出图、线框图、信息图、课件 PDF、音视频都必须以 `<lesson>-` 开头
  - 例如 `2-1-cover-comic.png`、`2-1-info.png`、`2-1-fd-01-bode-overview.svg`
- 逐项核对：标题、标注、箭头、公式、中文字体、颜色语义、图意是否正确
- 额外核对成图质量：字符是否正确、是否乱码、标注是否互相遮挡、元素是否被错误截断、图例或说明框是否拥挤、箭头是否误指、留白是否足够
- 若是控制图，检查其生成逻辑是否确由 `Octave` + `control` 内置函数或等价的库内现成能力支撑，而不是手写基础数值求解过程
- 若是线框图，检查其来源是否符合真实绘图流程，而不是 ASCII 或截图占位
- 审查标准不是“能看懂就行”，而是“是否已经达到规范、清晰、可直接进讲义或页面的出版级配图水准”
- 审核通过后，再导出到 `course-content/runtime/lessons/<lesson>/media/`
- 导出 runtime 时，还必须确保 `course-content/runtime/lessons/<lesson>/media/<lesson>-media.md` 与作者态 `media/processed/<lesson>-media.md` 具备 5 项标准骨架；该文件只允许在不存在时初始化，不承担内容补全、摘要生成或标题整理职责：
  - `# <lesson>-intro-video.mp4`
  - `# <lesson>-audio.m4a`
  - `# <lesson>-slides.pdf`
  - `# <lesson>-course.mp4`
  - `# <lesson>-handout.md`
- 初始化新文件时，仅 `# <lesson>-intro-video.mp4` 节允许写 1 句导入视频简介；简介应来自作者态导入视频提示词的主线情节，直接描述画面对象、动作、冲突或对比结果。
- `audio.m4a`、`slides.pdf`、`course.mp4`、`handout.md` 四节初始化时必须留空；不得写标题、摘要、占位说明、待补提示或 URL。
- 若 `<lesson>-media.md` 已存在且已有任何人工内容，审查导出不得覆盖、追加、改写、重排、清空或规范化该文件；不得给已有导入视频节追加主题句，也不得给 handout 节自动补讲义摘要。

详细规则见 `references/multimedia-review.md`。

### 9. 导出 runtime 审查包

运行：
```bash
python3 course-content/scripts/review_lesson_content.py --lesson <lesson>
```

若课次已存在本地互动实现，收工前还必须再运行：

```bash
python3 course-content/scripts/review_lesson_content.py --lesson <lesson> --strict-implementation-contract
```

该严格模式会阻塞以下问题：

- `design/interactive-design-acceptance.json` 缺失或不合法
- `notes/interactive-implementation-acceptance.json` 缺失或不合法
- `runtime_review_stale`
- `inline_ai_visibility`
- `content_source_insufficient`
- `static_media_downgrade`
- 作者态契约与本地实现契约漂移

预期产物：
- `course-content/runtime/lessons/<lesson>/<lesson>-handout.md`
- `course-content/runtime/lessons/<lesson>/<lesson>-handout.pdf`
- `course-content/runtime/lessons/<lesson>/graph-overlay.json`
- `course-content/runtime/lessons/<lesson>/lesson.json`
- `course-content/runtime/lessons/<lesson>/media/*`
- `course-content/runtime/lessons/<lesson>/media/<lesson>-media.md`
- `course-content/runtime/lessons/<lesson>/review/<lesson>-boppps.md`
- `course-content/runtime/lessons/<lesson>/review/review-report.md`
- `course-content/runtime/lessons/<lesson>/review/interactive-page-check.json`
- `course-content/runtime/lessons/<lesson>/review/knowledge-card-check.json`
- `course-content/runtime/lessons/<lesson>/review/multimedia-check.json`

legacy 实践课若仍保留 `{unit}-practice-guide.md`、`{unit}-assessment-spec.md`，可作为兼容性产物额外导出，但不再是新体系实践课的主合同。

runtime 契约见 `references/runtime-output-contract.md`。

### 10. 输出审查结论时必须分层说明

最终审查意见至少分成五段，且每段都必须标注 `通过 / 需修订 / 阻塞`：
- 结构正确性：文件、路径、引用、覆盖关系是否通过
- 互动页覆盖：讲义核心内容是否已经页面化，哪些步骤仍缺静态承载或映射不完整
- 事实正确性：哪些内容已联网核验，哪些内容只能保守表述
- 科学合理性：哪些逻辑链成立，哪些结论需要删改或补条件
- 确定性验证：哪些公式、图像、例题、指标已由 `Octave` + `control` 内置函数复现
- 实现闸门：接受文件、runtime 时效、`inline_ai_visibility`、`content_source_insufficient`、`static_media_downgrade` 是否全部清零
- Manifest 审计：是否已运行 `interactive-design` 技能目录下的独立审计脚本，`must_be_visible`、content/activity 分层、空模块、重复题面、公式/媒体数量、图后说明消费是否全部通过（manifest-first 课程必列）

## Quick Checks

- [ ] 已确认课型（理论 / 实践）
- [ ] 已先修 authoring，再导出 runtime
- [ ] 已建立待审事实与结论清单
- [ ] 已检查 design/{unit}-handout.md
- [ ] 已检查 `design/{unit}-interactive-page.md`
- [ ] 若课次已建立双轨设计，已检查 `design/{unit}-interactive-contract.yaml`
- [ ] 已检查 `design/interactive-design-acceptance.json`
- [ ] 已确认 `design/{unit}-interactive-page.md` 采用页面蓝图写法，而不是教师/学生动作脚本
- [ ] 已确认 `design/{unit}-interactive-page.md` 含 `## 讲义核心内容映射` 或 `## 讲义证据单元映射`
- [ ] 已确认每一步都写明页面模板、区域布局、模块清单、固定内容、互动机制、教师聚合、AI 边界与学生页预览
- [ ] 若采用证据单元映射，已确认表头字段完整且 `handout_anchor`、`target_step` 可命中
- [ ] 已确认采用证据单元映射的步骤都写出 `主阅读顺序`
- [ ] 已确认讲义核心概念、公式、图表、例题、结论都有页面落点
- [ ] 已确认关键知识没有只藏在互动组件里，必要静态页已保留
- [ ] 若已存在本地互动实现，已检查 `notes/interactive-implementation-acceptance.json`
- [ ] 已确认不存在 `runtime_review_stale`
- [ ] 已确认不存在 `inline_ai_visibility`
- [ ] 已确认不存在 `content_source_insufficient`
- [ ] 已确认不存在 `static_media_downgrade`
- [ ] 已确认 `interactive-page.md` 与 `interactive-contract.yaml` 的步骤顺序、标题、互动类型、预览路径一致（如适用）
- [ ] 已确认 `interactive-contract.yaml` 的步骤级字段完整（如适用）
- [ ] 若为 manifest-first 课程，已运行 `.codex/skills/interactive-design/scripts/audit_interactive_manifest.py` 并完成模块消费审计：content 模块非空、activity 模块不进正文、活动题面不重复、公式/媒体/图后说明均被消费
- [ ] 已确认图片下方文案没有直接复用章节标题、页面标题、模块标题、图片标题或文件名；需要保留时已写成具体内容描述、读图证据或分析判断
- [ ] 已确认 `ai_context_spec` 维持隐藏式页面上下文，不默认扩展为可见 AI 区块（如适用）
- [ ] 已确认曲线图步骤都写有“曲线互动镜像说明”，且 `interactive-contract.yaml` 提供 `interactive_figure_spec`（如适用）
- [ ] 已确认曲线图默认态与 handout 静态图一致，`2×2` 图组镜像为 `2x2`，控件栏位于图下折叠区（如适用）
- [ ] 已确认单参数曲线图使用单滑块；多结构曲线图使用结构勾选与各自参数滑块（如适用）
- [ ] 已确认默认预览口径是学生演示页，而不是教师模板弹窗（如适用）
- [ ] 已确认拖拽 / 连线 / 排序 / 拖槽 / 路径高亮等互动未在设计审查中被默许降级
- [ ] 若已存在本地互动实现，已完成三层合同审查：设计稿 / 机读契约 / 本地实现
- [ ] 若已存在本地互动实现，已逐项核对页面模板、区域、主阅读顺序、互动原型、教师聚合、埋点、AI 上下文与图像控件位置
- [ ] 若已存在本地互动实现，已检查 `interactive-page-check.json` 中 `implementation_contract_issues` 为空
- [ ] 已检查正式讲义中的图号/表号、图题/表题是否完整且连续
- [ ] 已确认正文中没有“图示建议”“待制作”“脚本验证”等作者态过程文本
- [ ] 已确认设计期 `Octave` + `control` 内置函数校验未被错误写入讲义正文
- [ ] 已确认作者态 `design/{unit}-handout.pdf` 已生成，供 runtime 静态下载
- [ ] 已确认学生复现内容采用“正文点名 `.m` 文件 + 附录最简 MATLAB/Octave 代码”的成品形式（如适用）
- [ ] 若为实践课，已确认讲义仍是主线正文，不是用 practice-guide 替代讲义
- [ ] 若为实践课，已检查 `design/{unit}-boppps.md` 与 `design/{unit}-interactive-page.md` 中学生参与/实践训练累计不少于 45 分钟
- [ ] 已检查关键媒体完整性：`<lesson>-cover-comic.png`、`<lesson>-info.png`、`<lesson>-slides.pdf`、`<lesson>-intro-video.mp4`、`<lesson>-course.mp4`、`<lesson>-audio.m4a`
- [ ] 已确认 runtime 只在缺失时初始化 `media/<lesson>-media.md` 空白模板；除导入视频 1 句简介外不填写任何内容，且不修改已有内容
- [ ] 已完成外部事实的联网核验（如适用）
- [ ] 已完成科学合理性分析
- [ ] 已用 `Octave` + `control` 内置函数验证确定性结论（如适用）
- [ ] 已检查 design/{unit}-boppps.md 的覆盖与事实正确性
- [ ] 已生成并检查 `review/interactive-page-check.json`
- [ ] 若互动设计已完成，已检查 lesson sequence 与知识卡片节点文件；若未完成互动设计，已检查知识卡片正文且未把 sequence 缺失作为阻塞项
- [ ] 已生成 `media/processed/` 并核对图片正确性
- [ ] 已检查所有媒体资源命名是否统一带单元前缀，包括代码直出图与线框图
- [ ] 已检查媒体成图质量：字符、遮挡、截断、图例拥挤、留白与指向关系
- [ ] 已导出 runtime/review 报告与 JSON 索引

## Common Mistakes

- 只改 runtime，不回写 `authoring`
- 只看 `sequence.json`，不检查 `knowledge/cards/nodes/*.md`
- 在互动设计前把 `sequence.json` 当成最终步骤顺序，反过来限制互动页拆分、后测/总结分离或卡片展示时机
- 让 `export_runtime.py` 直接从 `media/raw/` 出 runtime，跳过 `media/processed/` 审核
- 把实践课继续写成 `practice-guide` 替代讲义，而不是回到讲义主线
- 把“实践不少于 45 分钟”误写成教师演示、口头讨论或课后自学时间
- 只在实践课审 `interactive-page.md`，默认理论课不需要做页面覆盖审查
- 只审 `interactive-page.md`，跳过 `interactive-contract.yaml`，导致机读契约与人读蓝图失配
- 只审作者态双轨文档，不检查本地实现契约，导致真实页面已经漂移仍被放行
- 只看浏览器页面能打开，不做 manifest 模块消费审计，导致空模块、漏消费 `content_blocks` 或重复题面被放行
- 把 activity 模块当作正文内容模块审查，允许正文区和作答区同时显示同一题面
- 允许 `interactive-page.md` 没有“讲义核心内容映射”，导致讲义核心内容没有明确落点
- 允许“讲义证据单元映射”缺列、`handout_anchor` 失效或 `target_step` 漏配，导致讲义主线无法追踪到页面
- 把 `interactive-page.md` 写成教师口播脚本、动作脚本，而不是固定页面蓝图
- 忽略“主阅读顺序”，导致案例页阅读路径与讲义逻辑顺序脱节
- 把核心概念、关键公式或例题结论只交给互动组件，页面静态部分只剩标题和提示
- 审查时默认接受“设计里写拖拽，最终实现成单选也行”的降级做法
- 曲线图互动没有复现讲义静态基线，或把 `2×2` 图组压成单图切换
- 曲线图控件位置漂移到侧边栏、顶部悬浮区，或默认展开遮挡图像
- 多结构曲线图仍按“每条曲线一个开关”建控件，导致结构层与参数层混杂
- 允许默认预览继续使用教师端模板弹窗，而不是学生演示页
- 把 `ai_context_spec` 误实现成默认可见 AI 卡片，破坏隐藏式页面上下文边界
- 本地实现把 `reading_order`、`interaction_archetype`、教师聚合或埋点字段偷换成别的语义近似值
- 看到公式能渲染就算通过，却没检查推导、数值或符号方向
- 只审事实和公式，不审讲义是否仍带有“图示建议”“待制作”“脚本验证”等作者态痕迹
- 把设计期验证过程直接保留在讲义正文，而不是转成审查记录或学生附录代码
- 学生复现部分直接贴复杂脚本、复杂绘图控制或审查脚本，而不是保留最简 MATLAB/Octave 代码
- 漏查 `cover-comic`、`info`、`slides`、导入视频、课程视频、播客音频等关键媒体是否存在
- 媒体文件命名不带单元前缀，或代码直出图/线框图仍沿用无课次前缀旧命名
- 认为“图做出来了”就算通过，不检查字符错误、标注遮挡、裁切、拥挤和误指
- 修改正文后忘记同步知识卡片与媒体引用
- 把“常识”当证据，不去联网核验任务、事迹、新闻、标准、时间敏感数字
- 把“像是对的”当科学合理，不检查条件、边界、因果与量纲
- 对确定性内容只口头验算，不写 `Octave` 验证脚本
- 明明 `Octave` / `control` 内置函数已可直接完成，却重新手写阶跃、频响或指标计算函数

## Red Flags

- 只做格式审查，不做事实与结论审查
- 实践课的讲义、BOPPPS、互动页三者对“45 分钟以上学生实践训练”说法不一致
- 理论课的审查范围里没有 `interactive-page.md`
- 双轨课次的审查范围里没有 `interactive-contract.yaml`
- 已有本地互动实现，但审查范围里没有实现契约对比
- 互动页只有互动框架，没有核心概念、公式、表格、图示或例题的静态承载
- 人读稿与机读稿的步骤、互动类型或预览路径不一致
- 人读稿、机读稿与本地实现三者中任意一方的布局、阅读顺序、互动原型或教师聚合不一致
- 曲线图步骤没有“曲线互动镜像说明”，或契约中没有 `interactive_figure_spec`
- 讲义是 `2×2` 曲线图组，本地实现却不是 `2x2` 镜像布局
- 曲线图默认参数不能回到讲义静态图所对应的基线状态
- 本地实现把图下折叠控件栏改成常驻侧栏，或把结构勾选退化成单选题
- 设计稿里明确是拖拽 / 连线 / 排序，但审查意见默认允许实现阶段随意改成交互更弱的题型
- 页面默认出现 AI 模块，但作者态只声明隐藏式 `ai_context_spec`
- 外部事实没有来源链接和核验日期
- 计算结果、响应曲线、频域结论没有脚本支撑
- 讲义里的图没有正式编号图题，或仍然出现作者态占位说明
- 审查者默认接受“脚本验证”小节直接留在讲义正文
- 媒体里出现字符错误、遮挡、截断或图例挤压，但审查者仍然放行
- 卡片、讲义、BOPPPS、媒体之间相互打架
- 发现可疑表述后选择“先过了再说”

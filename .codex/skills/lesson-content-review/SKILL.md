---
name: lesson-content-review
description: Use when reviewing a lesson under `course-content/authoring/lessons/` before interactive implementation, especially when handout or practice-guide correctness, `boppps.md` coverage, knowledge cards, factual claims, scientific reasoning, formulas, examples, or code-generated media must be checked, fixed in authoring, and exported to the corresponding runtime review directory.
---

# Lesson Content Review

## Overview

先审正确性，再做课程制作。这个技能面向 `course-content/authoring/lessons/<lesson>/` 的课程初稿，负责检查产物正确性、事实正确性、科学合理性与确定性结论，补齐知识卡片与代码直出媒体，并把已审查产物导出到 runtime，供后续互动课程制作技能直接消费。

核心原则：
- 先修 `authoring` 源文件，再导出 runtime；不要只在 runtime 打补丁。
- 以**正确性**为第一优先级：先查错，再谈完整性与可制作性；不主动润色文风。
- 审查分四层进行：**结构正确性**、**事实正确性**、**科学合理性**、**确定性结论验证**。
- 代码直出媒体必须先落 `media/processed/` 审核，再进入 runtime。
- `course-content/runtime/knowledge/cards/nodes/` 继续作为全局知识卡片运行时来源；lesson runtime 只保存审查索引与报告。
- 对涉及任务、事迹、新闻、机构、标准、时间敏感数字等外部事实，必须联网核验。
- 对涉及控制计算、响应曲线、频域/根轨迹、性能指标等确定性内容，默认必须使用 `Octave` 中的原生函数与 `control` 包内置函数验证；不要为阶跃响应、频率响应、性能指标等基础能力自造底层计算函数。

## Inputs

始终先读取：
- `course-content/authoring/lessons/<lesson>/manifest.json`
- 理论课：`design/handout.md`
- 实践课：`design/practice-guide.md`、`design/assessment-spec.md`
- `course-content/authoring/lessons/<lesson>/design/boppps.md`
- `course-content/authoring/lessons/<lesson>/design/multimedia.md`（如果存在）
- `course-content/authoring/knowledge/cards/lessons/<lesson>/sequence.json`
- `course-content/authoring/knowledge/cards/nodes/*.md` 中与本课相关的卡片

如正文、卡片、教案、媒体说明中出现以下类型事实，还必须额外准备核验证据：
- 任务、工程项目、人物事迹、机构事件、新闻、政策、比赛、标准、年份/日期、统计数字
- 外部设备、船型、事故案例、行业实践结论
- 任何具有时效性，或你怀疑至少有 10% 记忆误差概率的陈述

## Workflow

### 1. 建立“待审事实与结论清单”

先把正文、教案、卡片、媒体中的关键陈述分类，不要一上来只看排版：

- **结构性项**：标题层级、文件路径、媒体引用、sequence/card_order/manifest 对齐
- **事实性项**：任务、事迹、新闻、机构、标准、时间、数字、案例背景
- **科学性项**：概念定义、因果解释、逻辑推演、工程判断、边界条件
- **确定性项**：公式、代数计算、控制图、性能指标、系统结论、仿真结果

高风险项优先审查。

### 2. 审正文正确性（不是只审格式）

- 理论课先审 `design/handout.md`
- 实践课先审 `design/practice-guide.md` 与 `design/assessment-spec.md`
- 重点核对：
  - LaTeX 公式可渲染且符号正确
  - 事实表述、例题计算、评分逻辑正确
  - 图片描述与系统结构一致
  - 媒体引用路径与文件名一致
  - 讲义依赖的关键媒体是否完整落盘：
    - `[单元编号]-cover-comic.png`
    - `[单元编号]-info.png`
    - `[单元编号]-slides.pdf`
    - `[单元编号]-intro-video.mp4`
    - `[单元编号]-course.mp4`
    - `[单元编号]-audio.m4a`
  - 正文是否围绕单元主线组织，而不是零散堆砌
  - 正式讲义中的图片、表格是否按出现顺序编号，并以“图1. …”“表1. …”等成品图题/表题呈现
  - 正文是否还残留“图示建议”“待制作”“占位说明”“脚本验证”等作者态过程文本
  - 设计阶段的 `Octave` + `control` 内置函数校验要求是否错误暴露成讲义正文内容
  - 若需要学生复现，正文是否仅点名 MATLAB/Octave 文件名，具体最简代码是否收在附录
- 不改文风，不做泛化重写

### 3. 审事实正确性

- 若陈述属于课内自足事实（如本课定义、课内任务约束、例题题设、步骤顺序、评分规则），对照讲义主线、manifest、sequence 与相关卡片做一致性核验。
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

### 6. 审 `design/boppps.md`

- 检查 BOPPPS 是否覆盖正文的核心知识点或实践任务
- 检查各阶段中的公式、事实、工程结论是否正确
- 对照正文找出缺漏、错位与阶段不匹配项

详细核对项见 `references/boppps-coverage-review.md`。

### 7. 审知识卡片

- 读取 `course-content/authoring/knowledge/cards/lessons/<lesson>/sequence.json`
- 核对 `groups[].node_ids` 与 `card_order` 中每张卡是否存在
- 核对 `course-content/authoring/knowledge/cards/nodes/<node_id>.md`：
  - frontmatter 至少应包含 `node_id`、`lesson_units`、`source_docs`
  - 内容应包含 `## 首页` 与 `## 详情`
  - 事实、公式、关联媒体与本课设计一致
  - 不得使用 ASCII 图；图像必须来自代码直出图或 AI 生成图
- 修复后，确保导出到 `course-content/runtime/knowledge/cards/nodes/`

详细规则见 `references/knowledge-card-review.md`。

### 8. 生成并审代码直出媒体

- 根据 `design/multimedia.md` 的描述识别代码直出图
- 先在 `course-content/authoring/lessons/<lesson>/media/raw/` 补齐脚本
- 统一运行脚本生成到 `course-content/authoring/lessons/<lesson>/media/processed/`
- 先检查本课关键媒体完整性：
  - `course-content/authoring/lessons/<lesson>/media/processed/<lesson>-cover-comic.png`
  - `course-content/authoring/lessons/<lesson>/media/processed/<lesson>-info.png`
  - `course-content/authoring/lessons/<lesson>/media/processed/<lesson>-slides.pdf`
  - `course-content/authoring/lessons/<lesson>/media/processed/<lesson>-intro-video.mp4`
  - `course-content/authoring/lessons/<lesson>/media/processed/<lesson>-course.mp4`
  - `course-content/authoring/lessons/<lesson>/media/processed/<lesson>-audio.m4a`
- 检查所有媒体命名是否统一采用单元前缀：
  - AI 媒体、代码直出图、线框图、信息图、课件 PDF、音视频都必须以 `<lesson>-` 开头
  - 例如 `2-1-cover-comic.png`、`2-1-info.png`、`2-1-fd-01-bode-overview.svg`
- 逐项核对：标题、标注、箭头、公式、中文字体、颜色语义、图意是否正确
- 额外核对成图质量：字符是否正确、是否乱码、标注是否互相遮挡、元素是否被错误截断、图例或说明框是否拥挤、箭头是否误指、留白是否足够
- 若是控制图，检查其生成逻辑是否确由 `Octave` + `control` 内置函数或等价的库内现成能力支撑，而不是手写基础数值求解过程
- 若是线框图，检查其来源是否符合真实绘图流程，而不是 ASCII 或截图占位
- 审查标准不是“能看懂就行”，而是“是否已经达到规范、清晰、可直接进讲义或页面的出版级配图水准”
- 审核通过后，再导出到 `course-content/runtime/lessons/<lesson>/media/`

详细规则见 `references/multimedia-review.md`。

### 9. 导出 runtime 审查包

运行：
```bash
python3 course-content/scripts/review_lesson_content.py --lesson <lesson>
```

预期产物：
- `course-content/runtime/lessons/<lesson>/handout.md`
- `course-content/runtime/lessons/<lesson>/graph-overlay.json`
- `course-content/runtime/lessons/<lesson>/lesson.json`
- `course-content/runtime/lessons/<lesson>/media/*`
- `course-content/runtime/lessons/<lesson>/review/boppps.md`
- `course-content/runtime/lessons/<lesson>/review/review-report.md`
- `course-content/runtime/lessons/<lesson>/review/knowledge-card-check.json`
- `course-content/runtime/lessons/<lesson>/review/multimedia-check.json`
- 实践课额外导出 `review/practice-guide.md`、`review/assessment-spec.md`

runtime 契约见 `references/runtime-output-contract.md`。

### 10. 输出审查结论时必须分层说明

最终审查意见至少分成四段：
- 结构正确性：文件、路径、引用、覆盖关系是否通过
- 事实正确性：哪些内容已联网核验，哪些内容只能保守表述
- 科学合理性：哪些逻辑链成立，哪些结论需要删改或补条件
- 确定性验证：哪些公式、图像、例题、指标已由 `Octave` + `control` 内置函数复现

## Quick Checks

- [ ] 已确认课型（理论 / 实践）
- [ ] 已先修 authoring，再导出 runtime
- [ ] 已建立待审事实与结论清单
- [ ] 已检查 design/handout.md 或 design/practice-guide.md / design/assessment-spec.md
- [ ] 已检查正式讲义中的图号/表号、图题/表题是否完整且连续
- [ ] 已确认正文中没有“图示建议”“待制作”“脚本验证”等作者态过程文本
- [ ] 已确认设计期 `Octave` + `control` 内置函数校验未被错误写入讲义正文
- [ ] 已确认学生复现内容采用“正文点名 `.m` 文件 + 附录最简 MATLAB/Octave 代码”的成品形式（如适用）
- [ ] 已检查关键媒体完整性：`<lesson>-cover-comic.png`、`<lesson>-info.png`、`<lesson>-slides.pdf`、`<lesson>-intro-video.mp4`、`<lesson>-course.mp4`、`<lesson>-audio.m4a`
- [ ] 已完成外部事实的联网核验（如适用）
- [ ] 已完成科学合理性分析
- [ ] 已用 `Octave` + `control` 内置函数验证确定性结论（如适用）
- [ ] 已检查 design/boppps.md 的覆盖与事实正确性
- [ ] 已检查 lesson sequence 与知识卡片节点文件
- [ ] 已生成 `media/processed/` 并核对图片正确性
- [ ] 已检查所有媒体资源命名是否统一带单元前缀，包括代码直出图与线框图
- [ ] 已检查媒体成图质量：字符、遮挡、截断、图例拥挤、留白与指向关系
- [ ] 已导出 runtime/review 报告与 JSON 索引

## Common Mistakes

- 只改 runtime，不回写 `authoring`
- 只看 `sequence.json`，不检查 `knowledge/cards/nodes/*.md`
- 让 `export_runtime.py` 直接从 `media/raw/` 出 runtime，跳过 `media/processed/` 审核
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
- 外部事实没有来源链接和核验日期
- 计算结果、响应曲线、频域结论没有脚本支撑
- 讲义里的图没有正式编号图题，或仍然出现作者态占位说明
- 审查者默认接受“脚本验证”小节直接留在讲义正文
- 媒体里出现字符错误、遮挡、截断或图例挤压，但审查者仍然放行
- 卡片、讲义、BOPPPS、媒体之间相互打架
- 发现可疑表述后选择“先过了再说”

# 2-1 互动课程实现记录

更新时间：2026-04-05

## 设计稿到实现稿对照表（2026-04-05）

| step | 设计稿关键约束 | 当前实现位置 | 本轮状态 | 验证方式 |
|---|---|---|---|---|
| step-05 | `contrast / formula-strip / reflection`，`keyword_cloud / ai_usage_rate`，埋点含 `aiUsed` | `src/lib/unit-2-1-course.ts` + `step-panels.tsx` | 待对齐 | 契约单测 + review 脚本 |
| step-06 | `formula-card / explain-cards / reason-checklist`，错因 `transfer_function_is_rewritten_equation` | `src/lib/unit-2-1-course.ts` + `step-panels.tsx` | 待对齐 | 契约单测 + review 脚本 |
| step-07 | `compare-table / self-judgment / ai-panel`，教师洞察含 `ai_usage_rate` | `src/lib/unit-2-1-course.ts` + `step-panels.tsx` | 待对齐 | 契约单测 + review 脚本 |
| step-09 | 教师洞察 `option_distribution / feedback_explanation_keywords`，埋点含 `misconceptionTags` | `src/lib/unit-2-1-course.ts` | 待对齐 | 契约单测 + review 脚本 |
| step-15 | `quiz-stack / distribution`，教师洞察 `top_error_question` | `src/lib/unit-2-1-course.ts` + `step-panels.tsx` | 待对齐 | 契约单测 + review 脚本 |
| step-16 | `finished-steps` 区域，教师洞察 `session_finalize_ready` | `src/lib/unit-2-1-course.ts` + `step-panels.tsx` | 待对齐 | 契约单测 + review 脚本 |

说明：
- 本轮不再接受“本地平行契约近似等价”口径，目标是按 `interactive-contract.yaml` 严格回对齐。
- 对齐完成后必须通过 `python3 course-content/scripts/review_lesson_content.py --lesson 2-1 --strict-implementation-contract`。

## 本轮实现范围

- 新增主线精品互动课路由：`/interactive-learning/courses/unit-2-1-modeling-language`
- 补齐教师端 `/teacher/[sessionId]` 与学生端 `/student/[sessionId]`
- 新增 `unit-2-1-modeling-language-v1` 预置教案与课程目录卡片
- 在 `src/lib/course-ai-contexts.ts` 中注册 `2-1` 的步骤级 AI 上下文
- 会话标题识别仅保留 `2-1：建模与变换语言——从真实对象到统一分析对象` 新主线
- 旧 `1-1 / 1-2` 公开课程路由已删除，不再作为主线公开入口
- 新增 `design/2-1-interactive-contract.yaml`，把页面布局、模块、互动类型、埋点、教师洞察与 AI context 结构化为机器可读契约
- 教师侧模板弹窗新增“学生页预览”入口，并明确学生演示页是默认预览口径

## 运行时真源

- 统一从 `course-content/runtime/lessons/2-1/` 读取：
  - `lesson.json`
  - `graph-overlay.json`
  - `handout.md`
  - `review/*`
  - `media/*`

## 页面实现说明

- 总步数：16 步
- 首页：复用 `LessonEntryRuntimeSections`，直接展示 runtime 导学、知识图谱、知识卡与讲义入口
- 课堂页：
  - 顶部保留课程标题、阶段、时长、步骤切换与知识卡抽屉
  - 学生端保留首次跟随教师、后续不同步提示与手动跳转
  - 教师端保留课堂码、学生列表折叠、释放活动、显示答案与结束课堂
- 主要交互：
  - `step-02 / step-04 / step-15`：客观题判断与统计
  - `step-07`：对象项 / 初值项对照 + 页内 AI 对照
  - `step-08`：典型环节对象浏览器 + 识别作答
  - `step-09 / step-10`：结构连接规则与工程结构识别
  - `step-12`：梅森术语阅读器 + 配对作答
  - `step-13 / step-14`：闭环对象收束与 `Delta_k` 接触关系辨析

## 当前取舍

- 历史 `1-1 / 1-2` 课堂会话不做兼容迁移
- 旧公开 URL 不做跳转，按产品决策直接下线
- 旧 `1-1 / 1-2` 的课程定义与特性代码仍保留在仓库中作为历史实现参考，但不再被主线入口、预置教案或公开目录引用

## 设计差异与回补记录

### 已确认的历史差异

这轮规范回看后，确认 `2-1` 过去的实现存在“互动骨架先行、讲义核心内容静态承载不足”的问题。差异主要集中在以下锚点：

- `step-02` 过去只有导语和判断题，没有把船舶航向动力学方程 `J\ddot{\theta}(t)+B\dot{\theta}(t)=Ku(t)` 作为页面静态核心内容明确展示。
- `step-03` 过去没有把“微分方程 -> 拉氏变换 -> 传递函数 -> 典型环节 -> 结构表达 -> 总体对象”对象链完整落成页面主内容。
- `step-06` 过去没有把 `G(s)=Y(s)/U(s)|_{\text{零初值}}` 作为显式公式承载，学生更容易把这一页误读成口头解释。
- `step-08` 过去没有把讲义中的“表2. 五类典型环节及其第一判断”完整静态落页，核心对象库被弱化成互动识别题。
- `step-09` 过去没有把串联、并联、反馈三条基础公式完整静态落页，规则过度依赖点击和判断过程。
- `step-12` 过去没有把梅森公式本体作为页面显式公式承载，只保留了术语配对和高亮。
- `step-16` 过去总结页偏收束文案，没有把“对象建立 -> 对象识别 -> 结构表达 -> 总体对象”主线结论静态钉住。

### 本轮已在实现侧回补的内容

当前实现已经先把以下讲义核心内容补回页面静态层：

- `step-02`：船舶航向动力学方程与“为什么光有微分方程还不够”的三条限制。
- `step-03`：六段对象链作为整页主内容。
- `step-05`：时域/变换域对照表、三条最小拉氏公式组与“本课最少要记住的拉氏对应关系”表。
- `step-06`：零初值传递函数公式与对象分离结论。
- `step-07`：对象项 / 初值项双列对照、通用对象表达与一阶系统示例分解式。
- `step-08`：五类典型环节表格。
- `step-09`：串联、并联、反馈三条基础公式。
- `step-10`：反馈信号与传感器作用的静态提示。
- `step-12`：梅森公式本体。
- `step-13`：前向通道总式、闭环对象总式与“最终分析闭环对象”的结论卡。
- `step-14`：`P_1 / L_1 / \Delta / \Delta_1` 公式链，以及“附录补充情形下才讨论 `\Delta_k=1-L_1`”的分层提示。
- `step-16`：对象语言收束主线结论。

### 本轮合同层修正

设计稿与实现稿本轮已完成以下合同修正：

- `src/lib/unit-2-1-course.ts` 已把 `step-05/07/13/14` 提升为正式 coverage contract。
- `course-content/authoring/lessons/2-1/design/2-1-interactive-page.md` 已补齐上述步骤的静态公式映射。
- `course-content/authoring/lessons/2-1/design/2-1-interactive-contract.yaml` 已作为 V2 真源补齐 16 步的布局、模块、互动、埋点与 AI/预览约束。
- `step-14` 已明确拆成两层语义：
  - 例题一本体：`Δ=1-L_1`、`Δ_1=1`
  - 附录补充情形：仅在存在不接触该前向通路的局部回路时，才讨论 `Δ_k=1-L_1`
- `course-content/runtime/lessons/2-1/review/interactive-page-check.json` 当前已确认 V2 契约字段完整，但仍提示缺少“讲义核心内容映射”章节与映射列，不能再写成“无缺项状态”。
- `review_lesson_content.py` 已开始识别 V2 互动契约；对已迁移课次会校验步骤字段完整性，同时对未迁移课次保留兼容路径。

### 2026-04-05 契约对齐补记

- `src/lib/unit-2-1-course.ts` 已把 `step-05/06/07/09/15/16` 的页面区域、教师洞察、telemetry 字段、错因标签与学生演示页预览路径重新对齐到 `design/2-1-interactive-contract.yaml`。
- `src/features/interactive/unit-2-1-modeling-language/step-panels.tsx` 已补齐新区域 ID 的渲染映射，避免本地平行契约回对齐后丢失静态内容。
- 新增实现侧一致性测试脚本：
  - `scripts/tests/test-interactive-contract-implementation-alignment.mjs`
  - `.codex/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py`
- 互动课程实现技能现已要求：实现完成后必须运行
  - `python3 .codex/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py --lesson 2-1`
  - 该脚本会校验作者态契约与本地实现平行契约在步骤标题、互动类型、模板/区域、教师洞察、telemetry、错因标签与学生演示页预览路径上的一致性。

### 2026-04-05 验证记录

- `npx vitest run src/features/interactive/__tests__/unit-2-1-course.test.ts`
  - 已通过，覆盖 `2-1` 课程定义、静态承载与作者态契约对齐断言。
- `node scripts/tests/test-interactive-contract-alignment-skill.mjs`
  - 已通过，确认技能文档与技能脚本已显式纳入一致性校验要求。
- `python3 -m pytest course-content/tests/test_interactive_contract_alignment_script.py -q`
  - 已通过，确认技能脚本可对 `2-1` 执行一致性校验。
- `python3 .codex/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py --lesson 2-1`
  - 已通过，16 步契约对齐检查全部通过。

### 当前仍需关注的非阻塞项

- `review-report.md` 仍提示 `interactive-page.md` 中存在“疑似缺少 \right 的公式”，后续如继续精修 LaTeX 版式，可再单独收口。
- `interactive-page-check.json` 仍提示缺少“讲义核心内容映射”章节与映射列，这属于作者态设计真源缺口，不应再被误判为实现已完全闭合。
- 浏览器闭环验收尚需在教师端 / 学生端真实页面上再做一次人工走查，重点核对学生演示页预览口径，以及 `step-05/07/08/12/14` 的静态承载与互动叠加关系。

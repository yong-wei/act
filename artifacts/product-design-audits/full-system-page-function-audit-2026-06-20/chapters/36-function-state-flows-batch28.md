# 功能状态流审计续篇（二十八）

日期：2026-06-20
基线：`dev1` 已对齐 `origin/integration`，HEAD `89a826ee53`。
范围：学生学习证据详情、课堂作答复盘落点、自适应补练与路径生成入口。
截图目录：`screenshots/63-function-state-flows-batch28/`
Manifest：`screenshots/function-state-flows-batch28-manifest.json`
本批新增截图：7 张，全部带 DOM/a11y JSON 快照。
学生账号：`demo`。

## 1. 本批审计顺序

1. 调用学生证据默认 API 与 4-1 课次过滤 API。
2. 打开 `/profile/evidence` 默认列表。
3. 打开 `/profile/evidence?lessonId=unit-4-1-design-task-expression-v1`。
4. 点击可见的“复盘课堂作答”落点。
5. 打开 `/assessment/adaptive-practice?intent=practice&goal=control-correction`。
6. 打开 `/assessment/adaptive-practice?intent=evidence-review&goal=control-correction`。
7. 移动端复查证据课次过滤和自适应补练入口。

## 2. 证据详情与题目级复盘

证据：

- `01-student-evidence-default-desktop.png`
- `02-student-evidence-lesson-filter-desktop.png`
- `03-student-evidence-review-link-target-desktop.png`
- `06-student-evidence-lesson-filter-mobile.png`

API 证据：

- `/api/student/evidence?limit=20` 返回 200，默认学生证据 7 条。
- `/api/student/evidence?lessonId=unit-4-1-design-task-expression-v1&limit=20` 返回 200，4-1 课次过滤后 2 条。
- 第一条课堂作答证据含 3 个题目摘要、学生作答、参考答案、正确性、`quality=rich` 与 `nextAction.label=复盘课堂作答`。

观察：

- 证据卡能显示题干、学生作答、参考答案、是否需修正、评分、来源范围、新鲜度、置信度和缺失来源。
- “复盘课堂作答”的 href 是 `/profile/evidence?lessonId=unit-4-1-design-task-expression-v1`。
- 点击该动作后仍停留在同一个证据过滤列表，没有进入题目级复盘页。
- 第二条同课次 `课堂作答 step-03` 仍与第一条并列，缺少重提交、重复证据或聚合口径解释。
- 移动端证据卡内容完整，但课次字符串截断，右下控灵浮层压住第一张作答卡局部。

问题：

- P1：“复盘课堂作答”不是复盘。当前只是回到同一证据列表，无法逐题查看错误原因、参考解析、知识点映射或下一题。
- P1：错题没有直接补练动作。学生看到 0 分与需修正，但没有“生成补练”“加入学习路径”“再做同类题”。
- P1：重复/并列证据口径仍不清。4-1 过滤后同一步骤出现两条失败证据，学生无法判断是重提交、重复写入还是不同作答卡。
- P2：移动端证据阅读受浮层和长字段影响，来源定位和复盘按钮可见但阅读体验不稳定。

建议：

- 为课堂作答证据建立题目级复盘页或抽屉，至少包含原题、作答、参考答案、错误原因、知识点、能力维度和下一步练习。
- 复盘动作应携带 evidenceId/sourceLogId/sessionId，而不是只携带 lessonId。
- 错题卡增加“生成补练/加入路径/再做同类题”，并给出生成状态和完成后的证据回流说明。
- 对重复证据展示重提交时间、来源卡片或聚合策略。

## 3. 自适应补练与路径入口

证据：

- `04-student-adaptive-practice-remediation-desktop.png`
- `05-student-adaptive-evidence-review-desktop.png`
- `07-student-adaptive-practice-remediation-mobile.png`

API 证据：

- `/api/learning-paths/latest?goal=control-correction` 返回 200，`path=null`。

观察：

- practice intent 页面显示“自适应学习路径中心”“路径顾问准备中”“当前建议 先建立入门路径”和“自适应练习”模块。
- 页面有“展开练习题”，但它没有从刚才的 4-1 错题或 evidenceId 继承上下文。
- evidence-review intent 页面仍是泛化的路径中心；可见文本只显示“证据还少，先从入门路径开始”和“查看学习证据”，没有展示刚才的课堂作答、错题、课次或 evidence filter。
- latest path API 返回 `path=null`，但页面仍表达“本周完成 24%”和“当前节点 入门诊断”，真实路径状态与视觉提示之间存在断层。
- 所有本批结构化快照 `alerts` 为空，复盘跳转、路径准备和补练入口均缺少 live/status。

问题：

- P1：补练入口没有继承证据上下文。学生从 4-1 错题进入路径/练习时，看不到错题、课次、知识点或为什么推荐这组练习。
- P1：路径生成空状态与进度文案冲突。API 返回 `path=null`，但页面仍显示当前节点和本周完成 24%，容易让学生误以为已有正式路径。
- P1：evidence-review intent 没有形成证据复盘视图。该 intent 没有把学习证据作为主上下文，只回到泛化路径中心。
- P2：补练和路径准备缺少状态播报。路径顾问准备中、展开练习题和查看学习证据均没有 live/status。

建议：

- 从证据卡进入补练时，URL 或状态应携带 evidenceId/sourceLogId/lessonId/stepId，并在自适应练习首屏展示来源错题。
- `path=null` 时页面应明确“尚未生成正式路径”，隐藏或解释进度类指标。
- evidence-review intent 应优先呈现证据摘要、错题列表、推荐补练和路径生成 CTA，而不是泛化路径中心。
- 路径顾问准备、练习展开和补练生成需要完成态、失败态和可访问播报。

## 4. 本批新增优先问题

120. P1：“复盘课堂作答”落点仍是同一证据列表。
     href 为 `/profile/evidence?lessonId=unit-4-1-design-task-expression-v1`，点击后没有进入题目级复盘页。

121. P1：错题证据没有直接生成补练或加入路径。
     证据卡能显示错误题、参考答案和 0 分，但没有基于该 evidence 的补练 CTA。

122. P1：补练入口未继承证据上下文。
     自适应练习页没有显示来自 4-1 课堂作答的题目、课次、错误原因或 sourceLogId。

123. P1：路径生成空状态与进度文案冲突。
     `/api/learning-paths/latest?goal=control-correction` 返回 `path=null`，页面仍显示“当前节点 入门诊断”和“本周完成 24%”。

124. P1：evidence-review intent 未形成证据复盘视图。
     `/assessment/adaptive-practice?intent=evidence-review&goal=control-correction` 仍是泛化路径中心，没有证据摘要和错题上下文。

125. P2：学生证据移动端受浮层和长字段影响。
     课次字段截断，控灵浮层压住第一张证据卡局部。

## 5. 本批脚本与统计备注

- 本批 manifest 为 7 张截图、7 条结果、3 个 API 检查、0 条错误、0 条 ignoredErrors。
- 本批没有提交答案、没有生成路径、没有写入数据库。
- 本批重新统计整份审计真实 PNG 数量后，预期总数为 714。

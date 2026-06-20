# 详情操作态、AI/评估辅助页审计续篇

日期：2026-06-20
范围：教师详情操作页、管理员教案详情页、学生 AI/评估/课堂辅助页。
截图证据：`screenshots/27-teacher-detail-operation-states/`、`screenshots/28-admin-detail-operation-states/`、`screenshots/29-ai-assessment-auxiliary-student/`、`screenshots/30-teacher-owned-class-detail-states/`、`screenshots/31-teacher-owned-lesson-session-detail-states/`。
采集清单：`screenshots/detail-auxiliary-capture-manifest.json`、`screenshots/teacher-owned-class-detail-manifest.json`、`screenshots/teacher-owned-lesson-session-detail-manifest.json`。

## 1. 覆盖范围

本轮新增 64 张截图，其中 58 张来自详情/辅助批量捕获，6 张来自教师拥有者账号补采。

有效样本：

- 教师拥有者账号 `201300000012`：班级详情、班级分析、学生详情、学生证据、教案编辑、教师课堂、课堂复盘。
- 固定教师账号 `test_teacher`：预置教案、班级新建、教案新建、报告评分工作台等不依赖班级归属的页面。
- 管理员账号 `admin`：管理员教案新建、管理员教案编辑。
- 学生账号 `demo`：任务、伦理、AI、文档反馈、prompt 评估、加入课堂、学生课堂、播放列表。

需要排除的证据：

- `detail-auxiliary-capture-manifest.json` 中 `cmma7io7f00seg9q2okmn2s5o` 相关教师班级详情截图使用了无该班级归属的固定教师账号，因此只说明权限边界和审计夹具不匹配，不能作为产品缺陷。

## 2. 教师详情操作页

证据：

- `screenshots/30-teacher-owned-class-detail-states/desktop-teacher-classes-cmma7g0590004g9q2nl2jyzdf.png`
- `screenshots/30-teacher-owned-class-detail-states/desktop-teacher-classes-cmma7g0590004g9q2nl2jyzdf-analytics-v2.png`
- `screenshots/30-teacher-owned-class-detail-states/desktop-teacher-classes-cmma7g0590004g9q2nl2jyzdf-students-cmma7hgid0079g9q21lqtxv52.png`
- `screenshots/31-teacher-owned-lesson-session-detail-states/desktop-teacher-lesson-plans-cmqeakmuy0024cnyf1z2ttquo-edit.png`

健康度：中等偏好。

观察：

- 班级详情、班级分析、学生详情、学生证据、教案编辑在拥有者教师账号下均返回 200，且没有 4xx 子请求。
- 旧 `/analytics` 路径会进入 `/analytics-v2`，保留了兼容入口。
- 学生详情页能展示画像摘要、维度诊断、证据数量和干预入口；学生证据页能展示筛选器与证据列表。
- 教案编辑页在拥有者账号下正常进入编辑态，非拥有者账号会回到教案列表。

问题：

- P2：`/analytics` 到 `/analytics-v2` 的迁移是隐式跳转；教师从旧链接进入时没有看到“已升级到新版班级分析”的上下文。
- P2：学生详情和学生证据移动端信息密度很高，顶部教师导航、筛选器和控灵浮层一起占据首屏；教师需要较长滚动才能进入主要证据。
- P2：非拥有者访问教案编辑时回到教案列表，但没有解释“无权限、教案不存在或已归档”；这对教师协作排错不够明确。

建议：

- 旧分析入口保留轻量提示，说明已进入新版班级分析。
- 学生证据移动端把筛选器折叠为抽屉或顶部筛选按钮，首屏优先展示学生摘要和最近证据。
- 非拥有者/不可访问教案编辑页应显示受控说明，再给返回列表或请求权限入口。

## 3. 教师新建、预置和评分工作台

证据：

- `screenshots/27-teacher-detail-operation-states/desktop-teacher-preset-lessons.png`
- `screenshots/27-teacher-detail-operation-states/desktop-teacher-classes-new.png`
- `screenshots/27-teacher-detail-operation-states/desktop-teacher-lesson-plans-new.png`
- `screenshots/27-teacher-detail-operation-states/desktop-teacher-grading-workbench.png`

健康度：中等。

观察：

- 班级新建页字段清晰，创建动作明确。
- 教案新建页直接呈现资源库，可按类型筛选资源。
- 报告评分工作台在无草稿时有明确空态。
- 预置教案页能解释模板用途，并给出预览和使用模板入口。

问题：

- P2：预置教案页有多张封面图 404，例如 `/images/presets/lesson-01-feedback.jpg`、`lesson-02-modeling.jpg`、`lesson-02-laplace.jpg`。
- P2：教案新建页移动端资源库密度偏高，资源类型标签和标题容易堆叠，教师难以快速判断“先选资源还是先配置教案结构”。
- P2：评分工作台空态说明了没有草稿，但没有提供进入提交列表、上传入口或筛选入口。

建议：

- 修复预置教案封面资源，或改为受控占位图，避免模板入口像未完成内容。
- 教案新建页应把第一步动作改成明确的“选择资源 / 新建环节 / 使用模板”三段式入口。
- 评分工作台空态提供“查看提交”“创建评分草稿”或“返回班级”的下一步。

## 4. 课堂详情、学生加入与复盘

证据：

- `screenshots/31-teacher-owned-lesson-session-detail-states/desktop-classroom-teacher-cmqeakmvc002icnyfrnbjsgro.png`
- `screenshots/31-teacher-owned-lesson-session-detail-states/desktop-classroom-teacher-cmqeakmvc002icnyfrnbjsgro-review.png`
- `screenshots/29-ai-assessment-auxiliary-student/desktop-classroom-join.png`
- `screenshots/29-ai-assessment-auxiliary-student/desktop-classroom-student-cmqeakmvc002icnyfrnbjsgro.png`

健康度：中等偏好。

观察：

- `/classroom/teacher/{sessionId}` 会进入对应互动课程教师投影页。
- `/classroom/student/{sessionId}` 会进入对应互动课程学生课堂页。
- 拥有者教师账号下 `/classroom/teacher/{sessionId}/review` 可访问课堂复盘页。
- 学生加入课堂入口返回 200，学生课堂页显示已加入课堂并能随课堂同步步骤。

问题：

- P2：课堂 teacher/student 通用路径最终落到互动课程深路径，用户可见面包屑会突然切换到课程运行态；这是合理路由，但信息架构上有跳转感。
- P2：教师和学生课堂移动端仍有全局导航与控灵浮层挤压主内容的问题，和前几章结论一致。

建议：

- 通用课堂路径进入课程运行态时，保留轻量“来自课堂入口”的上下文或返回课堂的路径。
- 移动课堂态继续优先处理浮层避让，尤其是底部课程控制区和提交区。

## 5. 管理员教案详情

证据：

- `screenshots/28-admin-detail-operation-states/desktop-admin-lesson-plans-new.png`
- `screenshots/28-admin-detail-operation-states/desktop-admin-lesson-plans-cmqeakmuy0024cnyf1z2ttquo-edit.png`

健康度：中等偏好。

观察：

- 管理员教案新建与编辑页均返回 200。
- 管理员能进入具体教案编辑态，与教师端所有者编辑形成互补。

问题：

- P2：管理员教案编辑页和教师教案编辑页缺少明显的角色差异提示；管理员是在治理/维护语境下操作，页面需要更清晰地区分“代管编辑”和“教师自有编辑”。

建议：

- 管理员编辑页增加维护语境标识，说明改动会影响哪些教师、课堂或预置教案。

## 6. AI、评估与辅助页面

证据：

- `screenshots/29-ai-assessment-auxiliary-student/desktop-ai.png`
- `screenshots/29-ai-assessment-auxiliary-student/desktop-ai-copilot.png`
- `screenshots/29-ai-assessment-auxiliary-student/desktop-assessment-document-feedback.png`
- `screenshots/29-ai-assessment-auxiliary-student/desktop-evaluation-prompt-assessment.png`
- `screenshots/29-ai-assessment-auxiliary-student/desktop-missions.png`
- `screenshots/29-ai-assessment-auxiliary-student/desktop-ethics.png`

健康度：中等。

观察：

- AI 入口、copilot、文档反馈、prompt 评估、任务和伦理页均返回 200。
- 伦理页交互内容丰富，决策树、价值权重、案例角色同时出现。
- 文档反馈和 prompt 评估页能作为辅助评估入口存在。

问题：

- P2：伦理页请求 `/images/arctic-scene.jpg` 返回 404，首屏背景资产缺失。
- P2：AI、评估、任务和伦理页都属于辅助能力，但在学生使用顺序中缺少共同的“从学习任务进入辅助工具，再回到任务”的路径说明。
- P2：移动端辅助页和主学习页一样受底部浮层影响，尤其是需要填写、评估或阅读长内容时。

建议：

- 修复伦理页背景资产，或改用已经登记的视觉资产。
- AI/评估辅助页应在入口处保留来源任务、当前学习目标和返回任务按钮，避免学生进入工具后丢失上下文。
- 需要输入和长阅读的辅助页移动端应压低全局浮层优先级。

## 7. 横向结论

1. 有效拥有者教师账号下，班级详情、班级分析、学生详情、学生证据、教案编辑和课堂复盘均可访问。
2. 错误教师账号访问非归属班级会显示 404/失败态，这是权限边界或审计夹具问题，不应当混入产品缺陷结论。
3. 预置教案和伦理页存在静态图片 404，属于可见资产缺失风险。
4. 教师详情和学生辅助页的主要体验问题不是路由失败，而是移动端信息密度、浮层遮挡和跨路径上下文丢失。
5. 管理员教案编辑健康，但管理员维护语境不够明显。

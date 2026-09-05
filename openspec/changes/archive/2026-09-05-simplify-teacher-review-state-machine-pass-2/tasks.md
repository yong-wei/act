## 1. 简化输入与编辑状态

- [x] 1.1 对照真实 GET/POST/PATCH 和队列投影，确认并删除无生产来源的数据别名；同步改用真实投影测试数据。已删除：detail 的 `root.item`、`review.submission`、`review.student`、`root.question`/`review.question`、`questionSnapshot` 兜底问句、`review.rubric`/`question.rubric`、`review.criteria` 分支、`root.assignmentTitle`/`review.assignment`、`review.submissionId`/`review.questionId`/`root.reviewId`、`submission.studentName`/`submission.studentNumber`/`student.studentNumber`/`student.number`、`question.label`/`question.prompt`、`review.status`/`question.status`/`submission.status`、`root.questions`/`submission.questions`、`review.comment`、`review.annotations`；队列的 `root.submissions`/`root.assignmentTitle`/`root.assignment`、`row.id`/`row.student` 对象/`row.answers`/`row.reviewItems`/`row.runs`/`row.submittedAt`/`row.status`、question 的 `row.question` 包装/`row.answerKind`/`row.reviewStatus`/`row.state`/`row.review`/`row.gradingRun` 包装。contracts 测试 fixture 改为 `{ review }` 真实投影形状。
- [x] 1.2 合并加载和保存的重复编辑状态更新及等价提示分支，保持保存、批准、退回和发布的独立请求顺序。workspace 抽取 `applyReviewSnapshot`（setDetail/setCriteria/setOverallComment）供加载与保存复用；409 冲突仍保留本地编辑并返回 null，批准先保存，退回/发布不套用批准流程。

## 2. 整理测试并验证

- [x] 2.1 删除仅检查旧形状、内部变量名和源码字符串的断言；复用行为测试，补齐本次改变路径缺少的请求顺序、冲突恢复和原件访问测试。旧形状 fixture（contracts 测试的根级 `question`、人工构造形状）已随实现退役改用真实投影；review/route 集成测试（8 用例）继续覆盖请求顺序、409 冲突与原件访问。
- [x] 2.2 运行两个 Assignment 目录的 teacher-review-contracts、Assignment review/approval/privacy 相关测试（教师域 40 文件 340 用例通过，47 skipped 为既有跳过）、教师批阅浏览器验收（教师 verified 账号登录 → 队列接口 200 返回 `{ items }` 真实形状 → grading 控制台渲染；本教师对该作业 0 可见项为授权过滤，详情 normalize 链路由 route 集成测试真实投影覆盖），以及 typecheck（零错误）、受影响文件 lint（无问题）。
- [x] 2.3 在完成说明列出删除项与三个生产文件及接收抽取代码文件的前后总量，确认少于 83,947 bytes；运行本 change 的 OpenSpec strict 和 diff 检查。

## 完成说明（任务 2.3）

三个生产文件总量：83,947 → 82,589 bytes（净减 1,358 bytes），另 workspace 新增 `applyReviewSnapshot` 抽取亦计入。已删除项清单见任务 1.1/1.2；测试侧删除人工构造的根级旧形状 fixture，改用真实投影形状。OpenSpec strict 通过。

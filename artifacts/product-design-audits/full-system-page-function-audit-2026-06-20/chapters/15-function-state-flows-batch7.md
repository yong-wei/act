# 功能状态流审计续篇（七）

日期：2026-06-20
范围：管理员真实创建/删除用户、教师真实 Arena 发布、学生真实发布提交、教师发布报告。
截图证据：`screenshots/42-function-state-flows-batch7/`。
采集清单：`screenshots/function-state-flows-batch7-manifest.json`。

## 1. 覆盖范围

本轮新增 7 张功能状态截图，覆盖管理员用户真实创建/删除，以及 Arena 从教师发布到学生提交再到教师报告的真实链路。

有效样本：

- 管理员账号 `admin`：创建并删除临时教师账号 `audit_teacher_20260620042705`。
- 教师账号 `201300000012`：通过 UI 使用有效班级 `cmma7g0590004g9q2nl2jyzdf` 正式发布课程可见 Arena 挑战。
- 学生账号 `demo`：打开真实发布 `cmqluwvqo0001pmyf34og34jy`，进入工作台并提交官方评测。
- 数据库核对：临时 `audit_teacher_*` 账号已删除；发布 `cmqluwvqo0001pmyf34og34jy` 有 1 条 `demo` 提交，`valid: true`，`score: 0`。

## 2. 管理员创建教师账号

证据：

- `screenshots/42-function-state-flows-batch7/admin-users-create-teacher-filled-modal-desktop.png`
- `screenshots/42-function-state-flows-batch7/admin-users-create-teacher-result-desktop.png`

健康度：中等偏好。

观察：

- 管理员在新建账号弹窗中选择“教师”后，字段从“学号/班级”切换为“工号”。
- 提交后页面显示“账号已创建”，用户总数和教师数增加。
- 搜索 `audit_teacher_20260620042705` 后列表只显示新建教师账号。

问题：

- P2：成功态只显示“账号已创建”，没有说明默认密码、是否需要发送通知或下一步配置教师权限。
- P2：创建教师后仍停留在列表搜索结果，右侧详情提示没有自动选中新账号。
- P2：新建账号弹窗没有明确说明教师账号删除可能级联课堂、班级、教案和资源。

建议：

- 创建成功后提供“查看账号 / 复制初始登录信息 / 继续配置权限”。
- 教师账号创建表单应在提交前说明教师身份与后续数据所有权关系。

## 3. 管理员删除刚创建的教师账号

证据：

- `screenshots/42-function-state-flows-batch7/admin-users-delete-created-teacher-result-desktop.png`
- `function-state-flows-batch7-manifest.json` 中 `admin-users-delete-created-teacher-result-desktop.dialogs`

健康度：中等偏弱。

观察：

- 删除前触发浏览器原生 confirm：`确认删除账号 审计删除教师2705？`
- 接受后搜索结果为空，用户总数和教师数回落。
- 数据库核对未残留 `audit_teacher_*` 账号。

问题：

- P1：教师账号删除使用原生 confirm，未展示潜在影响范围。实际 API 对教师会删除其课堂、班级、非预置教案、部分资源和学生状态，但 UI 没有提示这些级联影响。
- P2：删除成功后成功提示没有在截图稳定状态中保留；用户只能通过列表为空推断删除完成。
- P2：删除后搜索框仍保留被删工号，没有“清除筛选 / 返回列表”引导。

建议：

- 删除教师账号应使用系统内确认弹窗，列出将影响的班级、课堂、教案和资源数量。
- 删除完成后保留可见成功提示，并提供“清除搜索”和“查看最近删除记录”。

## 4. 教师真实发布 Arena 挑战

证据：

- `screenshots/42-function-state-flows-batch7/teacher-arena-real-publish-result-desktop.png`

健康度：可用但需要防重。

观察：

- 教师通过 UI 选择“串联校正基础模板”、有效班级、课程可见性和未来截止时间后，页面显示“挑战已发布”。
- 发布预览和已发布挑战列表同步出现新任务。
- 真实 publicationId：`cmqluwvqo0001pmyf34og34jy`。

问题：

- P1：已发布挑战列表中两个同名、同班级、同状态任务几乎无法区分；教师无法判断哪个是刚发布的任务。
- P2：班级范围输入仍是裸 id，教师需要知道 `cmma7g0590004g9q2nl2jyzdf` 这种内部值，无法从班级名称选择。
- P2：发布成功后没有“复制学生入口 / 查看报告 / 去挑战详情”的主下一步。

建议：

- 发布列表显示发布时间、截止时间、可见性、提交数和任务中文名。
- 班级范围改为教师名下班级选择器，隐藏内部 id。
- 发布成功后把“查看报告”和“复制学生链接”提升为主操作。

## 5. 学生真实发布提交

证据：

- `screenshots/42-function-state-flows-batch7/student-real-publication-challenge-mobile.png`
- `screenshots/42-function-state-flows-batch7/student-real-publication-official-submit-mobile.png`

健康度：可用但成本高。

观察：

- 学生移动端可以打开带 publicationId 的挑战详情。
- 从挑战详情进入工作台后，可以点击“提交官方评测”并产生提交结果。
- 数据库核对该提交归属 publicationId `cmqluwvqo0001pmyf34og34jy`，提交有效，得分 0。

问题：

- P1：移动端提交入口依旧在长页面深处，真实发布链路没有改善学生的提交效率。
- P1：提交结果仍同时表达有效提交、0 分和入榜，学生难以判断是否应继续改进还是已完成任务。
- P2：挑战详情和工作台对“这是教师发布任务”的上下文表达偏弱，publicationId 对学生不可见但班级/课程发布语义也不够明确。

建议：

- 发布任务模式下，移动端顶部应固定展示“教师发布任务 / 截止时间 / 提交状态”。
- 提交结果顶部提供明确状态：已提交、得分、是否计入报告、是否需要重新提交。

## 6. 教师提交后发布报告

证据：

- `screenshots/42-function-state-flows-batch7/teacher-arena-real-publication-report-after-submit-desktop.png`

健康度：中等。

观察：

- 教师报告显示参与 `1/1`、提交次数 `1`、有效提交率 `100%`、优秀方案 `1`。
- 报告能展示薄弱指标、方法分布、个人最佳、优秀方案和课堂复盘区域。
- 未提交学生为 0，说明课程可见发布不使用班级名单作为未提交判断。

问题：

- P1：报告主标题仍是 `task-second-order-lead-pid`，教师不应以技术 id 识别任务。
- P1：平均分、个人最佳和优秀方案均显示 0，但没有解释“有效提交但得分 0”的原因和下一步教学动作。
- P2：报告页右下控灵浮层压住课堂复盘区域边缘。

建议：

- 报告标题使用任务中文名，并把 taskId 放到次级元数据。
- 对 0 分有效提交增加解释：硬约束、指标未达标、是否计入排名、建议讲评点。
- 报告应提供“导出 / 复制讲评摘要 / 返回发布列表”。

## 7. 本轮结论

- 管理员创建/删除用户的主链路可完成，但删除影响范围说明不足，尤其是教师账号级联删除。
- 教师真实 Arena 发布、学生真实提交、教师报告链路已经跑通，填补了此前“只用夹具报告”的证据缺口。
- 真实链路暴露的新核心问题不是可用性，而是任务命名、发布列表可辨识度、学生提交状态解释和教师讲评动作不足。

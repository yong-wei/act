# 功能状态流审计续篇

日期：2026-06-20
范围：登录/注册校验、课堂加入、Arena 挑战交互、教师建班、教师教案保存、教师 Arena 配置预览、管理员用户管理与系统配置。
截图证据：`screenshots/36-function-state-flows/`。
采集清单：`screenshots/function-state-flows-manifest.json`。

## 1. 覆盖范围

本轮新增 15 张功能状态截图、1 条浏览器原生 confirm 证据和 1 条自动化遮罩阻断记录。它们不替代前 8 章的页面模板覆盖，而是验证用户点击、输入、保存、弹窗、错误反馈和状态切换后的界面结果。

有效样本：

- 访客：登录错误、注册短密码。
- 学生账号 `demo`：课堂码查询失败、Arena 榜单 tab、Arena 知识卡片弹窗。
- 教师账号 `201300000012`：创建班级、保存教案、生成 Arena 发布预览。
- 管理员账号 `admin`：用户搜索、新建账号弹窗、改密弹窗、删除确认、系统配置添加模型校验。

本轮本地审计夹具：

- 通过教师 UI 创建班级 `审计功能流班级 378700`，用于观察建班成功后状态。
- 通过教师 UI 保存教案 `审计功能流教案 381469`，用于观察空环节教案保存结果。

## 2. 认证与注册

证据：

- `screenshots/36-function-state-flows/auth-login-invalid-desktop.png`
- `screenshots/36-function-state-flows/auth-login-invalid-mobile.png`
- `screenshots/36-function-state-flows/auth-register-short-password-desktop.png`

健康度：登录错误中等；注册校验阻断。

观察：

- 登录错误能在桌面和移动端显示“账号或密码错误”，用户知道当前失败原因。
- 移动端登录错误没有崩溃，表单仍可继续编辑。
- 注册页提交短密码后出现 Next.js runtime error，而不是把校验错误呈现在注册表单内。

问题：

- P0：注册短密码触发 runtime error。截图显示 `Objects are not valid as a React child (found: object with keys {formErrors, fieldErrors})`，用户从普通校验错误进入开发错误页。
  - 整改状态（2026-06-21，`audit-remediation-p0-stability`）：已修复。注册错误已规整为字符串；证据见 `../remediation/audit-remediation-p0-stability/evidence.md`。
- P2：登录错误文案可见，但没有“找回账号/联系教师/返回入口”的恢复路径。

建议：

- 注册 API 返回的 Zod error 应在 client 侧转成字符串或字段错误列表，不能直接渲染对象。
- 登录错误下方增加账号恢复或联系教师入口，避免学生反复试错。

## 3. 学生课堂加入

证据：

- `screenshots/36-function-state-flows/student-classroom-join-invalid-desktop.png`
- `screenshots/36-function-state-flows/student-classroom-join-invalid-mobile.png`

健康度：良好。

观察：

- 输入 `000000` 后查询课堂，桌面和移动端均显示“未找到该入会码对应的课堂”。
- 错误出现在输入框下方，与用户操作位置接近。
- 移动端错误卡可读，未被底部控灵覆盖。

问题：

- P2：按钮文案是“查询课堂”，在失败后没有提供“检查课堂码格式 / 切换加入班级 / 联系教师”的直接恢复动作。

建议：

- 失败态增加两个短动作：切换到班级码、查看课堂码示例。

## 4. 学生 Arena 挑战交互

证据：

- `screenshots/36-function-state-flows/student-arena-method-leaderboard-desktop.png`
- `screenshots/36-function-state-flows/student-arena-knowledge-card-open-desktop.png`

健康度：中等偏好。

观察：

- “方法榜”tab 可切换，并显示当前榜单为空的状态。
- “打开知识卡片”会弹出二阶系统标准型知识卡片，页面背景有遮罩，弹窗内容能解释定义、公式和核心直觉。

问题：

- P2：知识卡片弹窗出现后，右下控灵仍在遮罩层之上，视觉焦点被两个浮动系统竞争。
- P2：榜单为空时只说明没有有效提交，没有提示学生下一步应进入控制工作台并提交方案。

建议：

- 弹出知识卡片时暂时降低全局控灵入口层级，或把控灵入口并入当前弹窗的辅助区。
- 空榜单状态增加“进入控制工作台提交方案”的主动作。

## 5. 教师建班

证据：

- `screenshots/36-function-state-flows/teacher-create-class-success-desktop.png`

健康度：中等偏好。

观察：

- 教师填写班级名称、描述、学年和学期后能成功创建班级，并进入班级详情页。
- 成功页展示班级加入码、开始上课、班级诊断、课堂历史、学生清单和空学生状态。

问题：

- P2：刚创建的空班级显示大量治理指标和限制标签，教师的第一任务其实是复制班级码或添加学生。
- P2：班级创建成功没有明确 toast 或成功标题，用户只能通过进入详情页推断已经完成。

建议：

- 建班成功后的首屏应把“复制班级码 / 添加学生 / 开始上课”放在主流程位置。
- 空班级治理卡应降级为后续模块，不要抢占建班后的第一步。

## 6. 教师教案保存

证据：

- `screenshots/36-function-state-flows/teacher-lesson-plan-save-no-resource-desktop.png`

健康度：偏弱。

观察：

- 在新建教案页只填写标题、未显式选择资源或环节时，点击“保存教案”后进入教案列表。
- 列表中出现 `0 个环节` 的新教案。

问题：

- P1：空环节教案可以保存。教师可能误以为教案已可用于课堂，但后续“开始上课”缺少实际教学内容。
- P2：保存后没有提示“该教案为空”，列表也没有把 0 环节教案作为需要补全的草稿状态突出显示。

建议：

- 保存前要求至少 1 个环节，或把 0 环节教案明确标为草稿并阻止“开始上课”。
- 保存成功后提供“继续添加环节 / 返回列表”的下一步选择。

## 7. 教师 Arena 配置预览

证据：

- `screenshots/36-function-state-flows/teacher-arena-preview-generated-desktop.png`

健康度：偏弱。

观察：

- 点击“生成发布预览”后，右侧发布预览可以生成结构化任务、可见性、截止时间、作业绑定和评分权重。
- 页面底部出现 `Class not found`。

问题：

- P1：默认班级范围 `class-2026-control` 不存在，生成预览后暴露 `Class not found`。教师还未正式发布，就已经进入数据不一致状态。
- P2：预览区展示的是大量技术 id，如 `task-integrator-low-frequency-balance`、`class-2026-control`，教师阅读成本高。

建议：

- 默认班级应来自当前教师真实班级列表，而不是静态占位。
- 预览区用班级名称和任务中文名做主信息，技术 id 放到次级证据行。

## 8. 管理员用户管理

证据：

- `screenshots/36-function-state-flows/admin-users-search-demo-desktop.png`
- `screenshots/36-function-state-flows/admin-users-create-modal-desktop.png`
- `screenshots/36-function-state-flows/admin-users-password-modal-desktop.png`
- `screenshots/36-function-state-flows/admin-users-delete-confirm-desktop.png`
- `function-state-flows-manifest.json` 中 `admin-users-delete-confirm-desktop.dialog`

健康度：中等。

观察：

- 搜索 `demo` 后能筛到目标账号。
- 新建账号弹窗、改密弹窗均可打开。
- 删除动作触发浏览器原生 confirm：`确认删除账号 demo？`，脚本已 dismiss，未执行删除。

问题：

- P1：新建账号弹窗打开后，`Esc` 未关闭弹窗，遮罩继续拦截后续按钮操作；这会影响键盘用户和连续批量管理。
- P2：新建账号弹窗背景被洗得过淡，页面整体对比度下降，字段标签可读但周边内容失去上下文。
- P2：删除确认使用浏览器原生 confirm，无法承载更清晰的风险说明、影响范围和撤销信息，也无法与后台视觉系统保持一致。

建议：

- 所有后台弹窗支持 `Esc` 关闭、关闭按钮、取消按钮和焦点回到触发器。
- 删除确认改为系统内确认弹窗，显示账号、角色、影响范围和不可恢复说明。

## 9. 管理员系统配置

证据：

- `screenshots/36-function-state-flows/admin-config-add-model-empty-desktop.png`

健康度：良好。

观察：

- 在模型显示名、模型 ID 等为空时点击“添加模型”，页面顶部显示“模型 ID 不能为空”。
- 错误状态没有崩溃，也没有提交空模型。

问题：

- P2：错误提示在页面顶部，离“添加模型”输入区较远；长页面里用户需要回看才能关联哪个字段出错。

建议：

- 在模型 ID 输入框旁同步显示字段级错误，同时保留顶部全局错误。

## 10. 本轮结论

- 页面模板覆盖之后，功能状态审计已经开始暴露更高优先级问题；其中注册校验崩溃和空教案可保存属于真实流程风险。
- 功能状态仍未完全覆盖：批量导入文件上传、真实 Arena 正式发布与学生提交、AI provider 测试、配置保存、学生控制工作台提交、课堂开始/结束和移动端后台弹窗仍需继续审计。

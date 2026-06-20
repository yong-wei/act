# 功能状态流审计续篇（十六）

日期：2026-06-20
范围：课程入口课堂码校验、学生课程运行态动作、讲义导出、教师班级/课堂历史/进行中课堂、管理员用户模态、批量导入、数据治理和后台总览。
截图证据：`screenshots/51-function-state-flows-batch16/`。
采集清单：`screenshots/function-state-flows-batch16-manifest.json`。
结构证据：同目录 `.a11y.json` 文件，包含 DOM focusable、live region、按钮、SVG/canvas 命名、表单、文件上传控件和当前焦点记录。本轮继续使用 DOM 级结构审计。

## 1. 覆盖范围

本轮新增 17 张截图和 17 份结构化 DOM/a11y 记录：

- 学生课程入口短课堂码错误态。
- 学生课程入口 6 位无效课堂码错误态。
- 学生 1-1 demo 运行态主操作后状态。
- 课程入口讲义导出动作尝试。
- 教师班级详情加入码区域和课堂码重置能力可见性。
- 教师班级分析移动端导出/报告入口清点。
- 教师课堂历史进入课堂统计后的阻断页。
- 教师进行中课堂投影移动态。
- 管理员新建账号模态 Tab 焦点路径和 Escape 状态。
- 管理员批量导入 file chooser 与隐藏 file input 语义。
- 管理员数据治理加载态、完成态和刷新状态。
- 管理员后台总览桌面操作密度。

## 2. 课程入口课堂码：有错误文案，但状态区分和播报不足

证据：

- `screenshots/51-function-state-flows-batch16/01-course-entry-short-classroom-code-mobile.png`
- `screenshots/51-function-state-flows-batch16/02-course-entry-invalid-classroom-code-mobile.png`
- 对应 `.a11y.json`

健康度：可阻断错误输入，但解释和可访问性不足。

观察：

- 课程入口页的课堂码输入区位于“学生入口”卡片内。
- 输入 `123` 后点击“加入课堂”，字段下方出现红色错误“请输入 6 位课堂码。”。
- 输入 `123456` 后点击“加入课堂”，截图仍显示同一句“请输入 6 位课堂码。”。
- 两个状态的 DOM 结构均没有 `role="alert"`、`role="status"` 或 `aria-live`。

问题：

- P1：短码和 6 位无效码显示同一错误，用户无法区分“格式不足”和“课堂不存在/无效”。
- P1：错误文本没有 live/status 语义，读屏用户提交后不一定知道字段状态改变。
- P2：错误出现后焦点仍停在“加入课堂”按钮，未回到错误字段或错误摘要。

建议：

- 格式错误使用“请输入 6 位课堂码”，接口无效使用“未找到该课堂码，请确认教师提供的最新课堂码”。
- 错误区加 `role="alert"` 或 `aria-live="polite"`，提交失败后把焦点移回课堂码输入框。
- 对学生入口补“课堂码来自教师课堂等待页/投影页”的短说明，减少错误恢复成本。

## 3. 学生课程运行态和讲义导出：路径可见，但完成反馈不足

证据：

- `screenshots/51-function-state-flows-batch16/03-student-course-demo-after-primary-action-mobile.png`
- `screenshots/51-function-state-flows-batch16/04-course-entry-handout-export-action-mobile.png`
- `screenshots/51-function-state-flows-batch16/17-teacher-active-session-runtime-mobile.png`
- 对应 `.a11y.json`

健康度：主要路径可执行，移动端局部反馈仍弱。

观察：

- 1-1 学生 demo 点击主操作后仍显示“下一页”，当前步骤和课程内容可见。
- 讲义区域提供“在线阅读讲义”和“下载 PDF 讲义”，点击后本轮没有观察到 Playwright download 事件。
- 进行中教师投影页会重定向到具体课程 teacher runtime，并显示课堂码、页码、上一页/下一页和本页工具。
- 教师投影移动端截图中，全局控灵浮层覆盖课程情境图左下区域。

问题：

- P1：课程运行态主操作后没有明确的完成/切页结果播报，移动端只能从页码或按钮位置推断状态。
- P2：讲义导出动作没有明显下载开始/失败/完成反馈，本轮没有捕获到浏览器下载事件。
- P2：教师投影移动端的全局浮层仍可能遮挡教学图像。

建议：

- 翻页、提交、导出等状态变化使用 `role="status"` 短文本播报。
- 讲义导出需要显示“正在生成 PDF / 下载已开始 / 失败重试”三种状态。
- 教师投影页把控灵浮层避让纳入课程图像可视区域合同。

## 4. 教师班级、历史与报告：数据充分，但移动端恢复路径不足

证据：

- `screenshots/51-function-state-flows-batch16/05-teacher-class-code-copy-mobile.png`
- `screenshots/51-function-state-flows-batch16/06-teacher-class-code-reset-native-dialog-mobile.png`
- `screenshots/51-function-state-flows-batch16/07-teacher-class-analytics-export-inventory-mobile.png`
- `screenshots/51-function-state-flows-batch16/08-teacher-history-report-action-mobile.png`
- `screenshots/51-function-state-flows-batch16/16-teacher-history-class-statistics-mobile.png`
- 对应 `.a11y.json`

健康度：信息完整，但教师关键动作不够明确。

观察：

- 班级详情移动端显示班级加入码 `ZXVBP6`、开始上课、班级学情概览、课堂历史和 143 名学生。
- 当前班级没有进行中课堂，因此源码中的“重新生成课堂码”按钮不会出现；本轮截图确认长期班级加入码区域没有“复制加入码/复制链接/重新生成”的明确按钮。
- 班级分析移动页继续展示大量能力矩阵、重点学生和图表，结构抽查记录大量图形元素。
- 教师历史页包含 59 节课，点击第一条“课堂统计”进入“课堂记录详情”，但该记录未绑定班级，只显示“无法展示课后分析信息”。

问题：

- P1：班级加入码是邀请学生的核心信息，但移动端没有显式复制、分享、重置或成功反馈。
- P1：课堂历史第一条统计入口可进入阻断页，但阻断页没有返回历史、绑定班级、编辑课堂或修复归档的动作。
- P1：班级分析和历史长列表仍以桌面表格/长页为主，移动端信息扫描成本高。
- P2：课堂码重置能力只出现在 active session 区域，普通班级加入码和课堂码的差异没有解释。

建议：

- 班级加入码区域补复制加入码、复制邀请链接、重新生成加入码和状态提示。
- 历史阻断页补“返回课堂历史 / 绑定班级 / 编辑归档信息”按钮。
- 教师移动端长表格改为摘要卡片和分组 drill-down，图表提供文本摘要。

## 5. 管理员：治理看板有真实数据，表格和批量操作仍需治理

证据：

- `screenshots/51-function-state-flows-batch16/09-admin-new-account-focus-sequence-mobile.png`
- `screenshots/51-function-state-flows-batch16/10-admin-new-account-escape-state-mobile.png`
- `screenshots/51-function-state-flows-batch16/11-admin-batch-import-filechooser-mobile.png`
- `screenshots/51-function-state-flows-batch16/12-admin-data-governance-action-mobile.png`
- `screenshots/51-function-state-flows-batch16/13-admin-overview-action-density-desktop.png`
- `screenshots/51-function-state-flows-batch16/14-admin-data-governance-loaded-or-blocked-mobile.png`
- `screenshots/51-function-state-flows-batch16/15-admin-data-governance-refresh-action-mobile.png`
- 对应 `.a11y.json`

健康度：后台主路径完整，风险操作和移动表格仍不足。

观察：

- 新建账号模态打开后，连续 Tab 依次进入下载模板、批量导入、系统配置、搜索框、角色筛选、背景列表查看/改密/删除等控件。
- Escape 后仍停留在用户管理页背景焦点状态，未形成可验证的模态关闭/焦点恢复。
- 批量导入触发原生 file chooser；隐藏 file input 的 `accept` 是 `.xlsx`，`aria-label` 仍是“搜索管理员功能”。
- 数据治理看板加载完成后展示系统状态、数据新鲜度、学习事实、待处理风险、课堂质量、队列健康、事实类型、风险清单和快照明细。
- 数据治理风险表在 390px 宽度下出现列压缩，学生、风险类型和说明被拆成竖排。
- 点击“刷新状态”后页面保留原状态，但没有明显的刷新中或刷新完成反馈。

问题：

- P1：新建账号模态仍没有焦点陷阱，背景敏感操作会进入 Tab 序列。
- P1：批量导入隐藏文件控件的可访问名称错误，仍显示“搜索管理员功能”。
- P1：数据治理风险表移动端不可读，关键风险说明被表格列压缩拆散。
- P1：刷新状态缺少明确的进行中/完成态，管理员难以判断数据是否已重新拉取。
- P2：后台总览给出治理、账号、配置和使用态势入口，但告警范围与优先级仍需要更强的下一步排序。

建议：

- 账号模态打开时背景设为 inert，Tab 序列只允许进入模态内部字段和关闭按钮。
- 批量导入前增加确认面板，并把 file input 命名为“上传用户导入 Excel 文件”。
- 数据治理移动端风险清单改为卡片：姓名、风险级别、触发时间、说明、处理动作分行呈现。
- 刷新状态显示时间戳变化、加载状态和失败重试说明。

## 6. 可访问性结论

本批继续确认：功能路径大多可见，但状态变化播报不完整。

- 课程入口错误态没有 `aria-live`/`role=alert`。
- 学生运行态主操作、讲义导出和数据治理刷新没有 status 语义。
- 管理员模态焦点陷阱不成立，背景操作可进入键盘序列。
- 批量导入隐藏 file input 可访问名称错误。
- 教师和管理员长表格在移动端缺少表格替代摘要。

下一批建议继续覆盖：

- 真实学生加入课堂成功/失败后的返回路径。
- 教师开课后从等待页进入投影再结束课堂的完整移动路径。
- 管理员批量导入选择真实文件后的预检、成功、失败行导出和撤销状态。
- 更多图表和表格的读屏等价文本。

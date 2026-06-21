# 功能状态流续篇（四十六）

日期：2026-06-21
基线：`dev1` 对齐 `origin/integration`，本地服务 `http://localhost:3100`
范围：跨角色表单校验、批量/下载入口、破坏性动作、系统配置保存、数据治理加载与移动端治理状态。

## 1. 证据清单

- 截图目录：`../screenshots/81-function-state-flows-batch46/`
- Manifest：`../screenshots/function-state-flows-batch46-manifest.json`
- 采集脚本：`../scripts/capture-batch46.mjs`
- 结果：23 张 PNG、23 个 DOM/a11y JSON、9 个路由响应、3 个 API 检查、21 个登录/可选动作、1 个真实下载事件、0 个脚本错误、0 个忽略错误。

本批覆盖学生课堂码加入、教师真实班级成员管理、管理员用户创建/模板/导入、管理员配置保存/模型测试、数据治理桌面/移动加载与标签状态。脚本只执行可逆动作：空提交、下载模板、打开导入入口、触发但不确认删除；未触发的 file chooser/confirm 被记录为产品动作状态，不计为脚本错误。

## 2. 路由、动作与 API 结果

| 类型 | 代表路径/动作 | 结果 | 关键观察 |
|---|---|---:|---|
| 课堂码加入 | `/classroom/join` 空提交、`123`、`999999` | 200 | 页面保持默认文案，DOM 中无错误文本、无 alert/live。 |
| 教师真实班级 | `/teacher/classes/cmma7g0590004g9q2nl2jyzdf` | 200 | 班级有 143 名学生和治理数据；默认页没有明显可触达的添加/导入/移除闭环。 |
| 教师成员导入 | 触发“导入/Excel/批量” | clicked-no-filechooser | 点击后没有 file chooser；页面只留下班级长页。 |
| 教师移除确认 | 触发“移除/删除” | not-found | 真实成员长页中未找到稳定移除入口。 |
| 管理员新建账号 | `/admin/users` 新建账号、空提交 | 200 | 新建账号没有 dialog 语义；空提交后页面显示 `[object Object]`。 |
| 管理员模板下载 | `/admin/users` 下载模板 | download | 真实下载 `users-template.xlsx`，页面没有下载完成状态。 |
| 管理员批量导入 | `/admin/users` 批量导入 | clicked-no-filechooser | 点击后没有 file chooser 事件，也没有预览、失败行导出、通知或撤销状态。 |
| 系统配置保存 | `/admin/config` 保存配置 | 200 | 页面显示“配置已保存”，但没有影响范围、diff 或审计记录。 |
| 模型测试入口 | `/admin/config` 测试模型 | not-found | 页面有模型卡的“测试”字样，但脚本未找到稳定“测试模型/测试连接”入口。 |
| 数据治理桌面 | `/admin/data-governance` | 200 | 9 秒后仍显示“正在加载数据治理看板…”。 |
| 数据治理移动 | `/admin/data-governance` mobile | 200 | 能显示真实治理数据，但 390px viewport 导出为 568px 宽。 |
| API | `/api/admin/users/template`、`/api/admin/data-governance/status` | 200 | API 能返回模板和治理状态，说明桌面加载态不是后端完全不可用。 |

## 3. 学生课堂码校验状态

| 步骤 | 路径 | 证据 | 关键观察 |
|---:|---|---|---|
| 1 | `/classroom/join` 默认 | `01-student-classroom-join-default.png` | 页面有“加入课堂/加入班级”切换、课堂码输入和“查询课堂”。 |
| 2 | 空提交 | `02-student-classroom-join-empty-submit.png` | 点击查询后画面没有变化，没有“请输入课堂码”或状态播报。 |
| 3 | 短码 `123` | `03-student-classroom-join-short-code.png` | 可填入短码，但提交后没有可见错误或格式反馈。 |
| 4 | 无效六位码 `999999` | `04-student-classroom-join-invalid-six-digit.png` | 可填入六位码，但提交后仍无错误反馈、重试说明或帮助路径。 |

课堂码页的输入控件存在，但三个失败分支都没有可见错误、`role=alert` 或 `aria-live`。这会让学生无法判断是格式不对、课堂不存在、网络失败，还是点击没有生效。

## 4. 教师班级成员动作状态

| 步骤 | 路径 | 证据 | 关键观察 |
|---:|---|---|---|
| 5 | 真实班级详情 | `05-teacher-class-members-default.png` | 2024 自动化班显示 143 名学生、治理覆盖、班级加入码、风险和诊断数据。 |
| 6 | 添加学生尝试 | `06-teacher-add-student-dialog.png` | 触发“添加学生/新增学生/邀请学生”后没有出现 dialog 语义，页面仍是长班级详情。 |
| 7 | 添加学生搜索尝试 | `07-teacher-add-student-no-match.png` | 搜索动作填到了“搜索教案...”字段，说明当前焦点/输入目标与班级成员任务错位。 |
| 8 | Escape 后 | `08-teacher-after-add-student-escape.png` | Escape 后没有明确焦点恢复或成员操作区域状态。 |
| 9 | 学生导入入口 | `09-teacher-class-student-import-entry.png` | 点击“导入/Excel/批量”没有 file chooser 事件。 |
| 10 | 移除确认尝试 | `10-teacher-class-student-remove-confirm-dismissed.png` | 未找到稳定“移除/删除”入口，也没有确认状态。 |

真实班级详情能展示成员治理数据，但成员维护动作不够可发现；添加、导入、移除都无法从默认长页形成稳定可验证的操作状态。

## 5. 管理员用户与配置动作状态

| 步骤 | 路径 | 证据 | 关键观察 |
|---:|---|---|---|
| 11 | `/admin/users` 默认 | `11-admin-users-action-area-default.png` | 操作区有新建账号、下载模板、批量导入和打开系统配置。 |
| 12 | 新建账号尝试 | `12-admin-create-account-modal.png` | 点击新建账号后未检测到 `role=dialog` 或 `aria-modal`，可见内容仍与列表混在一起。 |
| 13 | 新建账号空提交 | `13-admin-create-account-empty-validation.png` | 页面出现 `[object Object]`，说明校验错误对象直接渲染到用户界面。 |
| 14 | 模板下载 | `14-admin-users-template-download-state.png` | 下载事件触发 `users-template.xlsx`，但页面没有下载完成、下一步导入或模板版本提示。 |
| 15 | 批量导入入口 | `15-admin-users-import-entry.png` | 点击批量导入没有 file chooser 事件，也没有预览/失败行导出/撤销/批次审计状态。 |
| 16 | `/admin/config` 默认 | `16-admin-config-default.png` | 配置页显示基础设置、AI 供应商、模型目录和保存/重置入口。 |
| 17 | 保存配置 | `17-admin-config-after-save-attempt.png` | 出现“配置已保存”，但未展示 diff、影响范围、回滚或审计记录。 |
| 18 | 模型测试尝试 | `18-admin-config-after-model-test.png` | 未找到稳定的“测试模型/测试连接”入口；保存成功文案仍是主要状态。 |
| 22 | 移动配置页 | `22-mobile-admin-config-default.png` | 移动页高 3903px，保存/重置/供应商/模型操作分散在长页中。 |

管理员用户页的模板下载 API 和浏览器下载均可用，但下载完成状态与批量导入下一步没有接上。新建账号空提交暴露 `[object Object]` 是本批最明确的表单校验缺陷。

## 6. 数据治理加载与移动状态

| 步骤 | 路径 | 证据 | 关键观察 |
|---:|---|---|---|
| 19 | 桌面数据治理默认 | `19-admin-data-governance-default.png` | 9 秒后仍显示“正在加载数据治理看板…”。 |
| 20 | 桌面刷新尝试 | `20-admin-data-governance-after-refresh.png` | 刷新入口未出现，页面仍停留在加载态。 |
| 21 | 桌面标签尝试 | `21-admin-data-governance-after-tab-switch.png` | 标签动作无法稳定触发，仍是加载态。 |
| 23 | 移动数据治理 | `23-mobile-admin-data-governance-default.png` | 移动端能显示真实系统状态、3336 分钟 stale、170 个风险和风险清单，但截图宽 568px。 |

同一批次中 `/api/admin/data-governance/status` 返回 200，移动页面也能显示真实治理数据；桌面页面长时间停留加载态，说明桌面治理看板存在前端状态、viewport 或水合路径问题。移动端虽然能加载，但出现横向溢出。

## 7. 主要问题

### 287. P1：课堂码失败分支没有任何可见错误

空提交、短码 `123`、无效六位码 `999999` 三种状态都停在默认课堂码页面，DOM 中无错误文本、无 alert/live、无重试或帮助路径。学生无法判断失败原因。

建议：把空值、格式错误、课堂不存在和网络失败拆成明确状态，并提供 `role=alert`、可清除输入和联系教师/返回课程入口。

### 288. P1：管理员新建账号空提交渲染 `[object Object]`

点击新建账号后空提交，页面显示 `[object Object]`，说明表单错误对象被直接渲染到界面。管理员无法理解哪些字段缺失，也会怀疑系统异常。

建议：统一表单错误格式，把字段错误映射到对应输入和顶部错误摘要，禁止对象直接作为 React child 或文本渲染。

### 289. P1：桌面数据治理看板 9 秒仍停留加载态

桌面 `/admin/data-governance` 默认、刷新尝试和标签尝试均显示“正在加载数据治理看板…”。同批 API 返回 200，移动端也能展示真实治理数据，说明不是后端完全不可用。

建议：定位桌面治理看板的水合、viewport 分支或客户端请求状态；加载超过阈值时显示可重试错误，并保留最近快照。

### 290. P2：教师班级成员维护动作不可发现或不稳定

真实 143 人班级详情中，添加学生尝试没有打开 dialog，成员搜索目标落到“搜索教案...”，导入点击没有 file chooser，移除/删除入口未找到。教师难以从班级详情完成成员治理。

建议：在学生清单区域固定展示添加、导入、搜索、批量选择和移除动作，并为弹窗提供 `role=dialog`、焦点陷阱和状态反馈。

### 291. P2：管理员新建账号缺少 dialog 语义

点击新建账号后未检测到 `role=dialog` 或 `aria-modal`，可见内容仍与背景用户列表混在一起。键盘和读屏用户无法明确进入一个独立创建流程。

建议：新建账号改为标准 dialog 或独立页面；dialog 打开时隔离背景焦点，Escape/关闭后恢复触发按钮焦点。

### 292. P2：模板下载成功但缺少完成状态和下一步

`users-template.xlsx` 真实下载成功，页面却没有下载完成提示、模板版本、下一步导入或批次流程说明。用户只能依赖浏览器下载栏。

建议：下载后显示非阻塞状态条，提供“打开批量导入”“查看字段说明”“下载失败重试”等后续动作。

### 293. P2：管理员批量导入入口点击后没有 file chooser 或预览状态

点击批量导入没有 file chooser 事件，也没有可见导入面板、预览、失败行导出、通知、撤销或批次审计入口。批量导入仍不是可解释状态机。

建议：把导入入口改为明确按钮 + 文件选择 + 预览 + 结果 + 审计四段状态，不要依赖隐藏 input 或不可见触发。

### 294. P2：系统配置保存缺少影响范围和审计反馈

保存后只显示“配置已保存”，没有展示本次 diff、影响的 AI route/供应商/模型、回滚方式或审计记录。配置属于高风险后台动作，当前反馈过弱。

建议：保存前展示 diff 和影响范围，保存后展示版本号、操作者、时间、可回滚入口和相关服务健康状态。

### 295. P2：模型测试入口命名和可达性不稳定

配置页可见模型卡片和“测试”字样，但脚本无法通过“测试模型/测试连接/模型测试”稳定定位入口。管理员难以确认测试动作属于哪个模型或当前供应商。

建议：每个模型测试按钮使用明确名称，例如“测试 Qwen3.6 35B A3B”，并把测试中、成功、失败、超时状态放到同一卡片。

### 296. P2：移动数据治理页横向溢出

移动 `/admin/data-governance` 在 390px viewport 下导出为 568px 宽。虽然移动端能展示真实治理数据，但表格或风险清单仍撑宽页面。

建议：移动端治理风险清单改为卡片或列折叠，保留风险、学生、时间、处置动作的纵向优先级。

### 297. P2：本批 23 个动作状态仍全部缺少 alert/live

本批 23 个 DOM/a11y JSON 的 `alerts=0`。课堂码错误、账号校验、模板下载、配置保存、治理加载、移动风险状态都没有可访问状态播报。

建议：把表单校验、下载完成、导入入口、配置保存、加载超时、标签切换和风险状态纳入统一 `aria-live`/`role=status` 合同。

## 8. 后续审计输入

- 课堂码加入修复后，应回归空值、短码、无效码、过期码、已结束课堂码和真实课堂码。
- 管理员用户页修复后，应复核新建账号字段校验、dialog 焦点、模板下载、导入预览、失败行导出、撤销和批次审计。
- 数据治理桌面加载修复后，应复核刷新、标签切换、风险处置、导出和移动端横向宽度。

## #614 管理员治理整改记录（2026-06-21）

整改变更：`audit-remediation-admin-governance-workflows`。证据：`../remediation/audit-remediation-admin-governance-workflows/evidence.md`。

- 288 部分关闭：本变更未重写账号创建表单的全部错误文案，但补齐用户导入批次、失败行下载、审计记录和账号导出状态。
- 289 已关闭：治理页保留加载/失败态，同时为风险对象动作增加缺失 risk 恢复状态，避免处置深链落回无解释长看板。

## #617 移动与可访问性整改记录（2026-06-21）

整改变更：`audit-remediation-mobile-a11y-shell`。证据：`../remediation/audit-remediation-mobile-a11y-shell/evidence.md`。

- 296 已关闭：数据治理来源、课堂质量和风险表格在移动端改为卡片化行，并通过 320px/390px 宽度验收。
- 297 部分关闭：管理员新建账号/改密弹窗补 `dialog` 语义，治理页与用户列表补 `status/live`；课堂码、配置保存等业务状态仍由对应变更关闭。

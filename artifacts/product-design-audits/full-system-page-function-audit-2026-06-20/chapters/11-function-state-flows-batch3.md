# 功能状态流审计续篇（三）

日期：2026-06-20
范围：Arena 挑战进入控制工作台、Arena 工作台深链参数、管理员批量导入错误反馈。
截图证据：`screenshots/38-function-state-flows-batch3/`。
采集清单：`screenshots/function-state-flows-batch3-manifest.json`。

## 1. 覆盖范围

本轮新增 3 张功能状态截图，覆盖学生 Arena 到控制工作台的正式挑战路径，以及管理员批量导入的无效文件反馈。

有效样本：

- 学生账号 `demo`：从 `/arena/challenges/task-second-order-lead-pid` 点击“进入控制工作台”；直接访问工作台并传入非规范 Arena 查询参数。
- 管理员账号 `admin`：向批量导入 input 注入无效 CSV 文件，观察错误反馈。

## 2. Arena 挑战进入控制工作台

证据：

- `screenshots/38-function-state-flows-batch3/arena-challenge-enter-workbench-result-desktop.png`

健康度：良好。

观察：

- 从挑战详情页点击“进入控制工作台”后，最终 URL 为 `/interactive-learning/control-workbench?preset=multi-representation-linkage&arenaTask=task-second-order-lead-pid`。
- 工作台顶部显示“二阶对象快速稳定挑战”和“挑战模式 · 综合仿真工作台”。
- 页面明确显示“官方评价 · 该体验连接官方评价或提交流程”，并提供“竞技场官方提交”区块。
- 当前指标区能显示调节时间、超调量、稳态误差、ITAE 的当前值、目标和不可接受阈值。
- “提交官方评测”按钮可见，任务流程中“官方提交”标记为可进入。

问题：

- P2：当前默认方案有多项未达标，但“提交官方评测”仍是主按钮；如果允许提交未达标方案，应在按钮附近说明“可提交但可能不进入排名”。
- P2：ITAE 显示“待计算”，但用户无法判断是尚未运行、公式暂不支持，还是当前数据不足。

建议：

- 官方提交按钮旁增加硬约束/指标摘要，例如“2 项未达标，提交后可能得分较低”。
- 对 `待计算` 指标增加短说明和重新计算入口。

## 3. Arena 工作台深链参数

证据：

- `screenshots/38-function-state-flows-batch3/arena-workbench-query-context-desktop.png`

健康度：偏弱。

观察：

- 直接访问 `/interactive-learning/control-workbench?source=arena&taskId=task-second-order-lead-pid` 后，页面仍显示“自由探索模式 · 自由探索”。
- 证据状态显示“自由探索模式不进入官方评价和榜单”。
- 任务流程中“官方提交”是待解锁，而不是正式挑战模式。

问题：

- P1：非规范 Arena 查询参数会静默降级为自由探索。若外部链接、旧链接或 AI 工具使用 `source=arena&taskId=...`，学生会以为进入了挑战任务，实际结果不进入官方评价。
- P2：页面没有提示“当前参数未识别，已进入自由探索模式”。

建议：

- 工作台应兼容 `taskId` 或显式提示只支持 `arenaTask`。
- 发现疑似 Arena 参数但无法解析时，不应静默进入自由探索；应显示可恢复动作“返回挑战详情”或“使用正式挑战入口打开”。

## 4. 管理员批量导入无效文件

证据：

- `screenshots/38-function-state-flows-batch3/admin-users-batch-import-invalid-csv-desktop.png`

健康度：中等偏好。

观察：

- 向批量导入文件 input 注入无效 CSV 后，页面显示“无法解析 Excel 文件，请使用官方模板重新填写”。
- 错误显示在账号视图上方，未破坏账号列表、分页、风险提示和账号详情区。
- 未发现无效文件写入用户列表。

问题：

- P2：错误文案固定为 Excel 文件，但入口文案是“批量导入”，用户可能不知道是否只支持 xlsx，还是 csv 模板也可用。
- P2：错误没有提供“下载官方模板”的就近动作，虽然页面左侧已有下载模板按钮。
- P2：隐藏 file input 的 `aria-label` 在 DOM 盘点中显示为“搜索管理员功能”，与文件上传语义不一致。

建议：

- 上传控件应明确接受格式，例如“批量导入 Excel 模板”。
- 错误提示旁增加“下载官方模板”按钮。
- file input 使用准确可访问名称，例如“上传用户导入模板文件”。

## 5. 本轮结论

- Arena 正式 CTA 主路径能正确进入挑战模式，不能把所有工作台入口都判为缺失。
- 工作台深链兼容性仍有风险：非规范 Arena 参数会静默丢失官方评价上下文。
- 管理员批量导入有基本错误反馈，但格式说明、模板恢复动作和上传控件可访问名称仍需补强。

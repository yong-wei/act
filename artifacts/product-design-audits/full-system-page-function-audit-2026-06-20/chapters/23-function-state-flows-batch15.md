# 功能状态流审计续篇（十五）

日期：2026-06-20
范围：真实完成态、任务工作区局部工具、教师班级/资源操作态、管理员批量导入、模态键盘和配置保存/校验状态。
截图证据：`screenshots/50-function-state-flows-batch15/`。
采集清单：`screenshots/function-state-flows-batch15-manifest.json`。
结构证据：同目录 `.a11y.json` 文件，包含 DOM focusable、live region、SVG/canvas 命名、表单、表格和 fixed/sticky 浮层记录。本轮继续使用 DOM 级结构审计。

## 1. 覆盖范围

本轮新增 11 张截图和 11 份结构化 DOM/a11y 记录：

- 学生自适应练习未展开态。
- 学生自适应练习展开、选择答案并提交后的结果态。
- 学生控制工作台移动端支持工具尝试。
- 学生控制工作台移动端官方评测提交结果。
- 教师班级详情移动端加入码区域。
- 教师班级详情移动端教案搜索尝试。
- 教师资源管理移动端空搜索。
- 管理员用户移动端新建账号模态与 Tab 焦点路径。
- 管理员用户移动端批量导入原生文件选择器状态。
- 管理员系统配置移动端保存状态。
- 管理员系统配置移动端添加模型校验状态。

## 2. 自适应练习：可以提交，但完成态仍不够明确

证据：

- `screenshots/50-function-state-flows-batch15/01-student-adaptive-practice-collapsed-mobile.png`
- `screenshots/50-function-state-flows-batch15/11-student-adaptive-expanded-submit-result-mobile.png`
- 对应 `.a11y.json`

健康度：可执行，但完成态解释偏弱。

观察：

- 未展开态只显示“展开练习题”，脚本无法直接选择答案。
- 展开后可以选择选项并点击“提交答案”。
- 提交后页面出现“需要复盘”，并说明“该选项与题干的跨域映射不一致，请结合极点位置、裕度和时域指标综合判断”。
- 提交后仍保留“提交答案”和“换一题”按钮。
- 结构抽查仍记录 `liveRegions: 0`，提交结果不会主动播报。

问题：

- P1：完成态没有明确的“已提交/已记录/下一步”结构，学生只能从“需要复盘”推断提交完成。
- P2：提交后按钮状态没有变化，用户可能重复提交同一答案。
- P2：结果反馈没有 live/status 语义。
- P2：底部控灵浮层靠近提交与换题区域，移动端容易误触。

建议：

- 提交后将按钮改为“已提交，重新作答”或“继续下一题”，并给出路径证据是否已更新。
- 结果区使用 `role="status"` 或 `aria-live="polite"`，提交后把焦点移到结果摘要。
- 练习区底部加入 floating dock safe area。

## 3. 控制工作台：提交结果可见，支持工具和图表语义仍弱

证据：

- `screenshots/50-function-state-flows-batch15/02-student-workbench-mobile-support-drawer.png`
- `screenshots/50-function-state-flows-batch15/03-student-workbench-mobile-submit-empty.png`
- 对应 `.a11y.json`

健康度：任务可执行，移动解释与读屏语义不足。

观察：

- 点击支持/工具类入口后打开控灵面板，页面仍显示控制工作台主内容。
- 点击“提交官方评测”后出现“官方评测结果”和“返回挑战详情 / 查看榜单 / 提交官方评测”。
- 移动端全页包含大量指标卡、时域响应、Bode、根轨迹和 Nyquist 图。
- 提交结果态结构抽查记录 31 个未命名 SVG/canvas，`liveRegions: 0`。

问题：

- P1：提交结果可见，但状态变化没有 live/status 语义。
- P1：控制图表是任务核心证据，仍缺少可读摘要。
- P2：控灵支持工具打开后与主任务区域同时存在，移动端焦点顺序和任务优先级不清。
- P2：提交后仍可继续点击“提交官方评测”，缺少重复提交规则提示。

建议：

- 官方评测结果区增加短摘要：是否进入排名、硬约束结果、下一步改进。
- 为四类图表提供数据摘要和关键指标表。
- 控灵面板打开时应明确它是辅助工具，不应抢占任务提交结果焦点。

## 4. 教师班级与资源：空态存在，但移动操作反馈不足

证据：

- `screenshots/50-function-state-flows-batch15/04-teacher-class-detail-mobile-join-code-action.png`
- `screenshots/50-function-state-flows-batch15/05-teacher-class-detail-mobile-lesson-search-empty.png`
- `screenshots/50-function-state-flows-batch15/06-teacher-resources-mobile-search-empty.png`
- 对应 `.a11y.json`

健康度：核心信息可见，操作反馈不完整。

观察：

- 班级详情移动端显示班级加入码 `ZXVBP6`、开始上课、班级学情总览、课堂历史、学生清单。
- 点击加入码相关文本后没有可见复制成功、重置确认或帮助提示。
- 班级详情包含 143 名学生的大表格，结构抽查记录 60 个未命名 SVG/canvas，`liveRegions: 0`。
- 教师资源页搜索 `zzzz-no-resource` 后显示“没有找到匹配的互动组件”。
- 资源页空态有明确图标与文案，但控灵浮层压近类别筛选区域。

问题：

- P1：班级加入码是教师邀请学生的关键操作，但移动端缺少明确“复制加入码/复制链接/重新生成”的可见反馈。
- P1：班级详情学生表格在移动端过长，删除/详情等敏感操作靠近，缺少批量风险说明。
- P2：资源搜索空态可见，但没有“清除搜索 / 查看全部资源 / 新建资源”的恢复动作。
- P2：教师长页仍缺少图表和表格等价文本。

建议：

- 班级加入码区域应提供显式按钮：复制加入码、复制加入链接、重新生成；每个动作有 toast/status。
- 学生表格移动端改为卡片列表，删除等敏感动作进入详情。
- 资源空态增加恢复动作，并用 status 语义播报搜索结果数量。

## 5. 管理员用户：新建模态仍有焦点风险，批量导入没有可见确认层

证据：

- `screenshots/50-function-state-flows-batch15/07-admin-users-mobile-new-account-modal-focus.png`
- `screenshots/50-function-state-flows-batch15/08-admin-users-mobile-batch-import-chooser.png`
- 对应 `.a11y.json`

健康度：入口可用，键盘和批量操作解释不足。

观察：

- 新建账号模态在移动端打开后，背景账号表格仍可在遮罩下大范围可见。
- 连续 Tab 后，截图仍显示背景列表、行级查看/改密/删除等操作。
- 批量导入点击后触发原生 file chooser，没有可见中间确认层。
- 批量导入状态仍显示普通用户列表和操作区，没有展示文件格式、字段映射、导入影响或隐私说明。

问题：

- P1：新建账号模态焦点陷阱仍不成立，背景敏感操作可能进入焦点序列。
- P1：批量导入是高风险批量操作，却直接进入原生文件选择器，没有可见确认、模板要求或影响说明。
- P2：移动端账号表格和模态叠加后信息密度过高，遮罩层无法建立清晰上下文。

建议：

- 模态打开时把背景设为 inert，并锁定焦点在模态内。
- 批量导入前增加可见确认面板：模板下载、支持格式、必填字段、导入后通知/撤销策略。
- 文件选择后展示预检摘要，再允许提交导入。

## 6. 系统配置：校验可见，保存完成态过轻

证据：

- `screenshots/50-function-state-flows-batch15/09-admin-config-mobile-save-state.png`
- `screenshots/50-function-state-flows-batch15/10-admin-config-mobile-add-model-validation.png`
- 对应 `.a11y.json`

健康度：校验可用，保存状态不足。

观察：

- 点击“保存配置”后页面保持在配置页，截图中没有明显保存成功提示。
- 点击“添加模型”空表单后，顶部显示“模型 ID 不能为空”。
- 校验提示视觉清楚，但结构抽查仍记录 `liveRegions: 0`。
- 移动端配置页很长，AI 供应商、模型目录、通知和伦理监测都堆叠在同一长页。

问题：

- P1：保存配置没有明显完成态，管理员难以确认配置是否落库。
- P1：模型校验错误没有 live/status 语义。
- P2：移动端配置页缺少保存影响范围、最近保存时间和变更摘要。

建议：

- 保存成功后显示固定状态条：保存时间、操作者、影响范围。
- 校验错误使用 `role="alert"` 或 `aria-live`，并把焦点移到第一个错误字段。
- 配置页移动端按基础设置、供应商、模型、通知、伦理分组折叠。

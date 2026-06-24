# 功能状态流审计续篇（八）

日期：2026-06-20
范围：管理员有效导入后的治理动作、导入上传控件语义、新建账号模态键盘行为、注册短密码当前错误态。
截图证据：`screenshots/43-function-state-flows-batch8/`。
采集清单：`screenshots/function-state-flows-batch8-manifest.json`。

## 1. 覆盖范围

本轮新增 7 张功能状态截图，重点补第七批后仍缺的导入后治理动作和系统化 a11y 抽查。

有效样本：

- 管理员账号 `admin`：上传官方列名 Excel，生成审计学生账号 `audit_import_20260620044322`。
- 管理员账号 `admin`：打开新建账号模态，连续 Tab 14 次并按 Escape。
- 访客：提交 `/register` 短密码注册表单。
- 清理核对：补采脚本确认 `audit_import_20260620044322` 后续已不在账号搜索结果中；截图仍保留成功导入时的可见状态。

## 2. 管理员导入入口与上传控件语义

证据：

- `screenshots/43-function-state-flows-batch8/admin-users-import-action-area-desktop.png`
- `screenshots/function-state-flows-batch8-manifest.json` 中 `hiddenFileInput`

健康度：中等偏弱。

观察：

- 操作区提供“新建账号 / 下载模板 / 批量导入 / 打开系统配置”四个主动作。
- 页面说明模板前三列必填：账号、姓名、角色，其余字段按角色选填。
- 隐藏 file input 的可访问名称是“搜索管理员功能”，但它实际承载批量导入上传。

问题：

- P2：上传控件的可访问名称与真实任务不一致。读屏用户可能听到“搜索管理员功能”，而不是“上传用户导入 Excel”。
- P2：批量导入按钮没有在可见文案中说明只接受 `.xlsx`，文件格式约束只存在于隐藏 input 的 `accept`。

建议：

- 将隐藏 file input 的 `aria-label` 改为“上传用户导入 Excel 文件”或让按钮与 input 使用同一明确标签。
- 在批量导入按钮或说明附近补充“仅支持 .xlsx”，与模板下载动作形成闭环。

## 3. 有效导入后的治理动作缺口

证据：

- `screenshots/43-function-state-flows-batch8/admin-users-valid-import-governance-gap-desktop.png`
- `screenshots/43-function-state-flows-batch8/admin-users-valid-import-search-result-desktop.png`
- `screenshots/function-state-flows-batch8-manifest.json` 中 `postImportVisibleActions` 与 `postImportGovernanceActionAvailability`

健康度：可用但治理动作不足。

观察：

- 上传有效 Excel 后，页面显示“导入完成：新增 1，更新 0，失败 0”。
- 左侧结果卡显示新增、更新、失败、数据行数和空行跳过。
- 账号列表第一行出现本次导入账号，第二行仍保留上一批审计导入账号，说明历史导入记录会混入普通账号列表。
- 可见动作仍是新建、下载模板、批量导入、普通查看/改密/删除、上一页/下一页，没有“通知学生 / 复制初始登录信息 / 本次新增筛选 / 撤销导入 / 导出失败行”。

问题：

- P1：导入成功后缺少后续治理动作。管理员知道新增了账号，但不知道是否要通知学生、默认密码是什么、是否已初始化学习进度。
- P1：没有“本次新增”临时筛选或结果详情。多次导入后，新旧导入账号混在普通列表中，管理员需要手动搜索或逐行判断。
- P1：没有撤销导入或批次记录。导入一旦成功，只能逐个账号删除，无法按导入批次回滚。

建议：

- 导入成功态应提供“查看本次新增账号”“复制登录通知”“撤销本次导入”“导出失败行”四个明确动作。
- 导入结果应持久化为批次记录，支持按批次筛选、回滚和审计。
- 默认密码和初始化状态应在成功态明确展示，不应只依赖系统配置页知识。

## 4. 新建账号模态键盘焦点

证据：

- `screenshots/43-function-state-flows-batch8/admin-users-create-modal-tab-order-after-tabs-desktop.png`
- `screenshots/43-function-state-flows-batch8/admin-users-create-modal-after-escape-desktop.png`
- `screenshots/function-state-flows-batch8-manifest.json` 中 `createModalTabSequence`

健康度：弱。

观察：

- 新建账号模态打开后，页面视觉上出现遮罩，背景内容变淡。
- 连续 Tab 后的前 9 个焦点仍落在遮罩后的页面控件上，包括“下载模板”“批量导入”“打开系统配置”、搜索框、角色筛选、列表行查看/改密/删除。
- 焦点到第 10 次才进入模态内“关闭”按钮。
- 按 Escape 后模态仍存在，`createModalStillOpenAfterEscape = 1`。

问题：

- P1：模态没有焦点陷阱。键盘用户会在视觉遮罩后的页面控件中移动，当前操作上下文与焦点位置不一致。
- P1：Escape 不能关闭模态。此前已发现同类问题，本轮确认焦点陷阱也不成立。
- P2：遮罩后的背景控件仍可进入焦点序列，读屏顺序会混入不可操作上下文。

建议：

- 模态打开时将初始焦点放在模态标题或第一个输入框，并把 Tab 循环限制在模态内。
- Escape 应关闭模态；关闭后焦点返回触发按钮“新建账号”。
- 背景内容在模态打开时应对辅助技术隐藏或设置不可交互状态。

## 5. 注册短密码当前错误态

证据：

- `screenshots/43-function-state-flows-batch8/register-short-password-error-current-desktop.png`
- `screenshots/function-state-flows-batch8-manifest.json` 中 `registerShortPasswordVisualInspection`

健康度：阻断。

观察：

- 访客提交短密码注册表单后，页面进入 Next.js Runtime Error 覆盖层。
- 可见错误为 `Objects are not valid as a React child (found: object with keys {formErrors, fieldErrors})`。
- 正常字段错误没有渲染出来，用户只能看到开发错误界面。

问题：

- P0：短密码这种普通输入错误仍会升级成运行时错误，注册流程被阻断。
- P1：错误态没有可恢复的表单上下文；页面只提供开发覆盖层，不提供“密码至少 6 位”的用户级说明。

建议：

- 注册接口返回的 Zod `flatten()` 结果必须在 UI 层转成字符串字段错误，不能直接作为 React child。
- 密码错误应保持在表单内展示，并用 `aria-live` 通知辅助技术。

## 6. 本轮结论

- 有效导入主链路可用，但导入后的批次治理、通知、撤销和本次新增筛选仍缺失；这已经从“待补证据”变为“已确认的产品缺口”。
- 管理员新建账号模态同时存在焦点陷阱缺失和 Escape 无效，键盘可达性风险高于此前只看视觉弹窗时的判断。
- 注册短密码问题在当前基线仍是 P0：不是字段级错误，而是运行时错误覆盖层。

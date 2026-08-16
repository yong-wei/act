## Context

`AdaptivePracticePage` 当前从候选卡片触发 `explain`，请求体只在客户端隐式查找第一条不同的 `optionId`。服务端差异模型已经能对两个指定 style 生成结构化结果，但页面状态以候选卡片 `optionId` 为键，无法表达三候选的全部方案对，也无法在批次/版本切换时区分旧响应。

## Design

### 1. Candidate-batch comparison model

页面以 `candidateBatchId`、`pathVersion` 和候选 `optionId` 建立比较上下文。候选批次加载后先投影出事实摘要；摘要不计算新指标，只读取服务端候选快照中已有值。事实维度固定为候选标签、预计时长、路径节点数、资源组合、准备度、检查点、锁定节点和终点验证。字段缺失显示数据不足，同值维度显示无差异。

候选数量为 0、1、2、3 或更多时分别保持可用的降级语义：无候选不显示比较选择器；单候选显示路径事实但不显示比较选择器；两个候选只生成一个合法方案对；三个候选生成三个无序方案对。当前规划器优先返回不超过三条候选，前端不制造占位候选。

### 2. Explicit pair selection

比较入口展示候选批次摘要和可访问的方案对选择控件。控件只允许选择两个不同候选；用户确认后才请求差异详情。比较关系按稳定候选顺序规范化为无方向 pair key，因此 `A-B` 与 `B-A` 共享缓存和响应身份，但展示仍标明左右方案。

比较详情从候选批次统一区域展示，不再附着在某一张候选卡片下。详情继续使用服务端现有字段：共同节点、独有节点、顺序差异、指标、取舍和限制。`no-material-difference` 与 `insufficient-data` 直接使用服务端状态，不转化为推荐文案。

### 3. URL and stale-response contract

没有明确方案对时，URL 只保留候选批次；确认方案对后写入 `compareLeft`、`compareRight` 和 `compareVersion`。页面只在所有参数匹配当前批次、路径版本和合法候选时恢复详情，否则清除详情并回到摘要。

每次请求携带 `comparisonKey = candidateBatchId + pathVersion + normalizedPairKey`。响应提交前必须与当前 key 完全相等；候选批次、路径版本、方案对或候选顺序变化都会清除旧详情。服务端仍通过现有授权和 path option lookup 校验候选属于同一保存路径和当前用户。

### 4. Read-only boundary

比较请求继续使用 `explain` 操作，但不得调用路径选择、调整或执行写入。候选摘要和差异详情的交互只更新本地查看状态和 URL；现有“选择路径”“继续原路径”“调整”等动作仍是独立入口。

### 5. Accessibility and responsive behavior

方案对控件使用现有可访问项目控件或原生 `select`/`fieldset` 语义，为每个候选提供稳定可读名称，比较结果区域使用 `role="status"` 和 `aria-live="polite"`。在 320px 宽度下改为单列布局，不隐藏候选对、事实字段或错误状态，也不依赖悬停、拖拽或仅图标。

## Rejected Alternatives

- 默认比较前两条候选：会重新引入隐式比较，且三候选无法表达用户意图。
- 为左右顺序分别缓存结果：会造成重复请求和事实身份分裂。
- 在前端重算差异或推导推荐：会绕过服务端事实合同并扩大本 Issue 范围。
- 将比较详情写入当前 `LearningPath`：会把只读查看与执行状态混在一起，破坏已有路径连续性。

## Verification Strategy

- 单元测试：规范化 pair key、合法方案对枚举、事实摘要降级、URL 参数校验和响应 key 守卫。
- 路由/运行时测试：明确 `compareWithOptionId` 组合、同一方案拒绝、跨路径或越权候选拒绝、只读解释结果。
- 浏览器测试：两候选、三候选、无实质差异、数据不足、切换方案对和 320px/键盘操作。

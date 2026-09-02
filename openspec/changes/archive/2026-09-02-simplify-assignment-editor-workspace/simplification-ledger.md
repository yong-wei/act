# simplify-assignment-editor-workspace 前后对照（#1792）

基线：2675 行；化简后：2676 行（净 +1 行；结构化简不以行数为指标，
见 tasks 2.6 与下方 mapping——删除的重复被注释与 helper 定义抵消）。

## 已接受的变换（accepted）

| # | 变换 | 前 | 后 | 行为保持依据 |
|---|---|---|---|---|
| 1 | 统一本地文档提交入口 `commitDocument` | 3 处手写 `documentRef+setDocument+setSaveState('dirty')` 三连（updateDraft 内 + generate 两处绕过） | 单一 helper；updateDraft 保留指纹判等 | generate 两处原实现即无指纹/无 total 同步，helper 逐字等价；updateDraft 尾部等价替换 |
| 2 | `replaceAt` 数组替换 helper | 8 处 `list.map((item,i)=>i===target?next:item)` 内联 | 1 处泛型定义 + 8 个调用点 | map 与 replaceAt 语义逐字相同（索引替换） |
| 3 | 合并 `updateCriterion`/`questionWithCriterion` | 两个函数体逐字相同的 12+12 行 | `withCriterion` 单一定义；updateCriterion 为其 onChange 包装；对话框用点改 withCriterion | 纯重复消除，调用面不变 |
| 4 | 级别三胞胎参数化 `updateLevel` | label/maxPoints/guideline 三段 onChange 各 12-16 行（仅字段名不同，maxPoints 带 sortRubricLevels） | 单 helper + 三处 4-6 行调用；`resort` 参数显式保留排序语义 | 字段更新路径逐字等价；排序行为由布尔参数保留 |
| 5 | `moveQuestion` 数组交换重复 | 18 行手写交换（与 moveItem 相同逻辑） | `moveItem(current.questions, index, delta)` 复用 | 交换语义相同 |
| 6 | 命名谓词 `hasSaveBaseline`（type guard） | save/publish/generate 三处内联 `assignmentId && revisionId`（publish 版还含 contentDigest 混合判断） | 单一定义 + 三处调用；收窄签名保持后续非空使用 | 布尔语义相同；type guard 保持 TS 收窄 |
| 7 | 命名谓词 `rubricBasisMissing` | generate 与 requestRubricGeneration 两处 `!standard && !name` 内联 | 单一定义 + 两处调用 | 与服务端 basis-missing 同语义，布尔等价 |
| 8 | 状态文案去重 `publicationStatusMessage` | sr-only 与可见横幅两份逐字相同的 `saveState==='error' && saveFailure ? … : publicationRecoveryMessage(saveState)` | 单一表达式 | 渲染输出逐字相同 |

## 已拒绝/推迟的变换（rejected / deferred）

- **RubricLevelFields 子组件抽取（机会 3 的组件化部分）**：rejected——
  JSX 大规模重排的回归风险高于本轮收益；三胞胎参数化已消除字段级重复。
- **请求状态机统一 helper（机会 4）**：deferred——7 处 fetch 的错误码表、
  幂等键与焦点恢复各不相同，合并需要逐处比对 CAS 语义（design 风险 1），
  留给后续有更完整组件测试覆盖时实施。
- **blockers memo 与 publish 双重 schema 校验合并**：deferred——publish
  时的重复校验是刻意的最新快照校验（防保存队列竞态），合并会改变时序语义。

## 行为/测试证据

- `assignment-authoring` 契约测试 25/26 通过；唯一失败
  `teacher-review-contracts > AI rationale` 为基线预存在失败（批改 UI
  文案，与编辑器无关，stash 对照确认）。
- typecheck 零错误；编辑器文件 eslint 零问题。
- 未拆分文件、未引入抽象层、未改变任何请求 payload/幂等/CAS 语义。

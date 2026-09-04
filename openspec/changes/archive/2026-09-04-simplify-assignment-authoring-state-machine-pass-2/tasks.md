## 1. Baseline

- [x] 1.1 Confirm the 103,947-byte workspace baseline and record its state owners, effects, request paths, imports, and public exports.
- [x] 1.2 Characterize load, edit, save, stale conflict, AI draft, validation, publication, focus, CAS, and idempotency behavior.

## 2. Simplify

- [x] 2.1 Replace behavior-equivalent save/publication state and response branches with the smallest explicit local representation.
- [x] 2.2 Remove redundant derived booleans, effects, and single-caller helpers while keeping distinct mutation semantics explicit.
- [x] 2.3 Remove imports and tests made obsolete by the accepted simplifications.

## 3. Verify

- [x] 3.1 Run focused editor, conflict, AI-draft, validation, publication, and accessibility tests plus typecheck and lint.
- [x] 3.2 Record the fixed before/after calculation proving an after total of at most 93,552 bytes, including extracted production code.
- [x] 3.3 Run strict OpenSpec validation and review the final diff for API, lifecycle, or scope changes.

## 度量（task 3.2）

- 基线：`assignment-editor-workspace.tsx` @ f79f1836f = 103,947 bytes（当前 HEAD 复核一致）。
- 之后：同文件 = 93,534 bytes；未新增生产文件、未向既有生产文件抽取代码（全部为就地去重），after total = 93,534 ≤ 93,552。
- 主要削减：save/publish 三套文案口径合并为 SAVE_STATE_PRESENTATION 单表；saveFailure/publicationError/blockerLabel 查表化；ref-map 回调与延迟聚焦统一为 trackMapEntry/focusLater；题目/评分项/档位三组同构移动删除按钮参数化；嵌入式编辑器共享 props；criteria/levels 注册 ref 与 basePath 助手；rubricDialog 死字段 basis 移除；未使用 saveStatusRef/conflictRef 删除；包裹 label 已提供可达名的冗余 aria-label 删除；单表达式 onChange 折叠。
- 验证：typecheck EXIT=0；eslint 无问题；assignment-ui-contracts 12/12（3 处源码断言更新为等价现状）；Playwright 901 23 通过/1 失败（autosave-400，stash 验证基线同败）/12 跳过；embedded-editor 无障碍 spec 基线同败（Node26/tsx React 未定义，环境债务）。API payload、CAS（409/expectedVersion）、幂等键、发布修订、教师批准与 aria 语义未变。

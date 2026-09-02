# simplify-student-assignment-workspace 前后对照（#1793）

基线：1619 行；化简后：1634 行（净 +15 行：删除的重复被 helper 定义与
注释抵消；化简以结构重复消除为准，见 tasks 完成标准与下方 mapping）。

## 已接受的变换（accepted）

| # | 变换 | 前 | 后 | 行为保持依据 |
|---|---|---|---|---|
| 1 | `errorMessage(cause, fallback)` | 9 处内联 `cause instanceof Error ? cause.message : '<fallback>'` | 单一 helper + 9 调用点 | 表达式逐字等价 |
| 2 | `focusNoticeAfterFrame(noticeRef)` | 11 处 `requestAnimationFrame(() => noticeRef.current?.focus())` | 单一 helper + 11 调用点 | 逐字等价 |
| 3 | `isAnswerVersionConflict(cause)` 谓词 | saveDraft/removeAttachment/reorder/discardUpload/submitQuestion 5 处内联 `instanceof && code ===` | 单一谓词；reorder 的双码变体保留 `asset-order-set-mismatch` 显式并列 | 布尔语义逐字等价；双码分支不折叠 |
| 4 | `activeUploadJobs(questionId)` | 3 处 `(pendingUploads[qid] ?? []).filter(status !== 'FAILED')`（queueAttachments/uploadEmbeddedImage/submitQuestion） | 单一 helper | 过滤谓词逐字相同 |
| 5 | `deleteAnswerAsset(question, assetId, answerVersion)` | persistQuestionDraft/removeAttachment/revokeUploadIntent 三处重复的 DELETE 端点 + payload 类型 + `json().catch(()=>({}))` | 单一 helper 返回 `{ok,status,payload}`；三处调用各自保留校验分支（revoke 的 404 特例原样） | 端点、headers、body 逐字相同；各用点校验顺序不变 |
| 6 | `patchById(items, id, patch)` | questions 按 id patch（updateQuestion）、assets 按 id 整体替换（confirmUploadedAsset）等内联 map | 单一泛型 helper（值/函数两种 patch 形态） | map 语义逐字等价；confirm 的 `some ? map : append` 顺序语义保留 |
| 7 | `CriteriaScoreList` 组件 | StudentApprovedFeedback 与 StudentPublishedResult 两段逐字相同的 criteria `<dl>` 渲染 | 单一组件 | JSX 输出逐字相同 |

## 已拒绝/推迟的变换（rejected / deferred）

- **统一"题目动作执行器"（8 个 busy-key 函数的生命周期合并）**：deferred——
  每处 controlId 回退值、冲突重载与 setNotice 顺序、submit 的
  `crypto.randomUUID()` 幂等键细节各不相同，合并需逐处比对时序（同系列
  #1792 对请求状态机统一作出同裁决）。
- **`responseStatus` 9 分支嵌套三元重写**：deferred——题状态推导语义
  敏感（附件上传中/已提交/未作答的优先级），查表化需先补组件级测试。
- **`QuestionEditor` export 收编与 `assetPreviewUrls` state+ref 收敛**：
  deferred——API 面收缩与 ref 派生重构超出最小化简边界，需在 change 中
  明示后另行处理。
- **硬失败码清单统一（513 与 1608 两份列表）**：deferred——两清单语义
  相近但不相同（确认失败续期 vs 续期后重试），合并需逐码核对服务端契约。

## 行为/测试证据

- 相关测试 27/27 通过（student-response-editor ×2、assignment-ui-contracts、
  assignments 目录 2 文件）。
- typecheck 零错误；文件 eslint 零问题。
- 未拆文件、未改任何请求 payload/幂等键/提交生命周期/附件顺序语义；
  DELETE 合并保留三处各自的校验与 404 特例分支。

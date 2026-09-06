## Context

调查基于 `integration` 的 `f0399d234`。三个批阅生产文件合计 83,947 bytes：workspace 47,588、contracts 23,436、queue 12,923。

`public-api.ts:276–325` 的读取、打开和保存都调用 `buildTeacherAssignmentReviewApiProjection`；GET/PATCH 返回 `{ review }`，POST 在相同结构上增加 replay 信息。`teacher-review-contracts.ts:355` 却继续接受 `root.item`、根级 question/submission、`review.criteria` 等其他形状，测试在 `assignment-authoring/__tests__/teacher-review-contracts.test.ts:300` 人工构造根级数据。队列也接受 questions/answers/reviewItems/runs 等别名，实际服务返回规范化 questions。

工作区加载与保存分别重复设置 detail、criteria、overallComment（152、231 行）。源码测试直接要求 `criteria.map(...)`、`response.status === 409` 和特定 action 联合类型出现，不能证明对应请求或恢复行为。

## Goals / Non-Goals

目标是减少客户端理解的输入形状与重复状态更新，并让测试约束实际批阅行为。服务端响应格式、历史题目快照读取、评分审批、原件访问、数据库及页面布局不变。

## Decisions

1. 以现有服务端投影为输入，逐项删除没有当前生产者的兼容分支。历史 questionSnapshot/rubric 仍由服务端输出，不能和仅测试构造的顶层别名混为一谈。不新建 DTO 转换框架。
2. 合并相同的加载/保存结果应用逻辑，保持服务器快照与尚未保存的编辑内容在语义上可区分。保存冲突仍保留本地编辑，批准仍先保存；退回、发布不套用批准流程。
3. 删除只断言旧形状或内部语法的测试。已有行为测试覆盖同一需求时直接删除重复断言；缺少覆盖的 CAS、批准顺序、附件重试和隐私需求用最少的组件/请求测试补齐。测试引用不构成生产用途。
4. 用上述三个文件及任何接收抽取代码的文件计算总生产字节，要求真实净减少，并在完成说明列出已删除分支和测试。沿用现有简化说明，不新建度量脚本或永久清单。

## Risks / Trade-offs

接口仍有 nullable 字段和历史快照，保留真实返回值所需的空值处理与安全投影；删除多余别名不等于信任任意输入。使用真实投影产出的 fixture 验证读取、打开、保存，而非让新 fixture 复刻猜测格式。

## Migration Plan

客户端与测试同一提交系列调整；无数据迁移。必要时回退该代码提交即可。

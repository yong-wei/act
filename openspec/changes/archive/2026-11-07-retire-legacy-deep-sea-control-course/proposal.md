# Proposal: retire-legacy-deep-sea-control-course

- Issue: #2155（父项 #2146）
- 类型: 软件退役（已确定产品决策，2026-11-06 课程负责人确认）

## Why

课程负责人决定：七船分别是七个独立实验，`/ilab/deep-sea-control` 旧 24 步综合课程退役。旧 `ShipStage` 未建立统一教学编排，不能作为七船重构基础；保留旧课程会造成新旧两套评分/会话语义并存，干扰 #2147/#2148/#2149 的七船运行与评价改造。

## What Changes

1. 旧 URL 保留唯一薄入口（提示退役 + 七船目录链接）；旧资料 URL（task/guide/teaching-guide/rubric/pretest/paper）返回 410 退役说明或指向对应七船资料；不创建旧会话、不交换 ticket、不转发 ticket 给单船。
2. 旧 `/api/ilab/session`（创建/提交/complete 写接口）全部返回 410 + 稳定错误码 `LEGACY_EXPERIMENT_RETIRED`；不保留旧执行分支。
3. 删除旧 24 步课程实现：`src/app/ilab/deep-sea-control/` 旧客户端/导航/场景装配/测验客户端与资料页面；`src/features/ilab/` 的 `steps.ts`、`vessels.ts`、`scoring.ts`、`quizzes.ts`、`lab-resources.ts`、`report.ts` 中的课程实现及专属测试；旧客户端 `runNomoto` 采样、`ilab-deep-sea-origin/pretest/paper` 浏览器存储读取。
4. 抽取仍被七船使用的共享服务（`session-service.ts` 中的 `assertIlabRunOpen`/`IlabServiceError`/`toIlabHttpError`/`withIlabRunLock`）到共享模块后再删除旧会话实现；七船 import 相应调整。
5. 共享仿真组件删去仅由旧 24 步使用的 `stepNav/hostBrief/hostSubmission` 宿主覆盖分支（七船页面均不传这些 props）。
6. 清除导航、站内索引、资源元数据、脚本/测试、当前文档中把 24 步称为主课程/必修总控的内容；历史发布记录保留并标注历史。
7. 历史数据：只做软件退役，不删除真实学生数据。输出 `dsc_` 前缀旧记录的只读数量/状态清单；旧报告保持鉴权只读；旧前端暂存状态不恢复为可写会话；旧成绩不自动迁移折算。

## Impact

- 受影响代码：`src/app/ilab/deep-sea-control/**`、`src/app/api/ilab/session/**`、`src/features/ilab/{steps,vessels,scoring,quizzes,lab-resources,report,session-service}.ts`、4 个共享仿真组件的宿主 props 分支、相关测试与文档。
- 明确不受影响：七船路由 `/simulations/{destroyer,lng,container,cruise,drilling,icebreaker,dredger}` 与 `/api/ilab/vessel|destroyer/session/**`；`ilab-client.ts` 票据/回传协议；`ai-data.ts` 账本；`sketch-*`；`payload.ts`；`IlabExperimentRun`/`VirtualSimulationReport` 共享表；`rust/control-engine` 的 MMG/辨识资产。
- 风险：共享能力误删（以定向回归覆盖）；外部登记 URL 仍指旧入口（列为外部配置待办，不臆称已改）。

## Non-Goals

- 不删除真实学生数据、不 drop 共享表、不按表全量清理。
- 不把旧 ticket 静默映射为七船实验、不迁移旧通过状态。
- 不修改 #1033；不引入第二套实验平台；不为退役恢复任何旧 24 步执行能力。

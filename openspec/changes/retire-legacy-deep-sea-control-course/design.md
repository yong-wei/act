# Design: retire-legacy-deep-sea-control-course

## 1. 侦察结论（依赖表，基线 integration）

### 删除

| 类别 | 项 |
|---|---|
| 页面 | `src/app/ilab/deep-sea-control/` 下 `experiment-client.tsx`、`ilab-dock-steps.tsx`、`ship-stage.tsx`、`task/`、`guide/`、`teaching-guide/`、`rubric/`、`pretest/`、`paper/`、`__tests__/ilab-dock-steps.test.tsx` |
| API | `src/app/api/ilab/session/route.ts`（POST 创建）、`[originId]/steps/route.ts`（提交）、`[originId]/complete/route.ts`（complete）改写为 410 恒定响应；`[originId]/route.ts`（GET）保留为**鉴权只读**历史读取 |
| features | `steps.ts`、`vessels.ts`、`scoring.ts`、`quizzes.ts`、`lab-resources.ts`、`report.ts` 整删；`session-service.ts` 删除旧会话创建/提交逻辑、抽取共享件后删除残余 |
| 测试 | `src/features/ilab/__tests__/` 中仅覆盖旧课程的部分（`ilab-contract.test.ts` 拆分：七船契约断言保留，24 步数组/评分器断言删除） |
| 组件 | `destroyer-simulation.tsx`、`icebreaker-simulation.tsx`、`vessel-experiment-panels.tsx`、`drilling-simulation.tsx` 中 `stepNav/hostBrief/hostSubmission` props 与分支 |

### 抽取（先抽取后删除）

`session-service.ts` 中被 `vessel-session.ts` 依赖的共享件：`assertIlabRunOpen`、`IlabServiceError`、`toIlabHttpError`、`withIlabRunLock`（含其 Prisma 事务锁实现）→ 新文件 `src/features/ilab/run-lock.ts`（中性命名，不带旧课程语义）。七船 `vessel-session.ts` 改 import。

### 保留（禁止误删）

- `ilab-client.ts`（外部票据/回传协议）、`ai-data.ts`（账本，七船在用）、`payload.ts`、`ai-review.ts`、`sketch-client/plots/recognition.ts`（destroyer-simulation 与 use-vessel-experiment 在用）、`vessel-session.ts`、`destroyer-session.ts`。
- `/api/ilab/vessel/session/**`、`/api/ilab/destroyer/session/**` 全部不动。
- `IlabExperimentRun`、`VirtualSimulationReport` 表与既有数据。
- `rust/control-engine/src/destroyer_hifi.rs`、`destroyer_hifi_runtime.rs`。

### 文档

`docs/ProjectDescription.md`、`docs/memory/02-recent-summary.md`、`docs/memory/10-project/10-current-state.md` 中"主 24 步课程/必修总控"表述改为"已退役（2026-11），七船独立实验为现行课程形态"，历史段落标注历史。

## 2. 关键设计决策

### 410 语义与错误码

旧写接口统一：

```
HTTP 410 Gone
{ "error": { "code": "LEGACY_EXPERIMENT_RETIRED", "message": "旧综合实验已退役，请使用七个独立实验。" } }
```

响应体结构与 `toIlabHttpError` 现有错误包络一致（`IlabServiceError` 形态），保证旧客户端与监控可稳定识别。路由文件保留（URL 不 404），处理函数恒定返回 410，不触碰数据库、不写审计、不消耗 ticket。

### 薄退役入口

`/ilab/deep-sea-control`（原 URL）替换为单一服务端页面：标题"旧综合实验已退役"、正文一句说明 + `/simulations` 目录链接（七船）。不读取 localStorage、不初始化仿真、不做 ticket 交换。旧资料 URL 子页统一 410 页面（`notFound` 定制或独立 410 路由响应），其中 task/guide/rubric 若存在明确对应七船资料链接则给出链接，否则仅退役说明。

### 历史只读

- `GET /api/ilab/session/[originId]` 保留鉴权读取：沿用既有会话归属校验（登录用户 + run 归属/课堂票据语义，不弱于现状），返回既有报告与步骤数据；该路由中依赖被删 `report.ts` 的部分，改为最小内联读取（直接查 `IlabExperimentRun`/`VirtualSimulationReport`），不加载评分器。
- `dsc_` 记录清单：一次性只读脚本（`scripts/tests/` 或 change 验证脚本内）按 `dsc_` 前缀统计 run 数量/状态/时间范围，输出到执行日志；没有记录输出 0。不做任何写操作。

### 共享组件收缩

`stepNav/hostBrief/hostSubmission` 在 4 个组件中是可选 props 分支；删除 props 定义、内部分支与关联类型。七船页面（`src/app/simulations/**`）实测不传这些 props，删除后无调用方受影响；typecheck 兜底。

### 浏览器存储

旧客户端的 `ilab-deep-sea-origin` / pretest / paper localStorage 读取代码随页面删除；不做主动清理用户浏览器数据的动作（残留键无害）。

## 3. 顺序与验证

1. 抽取 `run-lock.ts` + 七船 import 切换（此时旧实现仍在，七船回归可跑）。
2. 旧写接口改 410、薄入口/410 页落地。
3. 删除旧实现与测试、共享组件收缩。
4. `rtk npm run typecheck` 零错误；`rtk npm run test:unit` 定向（ilab 契约、sketch、七船 session 相关）；`dsc_` 只读清单。
5. 文档更新。

## 4. 风险与回滚

- 单一 PR 交付，回滚即 revert；不动数据库 schema 与数据，无迁移风险。
- 外部实验空间登记 URL 若仍指旧入口：PR 描述中列为外部配置待办（需在实验空间后台修改），不在本仓臆称已处理。

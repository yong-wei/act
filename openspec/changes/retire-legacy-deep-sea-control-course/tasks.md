# Tasks: retire-legacy-deep-sea-control-course

## 1. 抽取共享服务

- [x] 1.1 新建 `src/features/ilab/run-lock.ts`：迁移 `assertIlabRunOpen`、`IlabServiceError`、`toIlabHttpError`、`withIlabRunLock` 及其锁实现，含 JSDoc 说明为共享运行锁/错误能力
- [x] 1.2 `vessel-session.ts` 改从 `./run-lock` 导入；`session-service.ts` 改为 re-export 或直接切换旧 API 引用
- [x] 1.3 定向回归：七船 session 单测通过，证明抽取无行为变化

## 2. 切断旧写入口

- [x] 2.1 `POST /api/ilab/session`、`POST /api/ilab/session/[originId]/steps`、`POST /api/ilab/session/[originId]/complete` 恒定返回 410 + `LEGACY_EXPERIMENT_RETIRED`（沿用现有错误包络结构），不触数据库、不消耗 ticket
- [x] 2.2 `GET /api/ilab/session/[originId]` 改为最小内联鉴权只读（查 `IlabExperimentRun`/`VirtualSimulationReport`），不加载已删评分器；权限不弱于现状

## 3. 薄退役入口与 410 页面

- [x] 3.1 `/ilab/deep-sea-control` 重写为退役说明页（七船目录链接），不初始化仿真、不读 localStorage、不交换 ticket
- [x] 3.2 task/guide/teaching-guide/rubric/pretest/paper 子页返回 410 退役说明；有明确七船对应资料的给出链接
- [x] 3.3 旧会话/测验客户端与 `runNomoto`、`ilab-deep-sea-origin/pretest/paper` 存储读取随页面删除

## 4. 删除旧实现

- [x] 4.1 删除 `src/features/ilab/{steps,vessels,scoring,quizzes,lab-resources,report}.ts` 与 `session-service.ts` 残余（共享件已抽取）
- [x] 4.2 删除 `src/app/ilab/deep-sea-control/` 旧客户端/导航/场景装配与专属测试；拆分 `ilab-contract.test.ts`，保留七船契约断言
- [x] 4.3 共享仿真组件（destroyer/icebreaker/vessel-experiment-panels/drilling）删除 `stepNav/hostBrief/hostSubmission` props 与分支
- [x] 4.4 全仓无运行态 `ILAB_STEPS`、`runNomoto`、24 步依赖（退役映射、历史数据识别与历史文档命中除外）

## 5. 历史数据与清单

- [x] 5.1 `dsc_` 前缀只读清单脚本执行一次：run 数量/状态/时间范围，据实输出（含 0）；不执行任何写操作
- [x] 5.2 数据库行数对照：退役前后 `IlabExperimentRun`/`VirtualSimulationReport` 总行数一致

## 6. 文档与收尾

- [x] 6.1 更新 `docs/ProjectDescription.md` 与 memory 当前态文档：24 步表述改为"已退役，七船独立实验为现行形态"，历史段落标注
- [x] 6.2 外部实验空间登记 URL 状态列入 PR 描述待办（不在仓库内臆称已改）
- [x] 6.3 `rtk npm run typecheck` 零错误；`rtk npm run test:unit` 全量通过（或列明与本次无关的既有失败）
- [x] 6.4 浏览器冒烟：七船任一船可启动/提交；旧 URL 显示退役页；旧 API curl 得 410

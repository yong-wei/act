# Practice Lab artifact/run contract

状态: active
捕获修订: `e41e0731f5815daa3a8e496914fc89c79afbfa38`

公共 envelope 是 `act-practice-lab-artifact-run-contract/v1`。它投影既有 `ArenaControllerArtifact`、`ArenaVirtualSimulationRun`、`ArenaEvaluationRun`、`ArenaSubmission`、`SimulationRun` 与 Practice outcome，不新增第二套 Prisma run 表。

Preview 与 Practice 永远 `officialEligible=false`。官方分数只来自服务端 Arena evaluator 经 accepted submission。公开 DTO 不含 hidden scenario、私有 dataset、reference trajectory 或原始答案。

`/api/arena/virtual-simulation-runs` 先 `rejectVirtualPreviewRequestBody`，再走 R1 server façade 重算并写入既有 preview/canonical run。

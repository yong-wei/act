# HANDOFF — define-practice-lab-artifact-run-contract

捕获修订：`e41e0731f5815daa3a8e496914fc89c79afbfa38`。

R3-R5 必须消费 `src/lib/practice-lab-run-contract` 的 envelope / hasher / source mapping。不要新建 `PracticeRun`。历史 ArenaEvaluationRun / Submission / SimulationRun 不重算、不改 owner。

Rollback：删除本 change 的 DTO/validator 接入即可；既有 Prisma 行保持可读。

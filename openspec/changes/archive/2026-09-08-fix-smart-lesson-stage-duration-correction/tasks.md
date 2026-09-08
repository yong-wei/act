## 1. Prompt 约束与版本升级

- [x] 1.1 `buildStageRequest` 的 system prompt 增加阶段时长一致性约束：`stage.minutes` 必须严格等于 `steps[].minutes` 之和。
- [x] 1.2 `SMART_LESSON_PROMPT_VERSION` 升级为 `smart-lesson-plan.v2`；确认 schema 版本字符串不变。

## 2. 错误规范化与 correction 上下文

- [x] 2.1 `validateStageCandidate` 对 schema 校验失败的 receipt issues 做规范化：message 匹配 `^stage-step-duration-mismatch:(\d+):(\d+)$` 的 custom issue 改写 code 为 `stage-step-duration-mismatch`、path 归一 `['steps']`，message 保留。
- [x] 2.2 `buildCorrectionContext` 新增 `stage-step-duration-mismatch` 分支：目标时长取 `expectedStageMinutes`（outline 权威值），实际时长取 message 捕获组；instruction 要求保持步骤数量、顺序、标题、教学活动、评价内容与 `sourceBindings` 不变，每步 minutes 为正整数且总和严格等于目标（含 `stage.minutes` 同步修正），优先保持原时长比例，不扩展教学语义。
- [x] 2.3 outline 不可解析或 message 不匹配时返回 `null`（通用修正提示），不猜测数值。

## 3. 回归测试

- [x] 3.1 worker 测试：schema 层步骤时长不匹配输出 → `beginCorrectionAttempt` 收到规范化 receipt（code `stage-step-duration-mismatch`）与含 stage/expectedMinutes/actualMinutes 的 correctionContext，且第二次 generate 的 prompt 携带该上下文。
- [x] 3.2 worker 测试：修正输出（步骤和=outline 目标）通过二次校验并 complete；ORIGINAL 与 CORRECTION attempt 保持独立（`correctsAttemptId` 关联，不覆盖原始输出）。
- [x] 3.3 worker 测试：outline 输出缺失等不可解析场景退化通用修正（correctionContext 为空），不抛错。
- [x] 3.4 既有 `stage-duration-mismatch`（门禁层）correction 测试保持通过，行为不回归。

## 4. 验证

- [x] 4.1 `rtk npm run typecheck` 零错误。
- [x] 4.2 定向 vitest：`src/lib/smart-lesson-plan/__tests__/`（worker/schema/provider-runtime/service）。
- [x] 4.3 `openspec validate fix-smart-lesson-stage-duration-correction --type change --strict` 通过。
- [ ] 4.4 使用真实 Qwen3.5（siliconflow）完成一次修复后 smoke：既有失败阶段经 correction 通过或如实记录失败；不手动 retry/resume，不启动正式实验；结果记录进 Issue/PR。
  - 2026-09-09 如实记录：两条 smoke 路径均在环境层受阻，未获得真实 Qwen3.5 修复后验证，本项保持未完成。
  - 自包含 E2E（`npm run test:smart-lesson-real-e2e -- --real-provider`，claim 分支 63f8b333f8）在生成启动即返回 400 `aggregate-class-context-invalid`，未进入 provider 调用。根因是基线缺陷（与本 diff 无关，调用链不相交）：E2E harness 只播种 1 名学生（< `PROJECTION_INDEPENDENT_LEARNER_MINIMUM=5`），`readTeacherClassEvidencePort` 小样本抑制把画像 `aggregate` 置 null 但保留 `stateKind='SNAPSHOT'`，`readGenerationClassContext` 的 `projectCurrentCumulativeClassPortrait` 因缺少 aggregate 必抛 `aggregate-class-context-invalid`。
  - 实验 runner（SMOKE-r1~r3 同路径，`selectedClassId: null` 不踩上述 400）需要 `SMART_LESSON_TEACHER_LOGIN_ID/PASSWORD`（既有实验教师账号凭据，README 要求在 .env 或环境提供）；当前环境与 `.env` 均无该凭据，无法登录。固定 `COURSE_BASIS_ID` 属既有实验教师，新建教师账号无法复用其实验输入。
  - 待用户提供教师凭据后，可在 claim 分支栈（独立 `SMART_LESSON_REDIS_PREFIX`）上以 `--mode smoke-only --smoke-index 4` 补做；未 retry/resume，未启动正式实验。

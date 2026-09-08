## 1. Prompt 约束与版本升级

- [ ] 1.1 `buildStageRequest` 的 system prompt 增加阶段时长一致性约束：`stage.minutes` 必须严格等于 `steps[].minutes` 之和。
- [ ] 1.2 `SMART_LESSON_PROMPT_VERSION` 升级为 `smart-lesson-plan.v2`；确认 schema 版本字符串不变。

## 2. 错误规范化与 correction 上下文

- [ ] 2.1 `validateStageCandidate` 对 schema 校验失败的 receipt issues 做规范化：message 匹配 `^stage-step-duration-mismatch:(\d+):(\d+)$` 的 custom issue 改写 code 为 `stage-step-duration-mismatch`、path 归一 `['steps']`，message 保留。
- [ ] 2.2 `buildCorrectionContext` 新增 `stage-step-duration-mismatch` 分支：目标时长取 `expectedStageMinutes`（outline 权威值），实际时长取 message 捕获组；instruction 要求保持步骤数量、顺序、标题、教学活动、评价内容与 `sourceBindings` 不变，每步 minutes 为正整数且总和严格等于目标（含 `stage.minutes` 同步修正），优先保持原时长比例，不扩展教学语义。
- [ ] 2.3 outline 不可解析或 message 不匹配时返回 `null`（通用修正提示），不猜测数值。

## 3. 回归测试

- [ ] 3.1 worker 测试：schema 层步骤时长不匹配输出 → `beginCorrectionAttempt` 收到规范化 receipt（code `stage-step-duration-mismatch`）与含 stage/expectedMinutes/actualMinutes 的 correctionContext，且第二次 generate 的 prompt 携带该上下文。
- [ ] 3.2 worker 测试：修正输出（步骤和=outline 目标）通过二次校验并 complete；ORIGINAL 与 CORRECTION attempt 保持独立（`correctsAttemptId` 关联，不覆盖原始输出）。
- [ ] 3.3 worker 测试：outline 输出缺失等不可解析场景退化通用修正（correctionContext 为空），不抛错。
- [ ] 3.4 既有 `stage-duration-mismatch`（门禁层）correction 测试保持通过，行为不回归。

## 4. 验证

- [ ] 4.1 `rtk npm run typecheck` 零错误。
- [ ] 4.2 定向 vitest：`src/lib/smart-lesson-plan/__tests__/`（worker/schema/provider-runtime/service）。
- [ ] 4.3 `openspec validate fix-smart-lesson-stage-duration-correction --type change --strict` 通过。
- [ ] 4.4 使用真实 Qwen3.5（siliconflow）完成一次修复后 smoke：既有失败阶段经 correction 通过或如实记录失败；不手动 retry/resume，不启动正式实验；结果记录进 Issue/PR。

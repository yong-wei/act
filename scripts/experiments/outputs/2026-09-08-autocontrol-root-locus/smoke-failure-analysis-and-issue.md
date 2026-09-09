# 智能备课 SMOKE 失败分析与 Issue 草稿

日期：2026-09-08

## 1. 问题定性

这是平台真实 SmartLesson 生成链路的稳定性问题，不是实验数据、网络连接或实验脚本造成的问题。

证据：

1. 三次 smoke 都完整走通任务创建、draft、generation job、worker、provider 调用与 schema 校验，失败发生在服务端校验阶段。
2. 失败可复现：r2/r3 在 ORIGINAL 和 CORRECTION 两次生成中都出现 `stage-step-duration-mismatch`，且分布于 OBJECTIVES、BRIDGE_IN 两个不同阶段。
3. 不能推论为整条链路不可用：OUTLINE 阶段稳定成功，r1 中部分 BOPPPS 阶段和一次 correction 曾成功。

更准确的表述：`Qwen/Qwen3.5-35B-A3B` 与当前 stage prompt、stage schema、correction 流程的组合，在 BOPPPS 具体阶段的时长求和约束上不稳定。

## 2. 三次 smoke 记录

| 冒烟 | task | draft | job | 失败阶段 | failureCode |
| --- | --- | --- | --- | --- | --- |
| SMOKE-r1 | a849099d-b776-4bc0-b062-070220290c15 | cmts8kto7000a6kvgt1fw5gmm | c20195af-1a9e-47c0-944a-6914dd82b048 | PARTICIPATORY_LEARNING | provider-AI_NoObjectGeneratedError |
| SMOKE-r2 | fe9cdaa1-0f96-4460-9d64-8d8bdfda4f96 | cmts952b4001f6kvgsn8gjdv5 | f0da8ab5-c4f3-45e8-9e46-b52d532ead8e | OBJECTIVES | provider-output-invalid-after-correction |
| SMOKE-r3 | 5b2fe945-38f9-4c2f-abf7-447c85335b12 | cmtsa6mha002v6kvgynwezi23 | 62b357c6-7e71-406e-aad6-ae7a6eed9617 | BRIDGE_IN | provider-output-invalid-after-correction |

三次 draft 均未进入 READY，job 均为 RETRYABLE，未执行 retry/resume。

## 3. 代码证据

1. `src/lib/smart-lesson-plan/schema.ts:96-112`：`createBopppsStageSchema` 要求 `steps` 分钟之和严格等于 `stage.minutes`，错误码为 `stage-step-duration-mismatch:实际值:期望值`。
2. `src/lib/smart-lesson-plan/worker.ts:176-246`：ORIGINAL 校验失败后构造 correctionRequest 并再次生成，二次校验仍失败则抛出 `provider-output-invalid-after-correction`。
3. `src/lib/smart-lesson-plan/worker.ts:588-606`：`buildCorrectionContext` 只对 `stage-duration-mismatch` 返回显式修正指令；对 `stage-step-duration-mismatch` 返回 null。correction 请求因此只有 validationErrors 与 JSON Schema，没有“steps 总和应等于多少”的明确指令。
4. `src/lib/smart-lesson-plan/provider-runtime.ts:85-94`：worker 会选择 provider models 中第一个 `enableThinking === false` 的模型，导致管理端 selectedModel 切换不生效。SMOKE-r3 名义上配置为 Qwen3.6，实际仍使用 Qwen3.5。
5. `src/lib/smart-lesson-plan/provider-runtime.ts:125,215,247`：temperature 固定为 0.1，失败不能用高随机性解释。
6. `src/lib/ai/provider-config.ts:15-17`：`AIModelRuntimeOptions` 只有 enableThinking，没有 temperature 配置位。

## 4. Issue 草稿

```markdown
标题：智能备课 BOPPPS stage 生成无法稳定通过 steps 时长求和校验，3 次 smoke 全部失败

问题描述：
真实 Provider 链路中，任务创建、draft、generation job、worker 调用均正常，
BOPPPS 具体阶段输出无法稳定通过 schema 校验。连续 3 次独立 smoke 全部失败，
正式实验不能启动。

复现步骤：
1. 启动 PostgreSQL、Redis、Next dev server 与 SmartLesson worker。
2. AI 配置：siliconflow / Qwen/Qwen3.5-35B-A3B，promptVersion=smart-lesson-plan.v1。
3. 输入：courseBasisId=cmt04kluy0000h4vg61gw7yf1、
   sourceVersionIds=[cmt04ks1z0002h4vg7ae7qq4e]、
   topic=根轨迹基础概念、durationMinutes=60、goal=GA1、
   outlineConfirmationRequired=false。
4. POST /api/teacher/smart-lesson-tasks 创建任务。
5. POST /api/teacher/smart-lesson-tasks/drafts/{draftId}/generation 启动 job。
6. 等待 worker 完成并轮询 draft/job 状态。
7. 独立创建 3 次，不手动 retry/resume。

实际结果：
- SMOKE-r1：PARTICIPATORY_LEARNING，ORIGINAL 未生成可解析对象，
  failureCode=provider-AI_NoObjectGeneratedError。
- SMOKE-r2：OBJECTIVES，ORIGINAL 与 CORRECTION 均为
  stage-step-duration-mismatch:3:5，failureCode=provider-output-invalid-after-correction。
- SMOKE-r3：BRIDGE_IN，ORIGINAL 与 CORRECTION 均为
  stage-step-duration-mismatch:4:8，failureCode=provider-output-invalid-after-correction。
- 三次 draft 均为 EDITABLE，job 均为 RETRYABLE，没有一次进入 READY。

期望结果：
完整 draft 达到 READY；BOPPPS 六阶段全部通过 schema 校验；
steps 分钟之和严格等于 stage.minutes，stage.minutes 与 OUTLINE 对应阶段时长一致。

初步原因分析：
1. schema 的时长求和是跨字段算术约束，当前模型对此类约束的遵循不稳定。
2. correction 对 stage-step-duration-mismatch 缺少显式修正指令，
   模型只能自行推断如何修改。
3. temperature 固定 0.1，不是随机性主导。
4. NoObjectGeneratedError 属于结构化输出偶发失败，应单独统计。
5. provider-runtime 的 preferredModel 覆盖使管理端 selectedModel 不生效。
```

## 5. 修复方向（不修改 schema）

优先级从高到低：

1. correction prompt 优化：为 `stage-step-duration-mismatch` 提供
   `expectedStageMinutes`、`actualStepsSum` 与明确修正指令。
2. stage prompt 增强：生成前显式自检 steps 求和、stage 与 outline 时长一致。
3. provider 参数与模型验证：先修复 preferredModel 覆盖问题，再真正验证 Qwen3.6；
   当前不能让 temperature 或 enableThinking 的结论先行。
4. schema 放宽：最后考虑，不建议作为默认修复，会削弱 BOPPPS 完整率指标的可解释性。

## 6. 实验可行性判断

不修复继续运行 13 次正式实验没有意义：无法获得完整 READY draft，BOPPPS 完整率、
输出差异距离和教师盲评都无法计算，只会产生失败率工程统计。

修复后建议 smoke 顺序：

1. 每项修复先执行 1 次同输入 smoke 作为门禁。
2. 门禁通过后同一输入连续 3 次 smoke 验证稳定性。
3. 补 1 次 90 分钟 smoke 覆盖时长变化。

以上均不计入正式统计。当前可用的技术报告指标仅限工程可靠性类：
任务创建成功率、OUTLINE 首轮通过率、stage ORIGINAL 首次通过率、
correction 恢复率、failureCode 分布、validation issue 类型分布、
attempt 耗时与 token 消耗。这些不能解释为教学效果提升。

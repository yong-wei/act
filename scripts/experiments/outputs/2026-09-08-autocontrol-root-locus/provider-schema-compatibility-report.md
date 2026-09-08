# 智能备课 SMOKE Provider/Schema 兼容性报告

日期：2026-09-08
实验标识：SL_EXP_2026_09_08_AUTOCONTROL_ROOT_LOCUS
状态：已停止，正式实验未启动

## 1. 结论

本次按授权执行了 SMOKE-r3 一次新的冒烟测试，结果为 FAILURE。

但是，SMOKE-r3 的全部 provider attempts 记录模型均为 `Qwen/Qwen3.5-35B-A3B`，并未使用切换后的 `Qwen/Qwen3.6-35B-A3B`。因此：

- Qwen3.6 的智能备课生成链路兼容性未得到验证；
- SMOKE-r3 不能作为“更换模型后兼容性测试”的有效证据；
- 正式实验未启动，也不应基于现有记录启动。

直接 API 模型测试中，`siliconflow + Qwen/Qwen3.6-35B-A3B` 返回 200 且成功生成文本，但这只说明模型连接可用，没有经过 SmartLesson worker 的 schema 校验链路。

## 2. 执行记录

| 冒烟 | task | draft | job | 首个失败 stage | failureCode |
| --- | --- | --- | --- | --- | --- |
| SMOKE-r1 | a849099d-b776-4bc0-b062-070220290c15 | cmts8kto7000a6kvgt1fw5gmm | c20195af-1a9e-47c0-944a-6914dd82b048 | PARTICIPATORY_LEARNING | provider-AI_NoObjectGeneratedError |
| SMOKE-r2 | fe9cdaa1-0f96-4460-9d64-8d8bdfda4f96 | cmts952b4001f6kvgsn8gjdv5 | f0da8ab5-c4f3-45e8-9e46-b52d532ead8e | OBJECTIVES | provider-output-invalid-after-correction |
| SMOKE-r3 | 5b2fe945-38f9-4c2f-abf7-447c85335b12 | cmtsa6mha002v6kvgynwezi23 | 62b357c6-7e71-406e-aad6-ae7a6eed9617 | BRIDGE_IN | provider-output-invalid-after-correction |

三次 job 均未进入 READY，draft state 均为 EDITABLE，job state 均为 RETRYABLE。

### 2.1 attempt 明细与校验回执

SMOKE-r1：

| attempt | stage | kind | outcome | model | validationReceipt |
| --- | --- | --- | --- | --- | --- |
| cmts8n9ta000u6kvgrmh234zb | PARTICIPATORY_LEARNING | ORIGINAL | RETRYABLE_FAILURE | Qwen/Qwen3.5-35B-A3B | null，模型未生成可解析对象 |

SMOKE-r2：

| attempt | stage | kind | outcome | model | validationReceipt |
| --- | --- | --- | --- | --- | --- |
| cmts95tbu001w6kvgvskg4v4x | OBJECTIVES | ORIGINAL | RETRYABLE_FAILURE | Qwen/Qwen3.5-35B-A3B | stage-step-duration-mismatch:3:5 |
| cmts95zgk001x6kvgl2uq7q0q | OBJECTIVES | CORRECTION | RETRYABLE_FAILURE | Qwen/Qwen3.5-35B-A3B | stage-step-duration-mismatch:3:5 |

SMOKE-r3：

| attempt | stage | kind | outcome | model | validationReceipt |
| --- | --- | --- | --- | --- | --- |
| cmtsa7138003b6kvg84esoez7 | BRIDGE_IN | ORIGINAL | RETRYABLE_FAILURE | Qwen/Qwen3.5-35B-A3B | stage-step-duration-mismatch:4:8 |
| cmtsa7dks003c6kvgppch987c | BRIDGE_IN | CORRECTION | RETRYABLE_FAILURE | Qwen/Qwen3.5-35B-A3B | stage-step-duration-mismatch:4:8 |

`stage-step-duration-mismatch:X:Y` 的含义见 `src/lib/smart-lesson-plan/schema.ts` 第 103-112 行：`X` 为 steps 分钟之和，`Y` 为 stage.minutes。

## 3. 输入一致性

三次 smoke 使用以下输入：

- topic：根轨迹基础概念（r1 文案带“冒烟验证”后缀，r2/r3 为纯主题）
- goal：GA1，内容为“掌握根轨迹基本概念，能够根据开环零极点判断根轨迹起点、终点及实轴分布”
- durationMinutes：60
- sourceVersionIds：cmt04ks1z0002h4vg7ae7qq4e
- courseBasisId：cmt04kluy0000h4vg61gw7yf1
- promptVersion：smart-lesson-plan.v1
- schemaVersion：按 stage 使用 smart-lesson-outline.v1 或 smart-lesson-boppps-*.v1

## 4. 根因一：selectedModel 被 provider-runtime 覆盖

当前管理端 AI 设置显示：

- activeProvider: siliconflow
- selectedModel: Qwen/Qwen3.6-35B-A3B

但 `src/lib/smart-lesson-plan/provider-runtime.ts` 第 85-94 行会在 worker 中再次选择模型：

```ts
const provider = settings.providers.find((candidate) => candidate.id === selectedConfig.provider);
const preferredModel = provider?.models.find((model) => model.options?.enableThinking === false)?.model;
config = preferredModel && preferredModel !== selectedConfig.model
  ? await resolveConfig(selectedConfig.provider, preferredModel, ...)
  : selectedConfig;
```

当前 `siliconflow.models` 顺序为：

1. Qwen/Qwen3.5-35B-A3B，options.enableThinking = false
2. Qwen/Qwen3.6-35B-A3B，options.enableThinking = false

`.find()` 总是命中第一个 Qwen3.5，所以 worker 实际使用 Qwen3.5，与通过管理 API 保存的 selectedModel 无关。

## 5. 根因二：BOPPPS stage 时长约束未满足

校验代码：

- `src/lib/smart-lesson-plan/schema.ts` 第 96-112 行：要求 steps 分钟之和等于 stage.minutes。
- `src/lib/smart-lesson-plan/worker.ts` 第 580-585 行：parse 后再校验 stage.minutes 与 outline 期望值一致。

三次 smoke 的失败点：

- r1：模型未生成可解析对象（PARTICIPATORY_LEARNING）。
- r2：OBJECTIVES 原始和修正输出均违反 step 分钟之和约束。
- r3：BRIDGE_IN 原始和修正输出均违反 step 分钟之和约束。

这说明当前问题不仅是“换模型”，而是 provider 输出不能稳定通过 BOPPPS stage schema 的时长/结构约束。

## 6. 数据库与原始数据证据

已保存：

- scripts/experiments/outputs/2026-09-08-autocontrol-root-locus/progress.json
- scripts/experiments/outputs/2026-09-08-autocontrol-root-locus/smoke_raw.json
- scripts/experiments/outputs/2026-09-08-autocontrol-root-locus/smoke-chain-5b2fe945-38f9-4c2f-abf7-447c85335b12.json
- scripts/experiments/outputs/2026-09-08-autocontrol-root-locus/ai_provider_settings_before_provider_change.json

数据库依据：

- SmartLessonTask
- SmartLessonGenerationJob
- SmartLessonGenerationStage
- SmartLessonProviderAttempt（model、validationReceipt、outcome）
- SmartLessonDraft

本次没有创建正式实验任务，没有 retry/resume 失败 job，没有删除异常记录，没有写数据库。

## 7. 建议

1. 当前状态不能进入正式实验。
2. 如果希望真正验证 Qwen3.6，需要在 AI provider 配置层面让 Qwen3.6 成为 preferredModel（例如调整 models 顺序或 enableThinking 配置），再执行一次新 smoke。这属于配置修改，需用户明确授权。
3. 不授权配置修改则停止实验，并可恢复原 selectedModel 为 Qwen/Qwen3.5-35B-A3B。
4. 现有记录不足以证明任何模型满足智能备课生成链路，也不能用于 PPT 效果结论。

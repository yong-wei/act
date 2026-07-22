# 2026-07-22 根轨迹真实 Provider 验证记录

## 结论

本记录验证了本地已认证环境中的真实外部 Provider 路径，未使用确定性 fixture、测试 provider 或既有课件备份。Konling 自然语言创建、歧义澄清、后续约束修订、普通课程依据导入和教师确认均完成；教案生成在 `OUTLINE` 阶段连续三次由同一真实 Provider 重试后进入 `RETRYABLE`，因此静态/浏览器回执、发布、目录、课堂和学生交互没有执行。不得将本记录作为 task 3.2 已完成或真实 Provider P0 闭环完成的证据。

“45 分钟”指已确认课程时长，不表示本次运行的实际墙钟时长。

## 环境与边界

- 日期：2026-07-22（Asia/Shanghai）。
- 环境：本地已认证开发环境，独立 Redis 前缀 `act-941-real-provider-20260722`；不是竞赛网络现场。
- Provider：`siliconflow`，`openai-compatible`，模型 `deepseek-ai/DeepSeek-V4-Flash`。
- 凭据、Cookie、Authorization header、原始 Provider trace 和学生答案正文均未记录。
- `SMART_LESSON_E2E_FIXTURE_TOKEN` 与 `SMART_COURSEWARE_E2E_FIXTURE_TOKEN` 在运行进程中均未设置。
- 备份 revision：未使用。

## 已验证链路

| 阶段 | 可核验记录 | 结果 |
| --- | --- | --- |
| 普通课程依据导入 | 已确认 source version `cmrvw9gri001r1uyfsgb5nzt7` | 通过 |
| 三项权威表述 | 相角条件、幅值条件、基本绘图规则进入任务知识点 | 通过 |
| Konling 歧义澄清 | tool run `cmrvwafz600201uyfs9ebzwcm`，bootstrap clarification，2026-07-22T09:43:39.618Z | 通过 |
| Konling 创建建议 | tool run `cmrvwdtlm00291uyfmzs2lifo`，bootstrap proposal，已由教师确认 | 通过 |
| 后续约束修订 | tool run `cmrvxbqrz000dl8yfq3rzozci`，revise proposal，已由教师确认 | 通过 |
| 修订内容 | 目标中保留“至少20分钟参与式学习”，并要求可执行判断活动 | 通过 |
| 教师确认 | 任务 revision 3；`scopeConfirmedAt` 与 `goalsConfirmedAt` 均已写入 | 通过 |
| 真实 Provider 教案生成 | job `c9d63850-f12d-4b8d-a547-d011ee027204`，OUTLINE | 未通过，见下文 |

任务的最终知识点包含“相角条件”“幅值条件”“基本绘图规则”“绘图规则实操应用”。修订后的目标明确要求学生在至少 20 分钟参与式学习中完成根轨迹走向、相角条件或幅值条件的可执行判断活动。

## 阻断证据

教案任务于 2026-07-22T10:19:02.042Z 创建。OUTLINE 阶段使用真实 Provider 运行至 2026-07-22T10:31:02.493Z 后进入 `RETRYABLE`，任务 failure code 为 `provider-Error`。该阶段的脱敏 audit 摘要如下：

| serviceId | providerKind | model | outcome |
| --- | --- | --- | --- |
| siliconflow | openai-compatible | deepseek-ai/DeepSeek-V4-Flash | RETRYABLE_FAILURE |

在 OUTLINE 没有有效输出前，继续教案阶段、课件生成、来源缺口逐项确认、静态回执、浏览器回执、发布、目录投影、课堂启动和学生交互都没有可如实记录的成功结果。本次未改用 fixture 或预生成 revision 规避失败。

## 已执行的本地验证

```bash
rtk npx vitest run src/lib/__tests__/konling-agent-runtime.test.ts
rtk npx vitest run src/app/api/teacher/smart-lesson-tasks/__tests__/route.test.ts
rtk npx tsc --noEmit --pretty false
```

上述验证通过；它们验证了任务建议 schema、约束修订投影和教师确认语义，不替代本记录中失败的真实 Provider 生成。

## 恢复条件

在已配置 Provider 能完成 OUTLINE 后，以新的真实 Provider 运行重新执行本记录未完成的生成、双回执、发布、目录、课堂和学生交互步骤；随后再记录三项内容对照、零未确认来源缺口和最终化证据。只有该后续运行成功时，才能勾选 task 3.2。

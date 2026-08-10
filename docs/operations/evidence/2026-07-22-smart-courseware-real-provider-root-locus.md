# 2026-07-22 根轨迹真实 Provider 验证记录

## 结论

认证本地环境已完成一条不使用 fixture、测试 provider、备份 revision 或预生成课件的真实 Provider 闭环：Konling 创建与确认、普通课程依据导入、教案、六阶段课件、静态和浏览器回执、发布、目录投影、课堂绑定及学生互动均已落库。

此前 `OUTLINE` 三次重试后仍为 `RETRYABLE` 不是教案 schema 或任务内容无法生成：旧配置的 `deepseek-ai/DeepSeek-V4-Flash` 对完整 OUTLINE 请求每次均在 240 秒 cURL 时限内零字节返回，worker 将该网络超时统一标作 `provider-Error`。切换到同一真实服务的 `Qwen/Qwen3.6-35B-A3B` 后，原教案 job 的 OUTLINE 及其余阶段均完成；本次修复将该类超时归类为 `provider-timeout`，并修正课件非互动阶段误带 `teacherActivityEvidence` 时被误判为永久失败的问题。

“45 分钟”是已确认的课程时长，不是本次验证的墙钟时长。

## 环境与边界

- 日期：2026-07-22（Asia/Shanghai）。
- 环境：本地已认证开发环境，独立 Redis 前缀 `act-941-real-provider-20260722`；不是竞赛网络现场。
- 真实服务：`siliconflow`、`openai-compatible`；成功运行模型为 `Qwen/Qwen3.6-35B-A3B`。
- `SMART_LESSON_E2E_FIXTURE_TOKEN` 与 `SMART_COURSEWARE_E2E_FIXTURE_TOKEN` 均未设置；不记录凭据、Cookie、Authorization header 或原始 Provider trace。
- 旧的已发布课件 revision `bfcf6a74-38f9-452f-8525-7f00b6a17116`、publication `c9dec6bc-b8e8-4d1a-ac01-ee1ffbe30961` 是此前生成的版本。其互动选项标签曾仅为 `A`/`B`，不作为本记录的内容质量或发布闭环证据。

## 原阻断及恢复

教案 job `c9d63850-f12d-4b8d-a547-d011ee027204` 的 OUTLINE 于 2026-07-22T10:19:02.105Z 运行旧模型 `deepseek-ai/DeepSeek-V4-Flash`，在 2026-07-22T10:31:02.493Z 结束为 `RETRYABLE_FAILURE`。脱敏运行记录显示，同一完整请求的三次传输均在 240,000 ms 后零字节返回；因此旧 failure code `provider-Error` 实际表示供应商传输超时，而非结构化输出被拒绝。

将真实服务模型改为 `Qwen/Qwen3.6-35B-A3B` 后，同一 job 的 OUTLINE 于 2026-07-22T11:15:37.852Z 至 11:15:48.101Z 成功，随后全部 BOPPPS 阶段完成。后续课件 job `abdab336-d68e-4c4e-b464-12374df37ae1` 的六个 unit 均使用该真实模型完成；其中 objective 的前两次失败暴露了非互动阶段附带的无消费教师证据被错误拒绝，修复后第三次成功。

## 已验证链路

| 阶段 | 可核验记录 | 结果 |
| --- | --- | --- |
| 普通课程依据导入 | source version `cmrvw9gri001r1uyfsgb5nzt7` | 通过 |
| Konling 歧义澄清 | tool run `cmrvwafz600201uyfs9ebzwcm`，2026-07-22T09:43:39.618Z | 通过 |
| 创建与约束修订 | tool runs `cmrvwdtlm00291uyfmzs2lifo`、`cmrvxbqrz000dl8yfq3rzozci`；任务 revision 3 已确认 | 通过 |
| 真实 Provider 教案 | job `c9d63850-f12d-4b8d-a547-d011ee027204` | 全阶段完成 |
| 真实 Provider 课件 | draft `a22eb81b-61e0-4efd-b1ab-140f4babaf22`，job `abdab336-d68e-4c4e-b464-12374df37ae1` | 六个 unit 完成 |
| 不可变课件 revision | `e32b4beb-3bea-40ad-8f90-c1d6e533b78e`；manifest `sha256:f966f07a3d497e58c686a69b720af307b09d360bbf0446fe809b9233ffcdbd7c` | 通过 |
| 静态回执 | `c350c75a-d5e2-4b81-9255-e5d6db6031cd` | 通过 |
| 浏览器回执 | `6dccaa5c-37b9-43a5-91e4-814d0c1458f8`；student、teacher 两个投影 | 通过 |
| 发布与目录投影 | publication `3e502daf-a188-4fd5-85b9-5e32acc47437`，第 2 版 | 通过 |
| 课堂与学生互动 | session `cmrw32wvy0000hxyfrnhk3adp` 精确绑定该 publication 与 manifest | 通过 |

发布前检查显示三个教师创建目标的既有缺口均有此前人工决策对应的有效 acknowledgement；没有未确认的目标或模块来源缺口，且不存在 stale plan。

## 三项内容对照

| 导入依据 | 不可变 manifest 中的对应内容 | 结果 |
| --- | --- | --- |
| 相角条件：根轨迹点的开环相角为奇数倍 180 度 | 前测和后测互动题的完整选项写明 `开环传递函数相角等于 (2k+1)180度` | 一致 |
| 幅值条件：用于计算指定根轨迹点的增益 | objectives 明确“利用幅值条件计算指定根轨迹点对应的增益值” | 一致 |
| 基本绘图规则：分支起于开环极点并终止于开环零点或无穷远 | 参与式学习题的完整选项写明“根轨迹起始于开环极点，终止于开环零点或无穷远处” | 一致 |

三个互动模块均有服务端写入的教师答案、解释、评分元数据；学生可见的选项标签是可独立判别的完整答案文本，未使用 `A`/`B` 占位标签。

## 课堂和学生证据

教师通过实际 `/api/session` 创建课堂，返回的 `coursewarePublicationRevisionId` 与 `manifestHash` 分别精确等于 publication `3e502daf-a188-4fd5-85b9-5e32acc47437` 与上述 manifest。学生经实际 NextAuth 登录后调用 `/api/session/join`，获得 `ready-to-enter`；随后实际调用课堂 state 与互动 events 入口。

- `StudentState`：`cmrw32xen0001hxyf7ml6idw3`；
- `StudentStepResponse`：`cmrw32xhh0003hxyf1ydoe3ir`；
- 该响应的服务端 `sourceLogId`：`cmrw32xhe0002hxyfv0eljl30`。

这证明发布版本的目录投影、课堂精确绑定、学生进入、状态写入和互动证据写入共同成立。

## 本地验证

```bash
rtk npx vitest run --config src/lib/smart-courseware/vitest.config.ts \
  src/lib/smart-courseware/__tests__/provider-runtime.test.ts \
  src/lib/smart-courseware/__tests__/worker.test.ts \
  src/lib/smart-courseware/__tests__/publication-service.test.ts
rtk npx vitest run --config src/lib/smart-lesson-plan/vitest.config.ts \
  src/lib/smart-lesson-plan/__tests__/schema.test.ts \
  src/lib/smart-lesson-plan/__tests__/worker.test.ts
rtk npx tsc --noEmit
```

上述测试及真实 Provider、双回执和实际 HTTP 课堂链路均通过。fixture 证据与此前生成 revision 均未替代本记录的真实 Provider 结果。

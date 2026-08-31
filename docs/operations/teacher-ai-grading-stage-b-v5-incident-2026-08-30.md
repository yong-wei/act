# 阶段 B V5 视觉证据运行事件记录

## 范围

本记录只覆盖阶段 B V5 的受控运行状态、恢复动作和安全错误分类。没有读取、导出或写入学生原始作答、证据正文、PDF 或 AI 原始输出。

## 冻结身份

- 配置：`experiment-config:1a1777643ba053db080c75dc7c368d02`
- 调优批次：`experiment-batch:14940002de16a5daac4dc62115e1b487`
- 调优幂等键：`t2-formal-first-round-20260813-stage-b-v5-visual-tuning-force-completion`
- 隐藏验收幂等键：`t2-formal-first-round-20260813-stage-b-v5-visual-hidden-force-completion`
- 评分重试策略：`until-valid-result`
- 证据链：`visual-evidence`，逐页 PDF 视觉描述与文本证据合并
- 隐藏验收状态：`SEALED`；本记录形成时尚未启动隐藏验收。

## 现象与证据

V5 初始运行后，调优批次出现大量排队任务但执行完成数长期缓慢增长。聚合状态表明，视觉证据转换是主要瓶颈；可重试安全错误码包括：

- `provider-timeout`
- `failed-after-3-attempts.-last-error-internal-server-error`
- `failed-after-3-attempts.-last-error-cannot-connect-to-api-other-side-closed`
- `no-output-generated.`
- `visual-description-output-invalid-description`
- `teacher-ai-grading-controlled-visual-evidence-limitations`

这些均发生在视觉描述或视觉证据转换阶段。没有观察到终态评分失败；已成功执行均带有 `COMPLETE` 的视觉证据状态。

运行时发现同一幂等批次被两个独立的本地 worker 同时消费。核心 `drainBatch` 实现为单 worker 串行领取任务，因此这构成了非预期并发，放大了不稳定视觉 Provider 的超时与连接关闭概率。

## 已执行的恢复

1. 已停止重复 worker，仅保留一个 V5 调优 worker；没有创建新的 batch 或 config。
2. 已对同一批次执行过期租约回收。回收将遗留 `RUNNING` execution 标记为可重试，并保留安全错误码 `worker-lease-expired`；不修改评分、批注、原始输出或冻结配置。
3. 后续恢复必须继续使用上述同一幂等批次和 `until-valid-result` 策略。若发现新的过期 `RUNNING` 租约，先执行安全租约回收，再由现存单 worker 继续领取。

## 约束与后续判断

V5 的模型、视觉策略、输出契约及处理器版本均已冻结。不得在该批次中途替换视觉 Provider、放宽 `limitations` 失败关闭语义或改写视觉描述契约，然后将结果声称为同一冻结实验。

负责人已明确要求对同一 V5 批次按 `until-valid-result` 持续重试。因此单 worker 必须继续恢复可重试 execution，直至取得有效结果；不得将超时转换为终态失败。任何替代方案仍必须新建冻结配置，记录新的处理器与视觉策略版本，并取得负责人对新增运行与预算的明确授权。隐藏验收在调优执行尚未全成功前保持 `SEALED`。

## 生成接口连通性复核

为区分本地队列故障与外部服务故障，已对冻结视觉策略绑定的同一端点和模型执行不含学生作答内容的最小连通性检查：

- `GET /models` 在约 1.2 秒内返回 `2xx`，说明认证、基础网络与证书链可用。
- 最小非流式 `POST /chat/completions` 在 15 秒内未返回。
- 最小流式 `POST /chat/completions` 在 15 秒内未返回。
- 经正式视觉运行时适配器发送的 1 像素图像请求在 60 秒内未返回。

因此，V5 的阻塞点是冻结模型的生成接口未返回响应，不是作答内容、视觉 PDF 转换、评分 JSON 契约、限流阈值或本地租约调度。继续重试不会丢失 execution，但只有该生成接口恢复后才会产生新的有效评分。恢复后必须继续使用同一冻结配置和同一批次；若改用其他端点、协议或模型，必须建立新的冻结配置和独立批次。

## 模型级对照复核

为检验该故障是否覆盖整个 Provider，而非仅限冻结模型，使用合成提示词与合成图片进行了不含作答内容的模型级对照：

- 当前 V5 冻结的视觉模型对纯文本最小请求在 20 秒内超时；附带合成图片并显式关闭思考模式后仍在 20 秒内超时。
- 同一 Provider 的另一已登记视觉模型可在约 3.4 秒内完成纯文本最小请求。1 像素合成图片被该模型拒绝为 `400`，但 128×128 合成 PNG 在约 3.3 秒内完成；通过正式 `describeVisualEvidence` 路径时也产生了满足结构化契约、页码绑定正确的结果。
- 另一已登记的视觉候选对合成图片请求在内部重试后返回服务端错误。

这证明问题不是样本分布或“后半批作业”造成的随机失败：当前冻结模型的生成路径不可用。另一个视觉模型已形成合成输入上的完整运行时契约证据，但仍须以真实分区上的独立冻结配置验证，不能静默替换进 V5。

## V6 独立恢复运行

负责人于 2026-08-30 授权以已验证的替代视觉模型建立独立实验。该动作不修改 V5，也不将 V5 的执行、视觉证据或聚合指标写入新配置：

- V6 配置：`experiment-config:4c0a30f876dc8d6369d0a747aaa453cd`
- V6 调优批次：`experiment-batch:157c0ee387bdd669b0fe641bfbcd4c71`
- 视觉策略：已登记的 8B 视觉策略；评分策略保持既有冻结的量规评分模型。
- 调优批次使用唯一幂等键与 `until-valid-result` 重试策略；只运行一个 worker。
- 隐藏验收保持 `SEALED`，仅在 336 条调优 execution 全部成功后才允许一次性启动 144 条隐藏 execution。

启动后的聚合状态只记录成功数、可重试数与安全错误码。初始运行同时出现成功视觉证据和 `provider-timeout`，没有终态失败；因此继续在同一 V6 批次重试，而不将暂时超时当作样本质量或结构化评分失败。

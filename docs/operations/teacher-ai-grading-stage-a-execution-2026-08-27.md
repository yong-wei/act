# 阶段 A 真实闭环执行记录

日期：2026-08-27

## 范围与安全边界

本记录只保存匿名运行状态、错误类别、版本和校验摘要，不保存学生身份、答题正文、凭据或本地敏感路径。固定隐藏集仍为 `SEALED`，未读取、未运行、未揭示。

## 已验证

- 专用 revision 已发布；三个匿名受控学生各提交四题，共 12 份 DOCX。
- 12 份文件均完成预签名上传、可信扫描、最终确认和按题提交；每名学生的四题 attempt vector 完整。
- 首轮四个题目批次已创建并保留；失败项按受控接口执行一次重试，首次与后续记录均保留。
- 修复本地 MinIO 凭据后，12 个提交对象均可读取；LibreOffice 控制台入口返回版本 `26.2.5.2`。
- 转换链已为 12 份题目生成 Markdown 与规范 PDF；转换状态为 `SUCCEEDED` 或 `FALLBACK`，对应对象与视觉证据记录已持久化。
- 新增转换防护：同一转换内按图片校验和去重视觉证据，避免数据库唯一约束冲突；定向转换/视觉回归 17 项通过。

## 阻断结果

- 使用带视觉策略的受控重跑后，12 个 AI 批改项未全部形成可发布结果：部分运行因 `visual-evidence-incomplete` 被阻断，部分因 Provider 超时处于 `RETRYABLE`。
- 当前没有 12 份完整独立 AI 分数、扣分批注和总体评价，因此未执行教师确认、逐份发布、学生结果读取或 12 份批注 PDF 下载。
- 已产生的批次、转换、重试、GradingRun 和失败原因均保留，未覆盖或从统计分母删除。

## 门禁结论

`G.8=FAIL`。阶段 A 真实闭环尚未完成，不得勾选 A.1–A.5，不得启动阶段 B 或隐藏验收。后续恢复必须先解决视觉证据就绪契约与 Provider 超时/重试问题，再重新执行未完成环节。

## 独立只读复审裁定

- `ACCEPT`：视觉证据按图片校验和去重后再上传和持久化，满足同一转换的唯一约束，且上传对象键与持久化行保持同序。
- `DEFER`：尚未补充“同一转换重复图片校验和”的直接回归测试；当前实现与定向测试无已证实阻断，后续补测。
- `ACCEPT`：G.8 失败状态与数据库批次、GradingRun 和运行记录一致，未将未完成结果标记为通过。
- `ACCEPT`：阶段 A 仅使用 TUNING 样本和受控账号；隐藏集保持 `SEALED`，未发现敏感数据写入仓库。
## 2026-08-27 续记

- 完成视觉证据去重回归、PDF 附件过滤、视觉 JSON 输出与独立超时修复；相关定向回归 `85/85`，教师实验室/发布回归 `13/13`，类型检查通过。
- 发现并取消一轮误覆盖历史批次的 36 个未执行重试请求；16 个已耗尽项保持 `BLOCKED`。脚本已收窄为最新视觉批次且 `retryCount < 2`。
- 受控重试仅调度 8 个候选项；运行仍出现 Provider 超时或连接中断，尚未形成完整 12/12 AI 结果。因此教师确认、发布、学生读取和 PDF 下载均未执行。
- `G.8` 继续为 `FAIL`；不启动阶段 B，不读取或运行隐藏集。

## 2026-08-28 O2 v32 受控重试结果

- 12/12 提交对象 HEAD 校验通过且扫描状态为 `CLEAN`；仅执行 O2 最新批次 `grading-batch:c47a78fd-db78-47a3-89bb-c1e8a8f6ea85`，未重放历史 `RERUN`。
- 首次 v32 完成 2/3，剩余项因 `unsafe-overall-feedback-internal-term` 进入 `RETRYABLE`。复盘确认该问题来自总体评价输出契约，非对象存储、转换或租约问题。
- 增加最小确定性学生可见总体评价回退：只有评分项、分值、扣分批注、证据锚点等其余校验全部通过时才启用；不放宽安全过滤器，不计入旧失败结果，不覆盖旧运行。
- 同一失败项通过显式 `RETRY` 重跑后成功；O2 为 `3/3`，四题最新批次合计 `12/12`，所有运行均为 `AWAITING_REVIEW`，量规 Provider 为 `siliconflow / Qwen/Qwen3.5-35B-A3B`，视觉策略未漂移。
- 回归验证：评分管线 `46/46`，`npm run typecheck` 通过。教师确认、逐份发布、学生结果读取、12 份 PDF 下载与逐页视觉核验仍未执行；因此 `G.8` 暂不变更。

## 2026-08-28 最新只读复核与重试遗留

- 只读逻辑项汇总确认四题最新批次均为 `SUCCEEDED`，合计 `12/12`，每项最新 `GradingRun` 均为 `AWAITING_REVIEW`；量规 Provider 固定为 `siliconflow / Qwen/Qwen3.5-35B-A3B`，视觉 Provider/模型未漂移。
- 关联作业中仍可见少量历史 `QUEUED RETRY`，但没有正在运行的阶段 A grading worker；本次未消费、未改写状态，也未将这些遗留作业计入成功结果。
- 失败后的决定：在处理遗留 `QUEUED RETRY` 前，不启动无范围重试执行器；优先使用受支持的取消/封存领域路径，无法使用时保持 worker 停止并将该事实纳入 G.8 审计证据。不得直接数据库写入绕过门禁。
- 教师确认、逐份发布、学生读取和 12 份 PDF 下载/逐页视觉核验尚未执行，`G.8` 继续为 `FAIL`。

## 2026-08-28 O2 显式 RETRY 复盘

- 12 个提交对象的 HEAD 检查全部通过，扫描状态均为 `CLEAN`；本轮凭据仅通过进程环境注入。
- 仅执行 O2 每个逻辑项最新的三个 `RETRY` 作业，未消费历史 `RERUN`。量规 Provider 固定为 `siliconflow / Qwen/Qwen3.5-35B-A3B`。
- 三项仍为 `RETRYABLE`，最新运行没有 Provider 请求，持久化历史错误仍以 `unsafe-overall-comment` 为主；本轮不能计入独立 AI 成功结果。
- `G.8` 保持 `FAIL`，教师确认、发布、学生读取、批注 PDF 下载、阶段 B 和隐藏验收继续禁止。

## 2026-08-28 O2 输出契约复盘

- `v26` 单项重试在 12/12 HEAD 与 `CLEAN` 门禁通过后仍为 `RETRYABLE`，持久化原因明确为 `unsafe-overall-comment` 与 `unsafe-overall-feedback`。
- 收窄中文“模型”误判后，`v27` 仅剩反馈内部术语；`v28` 的细分结果为 `unsafe-overall-comment-internal-term` 与 `unsafe-overall-feedback-internal-term`，未发现敏感 token 类错误。
- 同一失败类别重复出现，停止无边界局部重试；不放宽安全过滤器、不改写模型正文、不把失败项从分母删除。
- 当前有效独立结果为 9/12，O2 为 0/3；`G.8=FAIL`。需先冻结并审查新的总体评价输出策略，再继续阶段 A。

## 2026-08-28 验证命令复盘

- `npm run typecheck` 通过；默认 `npm test` 的评分相关前置测试通过。
- 默认测试脚本随后进入商业 UI 治理门禁并失败，报告的是当前未完成的 UI 路由登记、设计 token 和视觉验收证据，不是本次评分持久化修复的失败。
- 失败后的决定：保留该验证失败，不修改无关 UI；改用定向 Vitest 验证评分持久化与输出契约。

## 2026-08-28 只读复核

- 最新匿名汇总确认量规 Provider 为 `siliconflow / Qwen/Qwen3.5-35B-A3B`，视觉 Provider 为 `siliconflow / Qwen/Qwen3-VL-8B-Instruct`，未发生配置漂移。
- `v19` 形成 `6/12` 个 `AWAITING_REVIEW`：T2-1 为 `3/3`、T2-2 为 `2/3`、T2-3 为 `1/3`、O2 为 `0/3`。其余项分别保留 `annotation-without-deduction`、`provider-timeout`、`provider-no-output-generated` 与 `unsafe-overall-comment` 失败记录。
- O2 的过期 `RERUN` 租约已通过 `recoverMathDocumentGradingQueue` 恢复为可调度项，并按该项的 `batchItemId` 受控执行；执行未产生 Provider 结果，而以 `object-store-head-failed` 结算为失败。
- 失败经验结论：评分输出契约、租约恢复和对象存储可读性是独立门禁。不得放宽 schema、直接改写评分，或在对象存储认证未恢复前反复调度 Provider。`G.8=FAIL`，教师确认、发布、学生读取、PDF 下载、阶段 B 和隐藏验收继续禁止。
## 2026-08-27 诊断脚本与受控转换续记

- 已收敛 `scripts/ops/debug-stage-a-job.ts`：仅解析最新已发布 `stage-a:T2S-20:*` revision，并输出匿名作业/转换状态计数；不加载或输出 submission、answer、asset、evidence、policy、模型输出、身份或关联 ID。
- 脚本实际聚合结果：`jobCount=72`，作业状态 `BLOCKED=12 / SUCCEEDED=54 / RETRYABLE=4 / RUNNING=2`；转换状态 `BLOCKED=12 / FALLBACK=40 / SUCCEEDED=14 / RETRYABLE=4 / RUNNING=2`。
- 受控转换续跑在超过约定等待窗口后未产生状态变化，已停止卡住进程；未修改历史批次、未创建新重试请求。`G.8` 继续为 `FAIL`，不得执行教师确认、发布、学生读取、PDF 下载或阶段 B。
## 2026-08-27 当前阻断根因

- 本地环境为 Windows；`npm run startup` 调用 Unix `scripts/ops/start.sh`，在 PowerShell 中因 `.` 命令不可识别而未能启动服务。
- 直接启动 `scripts/workers/data-governance-worker.ts` 时，worker 配置预检明确报告缺少：`GRADING_AI_PROVIDER_ENABLED`、`GRADING_MATHPIX_ENABLED`、`GRADING_MATHPIX_POLICY_VERSION`、`MATHPIX_DOCUMENT_ENDPOINT`、`MATHPIX_IMAGE_ENDPOINT`、`REDIS_URL`。
- 因 worker 未启动，阶段 A 队列无法继续消费；此前 Provider timeout 是未完成运行的表现。未修改数据库、未读取隐藏集。
## 2026-08-27 环境恢复复核

- 补齐非敏感 worker 配置并将数据库连接临时指向本地 `5433` 后，数据治理 worker 能够启动。
- 阶段 A 转换续跑随即暴露对象存储阻断：`stage-a-s3-check.mjs` 返回 `ECONNREFUSED 127.0.0.1:9000`，转换记录为 `object-store-head-failed`。本地 MinIO/S3 服务未运行；未切换到 memory store，避免丢失既有提交对象或破坏正式对象存储契约。
- worker 已停止，未继续无效重试；阶段 A 仍未形成 `12/12` AI 结果，`G.8` 保持 `FAIL`。

## 2026-08-28 续行重试记录

- 量规 Provider 已核验为 `siliconflow / Qwen/Qwen3.5-35B-A3B`；视觉描述仍使用冻结的 Qwen3-VL 策略。未修改 Provider 公共契约、量规或人工基准。
- `v11` 执行器曾长时间停留在 `RUNNING`，已停止；未覆盖旧结果。`v12` 的 12 项全部因 MinIO 访问密钥失效而报 `object-store-head-failed`，通过本地 S3 健康检查复现。
- MinIO 进程实际使用本地开发凭据；在命令级注入有效凭据后 S3 健康检查通过。未将凭据写入代码、提交或运行记录。
- `v13` 形成 `1/12` 个 `AWAITING_REVIEW`，`v14` 形成 `2/12` 个；其余失败主要为 `unsafe-overall-comment`、`provider-timeout`、`score-max-mismatch`、`score-total-overflow`、`deduction-annotation-missing` 和 `overallFeedback.problems` schema 不满足。
- `v14` 单项重试入口创建 11 个 `RETRY` 作业。旧入口错误地同时扫描 `RERUN`，导致部分项出现 `batch-frozen-evidence-version-mismatch`；已修复为仅处理 `RETRY`，并支持显式 `STAGE_A_RETRY_JOB_IDS`。
- `v15` 使用新批次身份重新冻结证据；T2-1、T2-2、T2-3 仍未形成完整结果，O2 有一个长请求触发 `batch-worker-fenced`。当前不能宣称 `12/12`。
- 当前累计证据仍禁止教师确认、逐份发布、学生读取、PDF 下载、阶段 B 和隐藏验收。未通过直接数据库写入绕过门禁。

## 2026-08-28 当前审核裁定

- `ACCEPT`：保留 `v11`–`v15` 的真实批次、Provider 错误、租约错误和失败原因，不从分母删除失败项。
- `ACCEPT`：MinIO 凭据问题与模型输出契约问题分开记录；修复对象存储后才重新运行 Provider 批次。
- `ACCEPT`：`RERUN` 不得在证据版本变更后重放；重试执行器只处理明确创建的 `RETRY` 作业。
- `DEFER`：模型输出约束失败的进一步提示词或 Provider 调优，需在不放宽评分门禁的前提下另行设计和审查。
- 结论：`G.8=FAIL`，阶段 A 未完成。

## 2026-08-28 O2 租约恢复与对象存储认证阻断

- 恢复入口只允许指定阶段 A 作业；空候选时不再调用全局恢复扫描。审计确认本次恢复只重新入队 O2 的过期 `RERUN`。
- O2 单项受控执行确认当前对象存储端点可达，但返回 `InvalidAccessKeyId`；12 个阶段 A 提交对象的 HEAD 校验均为 `object-store-head-failed`。
- 下一次尝试前必须恢复受限对象存储访问密钥，并重新完成 12 个 HEAD 校验。随后才可针对仍为 `RETRYABLE` 的项建立显式、重新冻结证据的 `RETRY` 批次。

## 2026-08-28 T2-3 定向重评分与 PDF 修订

- T2-3 新评分为 `18/20`，两条扣分批注均为中文；整份结果确认发布后总分为 `98`。
- 新派生版本 `11-no-native-text-summary-wrap` 修复两项学生可见版面问题：移除原生 `Text` 批注图标，并按实际字体宽度换行总体评价；正式 PDF 不包含复核校验值。
- 对象存储重派生曾因 `.env` 受限凭据收到 `InvalidAccessKeyId` 而可重试；切换为命令级本地凭据后 T2-3 `3/3` 派生成功。该凭据未写入代码、仓库或文档。
- 正式学生 PDF 三页，原生批注数 `0`，右侧批注、虚线连接、中文内容和总体评价均逐页核验通过；不重做其他题目，阶段 B 不启动。

# Remediation 运维手册（任务 12.3，Issue #1515）

面向运维/课程负责人的命令与工件位置索引。当前权威版本指针：

- **Canonical Authority**：`ctr:release:control-theory-engineering-v0.37`（图字节，releaseHash `cc73fa15…`，7476 成员）
- **Presentation 层**：`control-theory-engineering-v0.37-r3`（source `v0.37-source-r4` @ 3e98864；canonical 字节与 v0.37 相同，见 `formal-resource-remediation/v037r3-switch-summary.json`）
- **共享分配**：allocation `92fe43d6…`（`formal-resource-remediation/allocation-v037-scope.json`）
- **交接**：`handoff-9f3d13c0…`（`formal-resource-remediation/remediation-handoff.json`，selectable=false）

所有命令在仓库根目录以 `npx tsx scripts/knowledge-cutover/<脚本>` 运行；共享库位于 `src/lib/formal-resource-remediation/` 与 `src/lib/latest-authority-oss-cutover/`。

## 1. 源维护（source maintenance）

| 源 | 真源位置 | 变更路径 |
|---|---|---|
| 讲义 | `course-content/authoring/lessons/<unit>/design/<unit>-handout.md` | 修改后运行 `rtk python3 course-content/authoring/review_lesson_content.py`，再走再生命令（§5）重放 text 原子 |
| 互动课习题 | `course-content/runtime/lessons/<unit>/interactive-manifest.json` | 修改后重放 `process-interactive-manifests`（习题卡发现）与语义映射 |
| 视频发布版 | `course-content/runtime/lessons/<unit>/media/<unit>-intro-video.mp4` | **负责人裁决（2026-08-24）**：以当前 OSS 发布版为准；视频 hash 变化即新身份，需要重新增量绑定（§3） |
| ASR 转写 | `formal-resource-remediation/20260823-asr-batch/transcripts/` | 换模型/重转写后必须更新 processor-registry 并重放音频段绑定 |

## 2. Fun-ASR-Nano 与 hotword

- 处理器登记：`formal-resource-remediation/20260823-asr-batch/processor-registry.json`（模型身份、配置摘要；envelope 以文件 sha 绑定，改动即漂移）
- ASR 处理记录：`…/asr-processing-records.json`（28 单元；allocationHash 必须与共享分配一致）
- hotword manifests：`…/hotword-manifests.json`（manifestHash 覆盖 allocation 绑定；重分配后 hash 与 manifestId 均需重算）
- 音频语义段：`…/audio-semantic-segments/<unit>.json`（nodeBindings 为模态事实，涵盖域过滤发生在投影构建）

## 3. 增量处理与失效（incremental processing / invalidation）

- **分配重绑**（同一语料、新 allocation）：`rebindProcessingRecordsToAllocation`（记录仅迁移 allocationHash，recordId/manifest hash 稳定）与 `rebindHotwordManifestsToAllocation`（hash+manifestId 重算，内容字段字节不变）。有界性证据：`formal-resource-remediation/replay-evidence.json`
- **视频 hash 变化**（新身份）：对涉及单元重跑 `process-intro-videos.ts` → `bind-intro-video-cues.ts` → 信封 reopen/seal → 投影重建 → 交接重封；未涉及单元的记录与绑定全部复用
- **失效范围**：任何 source/model/hotword/atom/evidence/ledger/envelope/projection/fragment/selector 漂移都会被 fail-closed 拒绝（见 §4 负面验收）

## 4. 人工审核（human review）

- 负责人抽样流程：`docs/remediation-1515/owner-sampling-11-7.md`（抽样面 + 决策记录表 + 执行结果）
- 语义映射审核（use-codex）：`rtk bash` 后台运行 `run_codex.py --model gpt-5.6-sol --effort medium --permission auto --prompt-file <prompt>`；审核产物先落 `/tmp/remediation-run/review/`，决策依据回填仓库内绑定文件
- 图谱缺口跟踪：`docs/remediation-1515/graph-issues.md`（G8/G9 与修复跟踪表）

## 5. 再生与验收命令（regeneration）

按顺序执行；全部幂等（writeDeterministicJson 对相同内容 skip、对分歧拒绝）。

```bash
# 1) 端到端重建（信封 + 投影 + 分片 + 消费者投影；从密封 allocation 与真实源清单出发）
npx tsx scripts/knowledge-cutover/build-resource-envelope-and-projection.ts

# 2) 端到端密封验证（8 项重开检查 + 交接密封 + 生产指针核验）
npx tsx scripts/knowledge-cutover/seal-remediation-handoff.ts

# 3) 负面验收（10 类 drift 注入，全部 fail-closed）
npx tsx scripts/knowledge-cutover/negative-acceptance-remediation.ts

# 4) 重放证据（确定性干净重放 + 单输入增量重绑，含 timing/reuse/invalidation/语义 hash）
npx tsx scripts/knowledge-cutover/replay-evidence-remediation.ts

# 5) 协调切换消费证明（remediation-bound candidate：消费交接 + 共享分配，保持 non-selectable）
npx tsx scripts/knowledge-cutover/build-remediation-bound-cutover-evidence.ts
```

## 6. 关键工件位置

| 工件 | 路径 |
|---|---|
| 资源信封（1058 资源/13522 原子，30 工件） | `formal-resource-remediation/resource-envelope.json` |
| 三族闭合总收据（22428 行/420 边） | `formal-resource-remediation/total-closure-receipt.json` |
| 教学投影（2575 绑定）与域分片 | `formal-resource-remediation/teaching-projection/` |
| 端到端验证报告 | `formal-resource-remediation/end-to-end-verification-report.json` |
| 负面验收报告 | `formal-resource-remediation/negative-acceptance-report.json` |
| 重放证据 | `formal-resource-remediation/replay-evidence.json` |
| 交接清单（non-selectable） | `formal-resource-remediation/remediation-handoff.json` |
| 协调切换候选与识别证明 | `cutover/candidates/control-theory-engineering-v0.37-remediation/` |
| r3 presentation bundle | `releases/control-theory-engineering-v0.37-r3/`（41 文件，SHA256SUMS 全校验） |
| r3 切换收据 | `formal-resource-remediation/v037r3-switch-summary.json` |

## 7. 生产边界（不可越）

- 本 change 不部署、不发布 OSS、不改任何生产 selector；7 个生产指针保持前任 `ctr:release:control-theory-engineering-v0.9`
- 正式切换由 `coordinate-latest-authority-and-active-oss-resource-cutover`（#1509）走外层 candidate → deployment → production activation 独立授权
- 下游消费方必须 `reopenRemediationHandoff` 并复用共享 allocation `92fe43d6…`，禁止手抄内层 hash 或创建第二 allocation

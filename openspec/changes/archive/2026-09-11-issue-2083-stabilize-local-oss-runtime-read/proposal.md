# Proposal: issue-2083-stabilize-local-oss-runtime-read

映射 GitHub Issue: #2083「本地 OSS Runtime 启动缺失资源索引 revision，路径资源无法真实读取」。

## Why

Issue 经代码核查判定**部分属实**，两处修正须先澄清：

1. 「持续 MISSING_CAPTURE/500」是条件性触发而非本地启动的必然结果：revision 解析链（`resource-index/revision.ts:41-79`）依次读 `APP_REVISION`/`GIT_SHA`/`.app-revision`/Git HEAD 捕获，本地启动链（`startup:oss-runtime` → bootstrap → start.sh → dev）确实不提供任一信号，但 git 可用的普通 checkout 会兜底成功；只有 git 捕获同时失败（非 work tree、VM 共享挂载 dubious ownership 等）才抛 MISSING_CAPTURE。此外本地几乎总是 dirty 捕获，知识面资源闭包会 fail-closed 为「暂时不可用」（`registry-closure.ts:43-54`）。
2. 根因诊断有偏差：活动 Runtime release 解析（`runtime-active-release.ts:81-112`）与资源索引 revision 是两条独立链路，前者失败码为 `runtime-active-release-*`；报告者能看到绑定说明 release 解析实际成功。准确因果链是「缺稳定 revision 捕获 → 资源闭包 fail-closed / `/api/resources` 500」。

真实缺口：本地开发启动不稳定供给与 pin 的 release 一致的资源索引 revision（A）；候选资源真实读取验证的生产实现缺失——`AdaptivePathObjectKeyVerifier` 端口（`adaptive-path-oss-provenance.ts:25-61`）仅被测试使用，生产只产出 `index-verified`，「成功读取记录」从未生成（B）；媒体路由无 RAM role 时静默 307 回退本地静态目录，可能掩盖 OSS 侧不可读（C）；缺可重复的本地端到端验收与故障注入（D）。

## What Changes

- A：开发启动链稳定导出与 pin 的活动 release 一致的资源索引 revision（`APP_REVISION` 或受控 `.app-revision`），消除对偶然 git 工作目录状态的依赖；裁决开发态 dirty 捕获与教学投影 `authoringRevision` 的 `capturesMatch` 语义。
- B：为既有 spec 需求「Candidate OSS resources carry runtime provenance and read verification」（`adaptive-learning-path-planning`）提供生产读取验证实现：经开发者网关/OSS 数据面产生含 release、资源标识、对象键、内容校验、候选、节点、时间、结果的记录；失败态映射 missing/forbidden/checksum-mismatch/release-mismatch 并透到学生文案。
- C：对已挂载 release 的媒体/资源交付，把静默本地回退改为显式、可见的分类失败；本地 fixture 仅在显式声明的开发模式下允许且不计入「OSS 已读取」。
- D：提供可重复的本地端到端验收脚本：生成路径 → 打开资源 → verified 读取，以及至少一个故障注入场景（缺 blob / sha 不符 / 过期 release）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `developer-oss-runtime-access`: 新增需求——开发启动 SHALL 稳定供给与 pin 的活动 Runtime release 一致的资源索引 revision 捕获，不得依赖偶然可用的 Git 工作目录状态。

## Impact

- 代码：`scripts/runtime-release/developer-oss/`（bootstrap 启动链）、`src/features/personalization/path-planning/adaptive-path-oss-provenance.ts`（生产 verifier）、`src/app/api/course-runtime/assets/[...assetPath]/route.ts`（回退分类）、验收脚本与 smoke 矩阵文档。
- spec 说明：B/C 的行为要求已存在于 `adaptive-learning-path-planning` 的「Candidate OSS resources carry runtime provenance and read verification」需求，本 change 补生产实现，不修改该需求文本。
- 依赖关系：与进行中的课程 Runtime 发布加固（工作树未提交的 `publish-runtime.py` CAS 冲突加固，归属 `simplify-runtime-cas-publish-activate`）**不冲突、不等待**；但新 release 发布/激活窗口内开发机下次启动会 pin 新身份，验收应在激活完成后执行。明确非目标：不改 `runtime:publish`/`activate` 控制面，不在工作站恢复公网 OSS 数据面，不改变学生媒体交付合同本身。

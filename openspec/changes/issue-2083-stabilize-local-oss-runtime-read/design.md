# Design: issue-2083-stabilize-local-oss-runtime-read

## Context

- revision 解析：`resolveLiveResourceIndexRevision`（`resource-index/revision.ts:41-79`）四级回退 `APP_REVISION` → `GIT_SHA` → `.app-revision` → Git HEAD 捕获；全缺抛 `MISSING_CAPTURE`（`:56-61`）。生产由镜像提供（`Dockerfile:76-90`、`:146-152`、`:210`）。本地启动链全链无任一信号导出，git 捕获对任何 git 失败静默返回 null（`:28-39`）。
- 错误面：`/api/resources/[id]` 在 DB 未命中时走 `getLiveResourceRegistryIndex()`，`MISSING_CAPTURE` 被 catch 后返回 500（`route.ts:18-29`）。git 可用时本地捕获几乎总为 `HEAD-dirty`，知识面闭包 fail-closed 为「暂时不可用」（`registry-closure.ts:43-54`、`:124-128`）——用户体感同为资源不可用，但错误形态不同。
- release 链路独立：`readActiveRuntimeReleaseManifest`（`runtime-active-release.ts:81-112`）不依赖资源索引 revision；绑定缺失有显式 `no-active-release` 记录（`adaptive-path-runtime-binding.ts:140-153`）。
- 读取验证缺口：批次定稿的 `verifyCandidateObjectKeyRecords` 只做索引核对（`indexed-resource-verification.ts` 自述「without claiming or performing body reads」）；真实 verifier 端口仅测试使用；`verified/missing/forbidden/checksum-mismatch` 生产永不可达。
- 静默回退：媒体路由无 RAM role 时 307 到本地静态 `/course-runtime/...`（`route.ts:57-65,68-79`），`published-resource-index.ts:195-198` 的 href 走该路由。
- 既有防护：区分度计算已剔除非 verified/index-verified 记录（`adaptive-path-candidate-batches.ts:232-240`）；学生文案已区分 `index-verified`（「入口已确认」）与 `verified`（「读取正常」），未把绑定伪装成读取成功。

## Goals / Non-Goals

**Goals:**

- 本地开发启动稳定供给与 pin 的活动 release 一致的资源索引 revision，不依赖偶然 git 状态。
- 路径内 OSS 资源真实读取并产生完整验证记录；失败显式分类并透到学生可见原因。
- 杜绝「绑定展示/站内路由/本地回退被当作 OSS 读取成功」。
- 可重复本地端到端验收 + 故障注入。

**Non-Goals:**

- 不改 `runtime:publish`/`activate` 控制面（归 `simplify-runtime-cas-publish-activate`，其发布加固正在进行）。
- 不在工作站恢复公网 OSS 数据面或签发 AccessKey。
- 不改变学生媒体交付合同与 gateway 默认数据面。
- 不做历史批次读取记录的回填。

## Decisions

1. **A（revision 供给）先行且独立**：bootstrap 在 pin 活动身份后把该 checkout 的捕获 revision 显式导出为 `APP_REVISION`（或写受控 `.app-revision`），与应用进程同源；同时裁决开发态 `capturesMatch` 语义——开发模式接受与 pin 身份一致的 dirty 捕获，拒绝跨 checkout 漂移。
2. **B 复用启动期 pin 身份**：生产 verifier 经开发者网关数据面读取，消费节点绑定字段（对象键），不从导航 target 反解；结果记录含 release、资源 ID、对象键、校验值、候选/节点 ID、时间、结果；失败态映射四类分类并接到既有学生文案。
3. **C 只改「已挂载 release」语境的回退**：无 RAM role 的静默 307 仅在未 pin release 的纯本地模式允许；已 pin release 时改为显式分类失败，本地静态回退不计入 OSS 覆盖与区分度（沿用既有剔除逻辑）。
4. **D 验收脚本化**：纳入 `docs/operations/developer-oss-runtime-smoke-matrix.md` 体系；故障注入至少覆盖缺 blob 与 sha 不符；验收在新 runtime 激活完成后执行，避开发布窗口的身份切换。

## Risks / Trade-offs

- 风险：开发态接受 dirty 捕获会弱化闭包校验。缓解：仅限显式开发模式、与 pin 身份绑定，并在 readiness 中呈现 dirty 状态；生产路径不变。
- 风险：真实读取验证增加批次定稿延迟。缓解：验证记录异步/缓存，失败分类不阻断其余候选。
- 权衡：不把 fixture 回退一刀切禁止——纯本地开发模式仍需可用，但必须显式声明且不计入 OSS 已读取。

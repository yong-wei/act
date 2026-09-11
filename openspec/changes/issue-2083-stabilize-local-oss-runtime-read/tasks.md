# Tasks: issue-2083-stabilize-local-oss-runtime-read

## 1. A：启动稳定 revision 供给

- [ ] 1.1 bootstrap（`scripts/runtime-release/developer-oss/`）在 pin 活动身份后导出一致的资源索引 revision（`APP_REVISION` 或受控 `.app-revision`）给应用进程。
- [ ] 1.2 裁决并实现开发态 dirty 捕获的 `capturesMatch` 语义：与 pin 身份一致则接受并呈现 dirty 状态，跨 checkout 漂移 fail-closed。
- [ ] 1.3 git 捕获不可用时启动仍可用（不抛 MISSING_CAPTURE），或给出具体受限原因。

## 2. B：生产读取验证实现

- [ ] 2.1 为 `AdaptivePathObjectKeyVerifier`（`adaptive-path-oss-provenance.ts`）提供生产实现，经开发者网关数据面消费节点绑定字段读取对象键。
- [ ] 2.2 验证记录含 release、资源 ID、对象键、校验值、候选/节点 ID、时间、结果；失败态映射 missing/forbidden/checksum-mismatch/release-mismatch 并接到既有学生文案。
- [ ] 2.3 维持区分度剔除非 verified/index-verified 记录的既有逻辑。

## 3. C：禁止静默本地回退

- [ ] 3.1 已 pin release 语境下，媒体/资源交付失败改为显式分类失败，不再静默 307 到本地静态目录；纯本地模式（无 release）允许回退但显式声明且不计入 OSS 已读取。

## 4. D：端到端验收

- [ ] 4.1 在 smoke 矩阵体系中新增脚本化验收：生成候选路径 → 打开绑定资源 → verified 读取记录完整。
- [ ] 4.2 至少一个故障注入场景（缺 blob / sha 不符 / 过期 release）呈现正确受限原因。
- [ ] 4.3 验收在新 runtime 发布/激活完成后执行，避开身份切换窗口。

## 5. 验证

- [ ] 5.1 相关单元/集成测试与 `rtk npm run typecheck` 通过。
- [ ] 5.2 `openspec validate issue-2083-stabilize-local-oss-runtime-read --type change --strict` 通过。

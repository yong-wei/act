## 1. 校内标准结构落地

- [ ] 1.1 在校内 `202.195.195.153` 规划并创建 `data/runtime/blob-store/sha256/`、`blob-releases/`、view 目录与选择器锁文件约定，容器保持只读 bind
- [ ] 1.2 以现有解引用快照为内容源做结构重建：逐文件重算 SHA-256 回填 blob-store，materializer 以本地 blob root 物化标准 view，staging 原子切换，快照退役
- [ ] 1.3 在校内以 `runtime:doctor --manifest --blob-root` 跑只读校验，产出结构重建证据（release id、manifest digest、文件数/字节数核对）

## 2. 发布侧姊妹命令

- [ ] 2.1 新增校内投递命令（`runtime:publish:campus` 或 `--target campus`）：按 manifest 从 Git 树/本地缓存填充缺失 blob，推送前后核对文件数与总字节
- [ ] 2.2 实现校内 rsync 直推（`rsync -a --partial`，blob-store + manifest），失败重试仅补缺失 blob
- [ ] 2.3 校内激活流：manifest 摘要验证 → staging 物化 → smoke → 校内选择锁内切 current/previous → 写校内 active receipt（不触碰 ECS receipt）
- [ ] 2.4 单元与集成测试：同 manifest 双端一致性、损坏 blob fail-closed、campus 失败不影响 OSS 端、receipt 分账

## 3. 双端流程与门禁

- [ ] 3.1 `rtk npm run verify:commit`/`typecheck` 通过；新增命令纳入现有 runtime-release 测试套件
- [ ] 3.2 更新 `.agents/skills/server-ops/` 校内双镜像节：runtime 同步改为"发布机直推增量"，移除"从 ECS 复制"表述
- [ ] 3.3 端到端演练：一次 `runtime:publish` 后完成 OSS 与校内双端 activate，核对两端 active release id 与 receipt 一致性证据

## 4. 归档

- [ ] 4.1 全部任务与验收场景通过后，`openspec validate campus-mirror-local-blob-store --type change --strict`，归档变更并同步 `openspec/specs/`

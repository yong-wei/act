## Context

当前日常 Runtime 发布仍走 `deploy:runtime` → `act-runtime-release.ts` → OSS publisher bridge → lifecycle → materializer → activation transaction。数据面已是 `runtime/blobs/sha256/<sha256>` 与 `act-runtime-release.v2`；膨胀的是控制面：parent 增量、source-proof、ECS readback、desired/staged/verified/generation，以及发布时的全量或近全量远程预检。

生产应用部署已经与 Runtime 发布分离。`simplify-runtime-app-compatibility-validation` 已去掉兼容性收据。本设计在该基线上继续删除发布控制面，而不是再优化旧协议。

## Goals / Non-Goals

**Goals:**

- 日常发布复杂度降为 `O(N_stat + Δ_hash + Δ_upload)`。
- 未改 Runtime 且同一 `sourceRevision` 再发布：`hashed=0`、`uploaded=0`，且无 OSS HEAD/GET。
- 激活只比较 current manifest 的 Δ 路径、确认这些 Blob 可见、检查少量 sentinel，然后原子切换 `current`/`previous`。
- 旧控制面调用点归零；`scripts/runtime-release` 日常文件收敛到约 5–7 个，另保留 `developer-oss/` 与 ossfs 挂载。
- 作者态内容未变则不改 mtime。

**Non-Goals:**

- 不设计 v3/v4 manifest，不改现有 blob/manifest 对象键。
- 不建设自动 parent，不把外部 bundle 谱系当发布资格。
- 不建设作者态课次/节点/卡片依赖失效图。
- 不建设 filesystem watcher 或 export change journal。
- 不改 Teaching Projection、Authority overlay、developer-oss 网关。
- 不在本变更中重写 coordinated graph cutover 协议；它只能调用新的 activate/rollback。
- 本变更不执行生产发布。

## Decisions

1. **一个 OpenSpec change，按 R1→R5 落地**
   - 理由：五项共享同一不变量，拆成五个 change 会重复改同一组 spec。
   - 备选：五个串联 change。否决，因为 R3 删除面依赖 R1/R2 的新入口已经存在。

2. **Publisher 用 Python，索引用 gitignore 的 SQLite**
   - 路径：`scripts/runtime-release/publish-runtime.py`，索引 `var/cache/runtime-release/index.sqlite`。
   - 理由：扫描/哈希/条件 PUT 是运维脚本，不必再经过 TS publisher 与 SSH bridge。
   - 备选：继续扩 `act-runtime-release.ts`。否决，该文件已承担 source-proof/parent/编排。

3. **日常发布读 `course-content/runtime` 工作树，Git SHA 只作 provenance**
   - `sourceRevision` 仍写入现有 v2 字段，默认 `git rev-parse HEAD`。
   - 文件字节以工作树为准；不冻结 Git tree，不要求 parent 才能收录 generated 文件。
   - 理由：Runtime 大量文件本就不是 Git 跟踪对象；现有 Git snapshot + external bundle 正是控制面失控的来源。
   - 备选：继续只读 Git tree。否决，它无法表达真实 Runtime，还会把 bundle parent 留在热路径。

4. **继续产出当前 v2 manifest / 对象键，不改 release ID 公式**
   - Blob：`runtime/blobs/sha256/<sha256>`。
   - Manifest：`runtime/blob-releases/<releaseId>/manifest.json`。
   - `releaseId = runtime-${sha256(stableStringify({sourceRevision, treeSha256})).slice(0,55)}`。
   - 文件条目只需 `path/objectKey/sizeBytes/sha256`；`source` 不再作为增量条件。
   - 为保持现有解析器可读，发布仍可写无 source-proof 的 `receipt.json`；R3 后若无消费者再删。
   - 理由：用户明确禁止为简化发布先设计新协议。
   - 备选：按用户示意改成分片 `blobs/sha256/ab/…`。否决，那是新协议。

5. **OSS 不做 HEAD 预检；条件 PUT 的已存在即 CAS hit**
   - 使用现有 ossutil `--forbid-overwrite`。对象已存在视为命中，不是失败。
   - 测试用本地目录模拟同一语义。
   - 备选：先 HEAD 再决定 PUT。否决，这正是要砍掉的 `O(N_remote-check)`。

6. **索引缺失或损坏必须 fail-closed**
   - 普通 `runtime:publish` 不得静默全量。
   - 明确错误：`local publish index unavailable` / `run with --bootstrap to rebuild`。
   - `--bootstrap` 才是显式全量哈希。

7. **激活状态只保留 current/previous**
   - 宿主机指针可以是 `runtime/current` → `releases/<id>` 与 `runtime/previous` → `releases/<id>`，或等价 JSON。
   - 回滚是两指针互换，不重新上传、不重新全量物化、不重新全量验证。
   - 激活前只证明：新 release 尚未准备好时不能切 current。
   - 备选：保留 desired/generation/transaction marker。否决，单套生产 Runtime 不需要这套状态机。

8. **删除旧控制面，不留兼容期状态管理**
   - R1/R2 先引入新入口；R3 在新入口测试通过后删除旧调用点。
   - `DEPLOY_SCOPE=all` 的空 fail-closed 分支直接删除。
   - `developer-oss/`、`configure-runtime-blob-ossfs.sh`、`act-runtime-blob-ossfs.service` 保留。

9. **校验只分三级，且互不调用**
   - publish：路径合法、manifest 可序列化、Δ hash、Δ PUT、manifest PUT。
   - activate：manifest 可读、Δ Blob 可访问、固定 sentinel 可读、应用 runtime smoke、原子切换。
   - doctor：仅人工/故障/周期；才允许全量 closure/hash/存在性。
   - GC 独立，默认不自动删 Blob。保留集：current、previous、仍被 ClassSession 引用的 release、人工 pin。

10. **R5 只做 `write_if_changed()`**
    - 计算可以暂时多算，内容相同绝不落盘。
    - 细粒度失效图留到以后有 CPU 证据再做。

## Risks / Trade-offs

- [工作树与 Git 树可能不一致] → `sourceRevision` 只表示操作时的 HEAD，不表示 Git tree 闭包。内容正确性由作者态/CI 负责；doctor 可审计。
- [同一内容、不同 HEAD 仍会生成新 releaseId] → R1 接受，不拆内容树 ID。测试“无变化再发布”固定同一 `sourceRevision`。
- [条件 PUT 把损坏同名对象当成 hit] → 日常不回读。怀疑损坏走 `runtime:doctor --full`。CAS 键来自内容哈希，正常写入不会碰撞出不同字节。
- [删除 lifecycle 会使旧 coordinated 脚本失效] → R3 把那些脚本改成调用 `runtime:activate`/`runtime:rollback`，或移出 Runtime 日常工具集；不在 Runtime 内重建状态机。
- [首次 bootstrap 仍要读全部文件] → 这是显式全量，可接受。之后禁止静默退化。
- [约 10 万次 stat 仍可能慢] → 先不做客志/watcher。先用 mtime 去抖把哈希和上传打到 Δ。

## Migration Plan

1. R1：新 Publisher 与本地/合同测试并行存在，不切生产。
2. R2：新 activate/rollback 可在夹具宿主机状态上切换；旧 lifecycle 仍在，直到 R3。
3. R3：旧调用点归零后删除旧文件；`deploy:runtime` 变成对 `runtime:publish` + 显式 `runtime:activate` 的薄包装或直接删除。
4. R4：grep 确认 publish/activate/app deploy 不调用 doctor/GC。
5. R5：export 去抖动。生产切换另需明确授权。

回滚：未切生产前只需停用新命令。若生产已切到两指针，回滚命令就是 `runtime:rollback`。

## Open Questions

无。对象键、manifest 版本、索引 fail-closed、两指针激活和 R5 只去抖均已由本次需求钉死。

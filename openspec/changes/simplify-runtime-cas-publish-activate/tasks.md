## 1. R1 轻量增量 Publisher

- [x] 1.1 新增 `scripts/runtime-release/publish-runtime.py`：扫描 runtime metadata、SQLite 索引、只哈希变化文件、条件 PUT、写现有 v2 manifest。
- [x] 1.2 索引放到 `var/cache/runtime-release/index.sqlite` 并加入 gitignore；缺失或损坏时普通发布 fail-closed，只有 `--bootstrap` 重建。
- [x] 1.3 暴露 `npm run runtime:publish` 与 `npm run runtime:publish -- --bootstrap`。
- [x] 1.4 用本地目录模拟 CAS 写合同测试：无变化再发布 `hashed=0, uploaded=0`；改 1 个文件只哈希/上传该 Δ；无索引不加 `--bootstrap` 失败。

## 2. R2 压平激活状态机

- [x] 2.1 重写 `activate-runtime.sh` / `materialize-runtime.py`：比较 current manifest 得 Δ，确认 Δ Blob 与固定 sentinel，物化后原子写 current/previous。
- [x] 2.2 实现 `runtime:activate` 与 `runtime:rollback`（两指针互换，不重新上传或全量哈希）。
- [x] 2.3 增加激活/回滚合同测试：一条 activate 切换成功，一条 rollback 恢复，候选未就绪时 current 不变。

## 3. R3 删除旧发布控制平面

- [x] 3.1 删除 publisher-bridge 编排、lifecycle、host-state、publisher-shadow、历史 cutover/migration 与 `DEPLOY_SCOPE=all` 空分支；旧调用点归零。
- [x] 3.2 收缩 `act-runtime-release.ts`、`src/lib/runtime-release.ts`、`src/lib/runtime-release-store.ts`，只留 manifest/CAS 工具。
- [x] 3.3 确认 `scripts/runtime-release` 日常文件收敛到约 5–7 个，并保留 `developer-oss/` 与 ossfs 挂载。

## 4. R4 校验与 GC 离热路径

- [x] 4.1 新增独立 `runtime-doctor.py` 与 `runtime-gc.py`，以及 `runtime:doctor -- --full`、`runtime:gc -- --dry-run`。
- [x] 4.2 grep 调用链确认 publish、activate、rollback 和应用部署都不调用 doctor/GC/全量 verify。

## 5. R5 作者态落盘去抖动

- [x] 5.1 在 `export_runtime.py` 实现 `write_if_changed()`，内容相同不重写文件。
- [x] 5.2 增加导出测试：单课修改后，字节相同的无关 runtime 文件 mtime 不变。

## 6. 验证

- [x] 6.1 跑本变更合同测试，以及直接受影响的 runtime-release 测试。
- [x] 6.2 `openspec validate simplify-runtime-cas-publish-activate --type change --strict` 通过。

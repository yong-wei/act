# 2026-08-17 生产增量应用发布

## Goal

把当前 `origin/integration` 的应用镜像发到生产，保持已恢复的 OSS blob-view 与 v0.18 五选择器不变。

## Scope

- 冻结修订：本计划提交后的 `HEAD`（应包含 `3b19b596d` 开机挂载修复）。
- 只发应用：本机构建镜像，远端 `deploy:app --skip-build`。
- 保留现网 runtime：`runtime-3dcc71669bdbb68e5304adf7925e49f75b1e747da5e9c7ed03ff689`。
- 保留 v0.18 选择器，不重放物化。

## Out of scope

- `deploy:runtime` / `deploy:all` / `legacy-rsync`
- `remote-refresh-cutover-app.sh`（它读 host `course-content/runtime` 上的 cutover marker，live view 里该文件缺失）
- 再次执行 #1412 五选择器事务
- 把 Git 树里的 v0.9 `current.json` 写成生产指针
- 新建 GitHub Release / 合入 `main`

## Why this path

- `course-content/runtime` 相对生产 source `0ab2b637` 无 Git 树变化，不需要新的 blob release。
- 生产已是 `ossfs-blob-view` + `ACT_KNOWLEDGE_DEPLOYMENT_MODE=cutover`。
- `deploy:runtime` 会按 Git 树重放选择器，把 v0.18 普通 `current.json` 冲回 v0.9。
- 现网镜像 `v018-94d585ae63a6` 落后 83+ 个提交，含 Arena 正式提交、可信画像、OSS blob-view 部署修复。

## Prisma

`4-deploy.sh --app-only` 会 `prisma migrate deploy`。待应用：

1. `20260806010000_add_trusted_portrait_traceability`（加列，可空默认）
2. `20260808120000_add_ai_intervention_scope_idempotency`（部分唯一索引；上线前必须确认无重复行）
3. `20260817120000_add_arena_official_submit_reservation`（新表）
4. `20260817121000_unique_arena_official_submit_order`
5. `20260817122000_add_arena_official_submit_lease`

## Steps

1. 提交并推送开机挂载修复（已完成：`3b19b596d`）。
2. 写入本计划并推送，冻结发布 HEAD。
3. 前置条件：
   - 工作树干净，HEAD 可从 `origin/integration` 到达
   - Docker Desktop `MemoryMiB=24576`、`SwapMiB=8192`，VM ≥ 20 GiB
   - 远端 `df -B1 /` 足够容纳 tar + image + 1 GiB
   - 现网 readyz / 选择器 / blob helper FUSE 仍健康
   - `AIIntervention` 无 `arena-official:%` 重复行
   - 快照五选择器到本机 artifacts
   - 跑部署合同测试
4. 构建：

```bash
IMAGE_TAG='localhost/act-obe-platform:v018-<shortsha>' \
OUTPUT_TAR='deploy/images/act-obe-v018-<shortsha>.tar' \
NODE_MAX_OLD_SPACE_SIZE=12288 \
NODE_OPTIONS='--max-old-space-size=12288' \
rtk bash scripts/build.sh
```

5. 发布：

```bash
LOCAL_IMAGE_TAR='deploy/images/act-obe-v018-<shortsha>.tar' \
REMOTE_APP_IMAGE='localhost/act-obe-platform:v018-<shortsha>' \
rtk npm run deploy:app -- --skip-build
```

6. 验收：容器、readyz、cutover、v0.18 选择器、helper FUSE、Prisma 迁移数、首页/知识页。
7. 退出 Docker Desktop。

## Rollback

- 应用：`APP_IMAGE=localhost/act-obe-platform:v018-94d585ae63a6 /home/projects/act/scripts/4-deploy.sh --app-only`
- Runtime / 选择器：本次不改，无需回滚。
- 已应用的 Prisma 迁移不自动回滚；失败时先恢复旧镜像并评估迁移状态。

## Acceptance

- 生产 app/worker 跑新镜像，OCI revision = 冻结 HEAD
- `readyz` 本机与公网均为 app/db/redis true
- 五选择器仍是 v0.18 密封身份
- `RUNTIME_DELIVERY_MODE=ossfs-blob-view`，helper 只读 FUSE
- 未创建新的 runtime release

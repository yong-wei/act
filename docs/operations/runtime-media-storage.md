# 教学媒体规范存储与正文回收

公开教学媒体以内容摘要作为存储身份，规范正文位于私有 `act-course-models/teaching-media/sha256/<sha>/asset.<ext>`。内部JSON、图谱、治理与检索正文继续位于 `act-course-assets/runtime/blobs/sha256/`。GLB模型的 `model-releases/` 不属于正文回收范围。

Runtime v2清单中的逻辑Blob键、摘要和历史字节保持不变。独立的 `data/runtime/public-teaching-media/current.json` v2目录记录已核验的规范位置；读取路径先验证所选清单，再按文件摘要、大小和媒体类型查目录。没有改变的媒体可以跨Runtime版本复用。

## 读取与停用ESA

每个物化视图保留 `.act-runtime-blobs`，另绑定只读 `.act-runtime-public-media`。应用和worker分别显式挂载两个helper以及 `/app/act-runtime-state`；开发者网关使用同一目录定位正文，租约仍固定到签发时的清单。

`ACT_PUBLIC_TEACHING_MEDIA_ESA_ENABLED=0` 只停止公开重定向。目录仍用于内部文件读取、OSS流读取和300秒签名地址。迁移后不能通过移除目录停用ESA，否则会丢失规范正文位置。

v1索引仍按历史来源身份执行分发。在升级为v2规范目录之前，它不改变Blob的默认存储位置。两个helper均不能经课程路径入口访问。

## 一次性准备

1. 为 `act-runtime-oss-read` 增加 [媒体只读策略](../../scripts/runtime-release/policies/canonical-media-runtime-read.json)，仅允许教学媒体前缀的GetObject和ListObjects。
2. 为 `act-runtime-publisher-local` 增加 [正文维护策略](../../scripts/runtime-release/policies/runtime-body-maintenance-writer.json)。对象写入、恢复和删除仅限两个正文前缀；桶级只读操作用于完整列举和核验未启用版本控制。不修改ESA回源身份，不新增AccessKey。
3. 在宿主机安装本修订的Runtime运维Python脚本、helper绑定脚本和 `act-runtime-public-media-ossfs.service`。`configure-runtime-blob-ossfs.sh --ram-role act-runtime-oss-read` 生成原Blob与公开媒体两份只读配置。
4. 启动独立媒体FUSE，在全部受保护物化视图绑定媒体helper。旧索引、旧链接和原副本先保留。
5. 按应用部署流程发布包含 `io.act.runtime-media-storage.version=1` 的新镜像。应用与worker须能读取媒体helper；更新网关服务及脚本。Runtime、图谱和数据库选择不变。
6. 执行下述 `prepare`。它验证全部目标正文、现存原正文和受保护视图，原子替换媒体叶，保存迁移计划及存储就绪标记。随后验证真实课程媒体、固定版本入口、签名读取、doctor和网关。

这些权限需在实际云账户中确认后应用；策略文件不是已授予权限的证明。

## 日常增量发布

加载仓库外受管Publisher环境后，在仓库根目录执行：

```bash
rtk npm run runtime:publish -- \
  --oss-bucket act-course-assets \
  --ossutil "$HOME/.config/act/tools/ossutil" \
  --lifecycle-host root@121.40.124.135
```

第一次显式使用 `--bootstrap`。SQLite记录文件元数据、摘要和放置位置；未变化文件不读正文、不对正文做OSS HEAD、GET或PUT。新合格媒体直接写媒体桶，不再生成原桶副本；内部正文仍写原桶。用于信息图资格判断的元数据与本次发布清单必须一致。

发布器通过SSH持有宿主选择锁。开始上传前保存完整候选清单及24小时保留租约，目录在终止清单之前提交。上传或进程失败不切Runtime。上传完成也不代表已激活；激活仍使用独立 `runtime:activate`。

本地缓存基线已不再被任何保留根引用时，发布器拒绝直接复用。此时用 `--bootstrap` 重新核验和恢复所需正文，不重新使用GC可能已删除的缓存位置。

## 显式正文GC

默认 `runtime:gc` 仍只处理未引用视图与Release目录。正文计划必须添加 `--reclaim-blobs`：

```bash
rtk npm run runtime:gc -- \
  --reclaim-blobs --dry-run \
  --store-dir /home/projects/act/data/runtime/cas-store \
  --state-dir /home/projects/act/data/runtime/blob-views \
  --oss-bucket act-course-assets \
  --ossutil "$HOME/.config/act/tools/ossutil" \
  --lifecycle-host root@121.40.124.135 \
  --receipt <local-artifact-dir>/body-gc-plan.json
```

确认候选后，用同一参数把 `--dry-run` 改为 `--execute`，另存执行回执。计划不是删除授权令牌；执行会在宿主锁内重新发现引用并核验完整对象快照。

保留根包括current、previous、全部Runtime课堂revision、人工 `--pin`、有效开发者租约、发布租约和已移出两指针的短时签名保留。开发者心跳期为7天，短时签名保留不短于300秒。租约只能延长；坏清单、发现失败、目录冲突或时钟倒退均阻断删除。

正文执行阶段还取得数据库独占advisory锁，防止新课堂引用在发现与删除之间写入。新Runtime课堂使用同键事务共享锁并核验活动清单；GC期间新开课立即返回可重试提示。既有课堂读取及DB原生教案不受该锁阻断。应在低使用时段运行显式GC。

回执记录精确桶、键、大小、对象ETag、保护清单摘要、逐项完成记录和释放字节。OSS DeleteObject没有ETag条件，故管理写者必须遵守同一宿主锁及CAS不可覆盖合同。启用或暂停版本控制的桶不使用本删除流程，避免把删除标记误报为释放空间。Release证据、模型、学习数据及其他前缀均不列入正文候选。

## 本次原桶副本退役

这是等字节副本迁移，不能用普通GC删除仍被当前清单引用的摘要。公共参数如下：

```bash
rtk proxy python3 scripts/runtime-release/migrate-public-media.py prepare \
  --store-dir /home/projects/act/data/runtime/cas-store \
  --state-dir /home/projects/act/data/runtime/blob-views \
  --oss-bucket act-course-assets \
  --ossutil "$HOME/.config/act/tools/ossutil" \
  --lifecycle-host root@121.40.124.135 \
  --plan <local-artifact-dir>/media-migration.json
```

`prepare` 的目标校验和全部受保护视图读取成功后，使用相同参数，把命令改为 `retire` 并增加 `--receipt <local-artifact-dir>/media-retirement.json`。执行重新核验指针、保护清单、目录、目标与原对象快照，只删除计划中的原桶精确副本。部分失败保留逐项回执，不能宣称整批释放成功。

需要旧应用时，以同一计划执行 `restore` 并保存独立回执。恢复从规范正文核对完整SHA后条件写回原键；全部原副本核验通过后，才把 `legacyCopiesAvailable` 恢复为true。目录或保护根变化时重新prepare，不能用旧计划恢复新的媒体集合。

原副本开始退役前，目录将 `legacyCopiesAvailable` 标为false。部署脚本在停止现有容器之前检查此状态，拒绝不支持规范位置的旧镜像。应用代码回滚与正文恢复分别执行。

## 本轮验证与生产状态

本轮实现与回归证据见 [OpenSpec验证记录](../../openspec/changes/decouple-public-media-storage-and-gc/verification.md)。v0.7.34前置发布及v0.7.35规范存储应用部署均已完成。

2026-10-02已完成7,247份原桶副本退役，释放6,320,284,091字节。全部目标/原副本及两份受保护视图通过完整SHA校验；OSS清单确认原键全部缺失、目标ETag与大小保持。删除前后真实应用、worker、网关、ESA、停用ESA后的签名和文件读取均通过。当前Runtime全部131,454个文件大小审计通过；Runtime、图谱选择和活动回执保持。

当前`legacyCopiesAvailable=false`。旧镜像部署会在容器替换前被拒绝，确需回滚时先按上述流程恢复原副本。一份非空原对象已实际删除并恢复，SHA和ETag一致；未执行整套旧应用部署回滚。精确计划、逐项回执和恢复证明见 [生产迁移交付回执](../../artifacts/public-teaching-media/canonical-storage-2026-10-02/receipt.json)，应用镜像与发布证据见 [v0.7.35回执](../../artifacts/app-releases/v0.7.35/receipt.json)。

# 公开教学媒体 ESA 分发

教学媒体分发与课程 Runtime、图谱、教学投影的激活分别执行。应用通过现有只读状态挂载中的 `public-teaching-media/current.json` 决定是否重定向；没有合格索引时使用原读取链路。

## 对象与权限

来源是私有 `act-course-assets/runtime/blobs/sha256/`，分发副本是私有 `act-course-models/teaching-media/sha256/<sha256>/asset.<ext>`。ESA 使用已有 `static.adapt-learn.online` 的 OSS 私有回源与证书，客户端地址绑定内容摘要。

公开集合只包括课内音视频、图片、PDF、教材 assets 图片与已接受的信息图。内部清单、图谱、检索、治理和学习数据不写入分发前缀。信息图图片不需要登录，原发布资格、审核状态、正文摘要和固定版本资源引用仍必须通过校验。

ESA 只读身份沿用 `act-esa-model-read`，v3 仅允许 `oss:GetObject` 到：

- `acs:oss:*:*:act-course-models/model-releases/*`
- `acs:oss:*:*:act-course-models/teaching-media/*`

本机专用发布用户 `act-runtime-publisher-local` 另附 `act-public-teaching-media-publish`，只允许 GetObject、PutObject 和 PutObjectAcl 到 teaching-media 前缀。其既有 Runtime 来源权限保持原策略。没有新增角色或 AccessKey；应用与 ECS 沿用原只读角色，不持有 ESA 回源或 Publisher 密钥。

缓存规则 `ACT公开教学媒体不可变缓存` 同时匹配 static 主机名与 `/teaching-media/`。源对象使用 `public, max-age=31536000, immutable`，浏览器遵循源响应头，边缘遵循源 TTL，缺失时回退一年。CORS 沿用应用 Origin 的 GET/HEAD 与 Range 配置。

## 捕获与发布

凭据仅从仓库外的受管 Publisher 环境载入，不能提交环境文件或输出认证值。以下命令在仓库根目录执行；`<artifact-dir>` 为本次不提交的证据目录。

```bash
rtk proxy python3 scripts/runtime-release/public_teaching_media.py capture \
  --output <artifact-dir>/inventory.json

rtk proxy zsh -c 'source "$HOME/.config/act/publisher-env.zsh" >/dev/null
uv run --with oss2==2.19.1 python3 scripts/runtime-release/public_teaching_media.py publish \
  --inventory <artifact-dir>/inventory.json \
  --output <artifact-dir>/published-index.json \
  --workers 8'
```

捕获校验活动 manifest 与回执一致，并筛选信息图发布资格。发布采用条件服务端复制、私有 ACL 与不可覆盖对象键；核验目标大小、摘要元数据、MIME、缓存响应头及复制 CRC64。重复发布只复用资格一致的目标。任一对象失败都不能生成 verified 终止索引。

发布后每类资源至少选择一个代表对象，经 ESA 完整下载核对 SHA-256，验证 MIME、应用 Origin CORS、精确 Content-Range 和重复请求 HIT。对 OSS 的未签名直连仍须拒绝。

## 应用与分发切换

1. 将已验证的应用修订送入 origin/main，按应用部署手册构建新的版本化镜像和 tar/provenance。只部署应用，保持原 Runtime 与图谱选择器。
   `deploy:app` 装载精确镜像后使用现有 `--runtime-cutover-app-only` 容器替换模式，保留数据库和 Redis，不导入数据库、写入知识种子或执行迁移。systemd 通过 `ACT_SERVICE_CONFIGURE_ONLY=1` 更新配置，不再次重启数据服务。需要数据库迁移的其他发布应采用单独获授权的数据面操作。
2. 核验新应用、worker 和 readyz。比对切换前后的 Runtime、Authority、Teaching 和资源绑定身份。
3. 把完整 published-index 写入宿主机 `data/runtime/public-teaching-media/` 的独立临时文件。核对源 Runtime ID、manifest SHA、verified 状态、完整条数与发布计数，并确认捕获 Runtime 仍为活动版本。
4. 目录权限设为 0755、索引设为 0644，使容器非 root 用户能经既有 `/app/act-runtime-state` 只读挂载读取。备份已有索引后，同目录原子 rename 为 `current.json`。这一步只切换媒体分发索引。
5. 匿名核验音视频、PDF、教材、信息图、固定 Release 媒体与 Blob 入口的 307→ESA→200/206。验证未接受信息图 404、陈旧资源引用 409，以及受保护知识 API 401。用真实浏览器检查图片与媒体加载。

普通路径要求索引来源与活动 Runtime 回执完全一致。课堂媒体按清单中的精确摘要查找分发对象，已发布的旧摘要可以继续读取；未知摘要沿用原读取。两个信息图入口先读取并校验原图片，再按实际字节摘要查找分发对象。

若需要指定其他索引位置，使用 `ACT_PUBLIC_TEACHING_MEDIA_INDEX_PATH`。容器默认位置为 `/app/act-runtime-state/public-teaching-media/current.json`。

## 停用与恢复

将 `current.json` 原子移到同目录的保留文件即可停用重定向；无需重启应用或变更 Runtime。文件不存在后，应用立即使用原读取链路。恢复只可原子装入完整 verified 索引，并再次核验 Runtime 身份与公开分发响应。不要删除不可变对象、撤销其他产品权限或恢复旧 Runtime 来停用媒体缓存。

## 2026-10-01 发布前证据

来源 Runtime 为 `runtime-b24b84a4ddea4d450ce813a87757298855c5476f26e9e79a782c752`，manifest SHA 为 `cdd2f4bec3232beaa0cf4932246349d0ad2bddf4f752e7a2dce3db961aafd54f`。完整清单 131454 条，公开候选 7295 条，纳入 7250 条、排除 45 条，去重对象 7247 个，逻辑字节 6321326105。构成：视频 59、音频 28、课程图片 397、课内 PDF 122、教材图片 5250、信息图 1394。

复制新增 7246 个对象，复用 1 个，失败 0 个。published-index SHA 为 `0774de18b10931a72f540259d0edc91fd74cba4f751861a2722856ac8dae166d`。七类代表对象的完整 SHA、MIME、CORS、两次 206 与 HIT 均通过；信息图区分 Authority 与既有清单各验证一份。

直接回归与相关 Vitest 共 36 项、Python 单元测试 7 项通过，Python 编译、定向 ESLint 与 OpenSpec 严格验证通过。额外运行的未修改 learning-content 全套测试因本地隔离工作树缺少完整外置 Runtime/匹配 fixture 而失败；不把此结果视为生产资格验证通过，生产切换后须验证真实内容读取。原资格读取器未修改。

应用发布与索引启用结果在实际切换完成后补记。

第一次容器构建的编译和类型检查通过，随后因 14 个外置文件追踪告警被构建门禁拒绝，未产生部署工件。新增分发索引文件读取与共享资源索引中的 Runtime 路径补充了项目既有的 `turbopackIgnore` 标注；门禁保持启用，发布须以再次完整构建成功为准。

标注修复后的分发与共享媒体回归共 52 项通过，类型检查与定向 ESLint 通过。首次资源特征测试有 1 项缺少教材 units 外置 fixture；只向隔离工作树补齐本机已有的七份 units.jsonl 后，该测试文件 15 项全部通过。未向服务器发布这些测试资料。

应用部署脚本定向回归覆盖：不导入或 seed 数据、精确镜像装载、既有零数据库写入替换路径、configure-only 不重启数据服务、默认 systemd 重启行为保留。remote deploy、runtime cutover app-only、Podman DNS readiness 和外置 Runtime 部署四套脚本验证通过，Shell 语法检查通过。人工审查范围为本轮 main 基线到工作区 diff；未发现本轮新增的 P0/P1 重大问题。

`0.7.32-4f89280` 应用与分发索引已启用，原 Runtime、六份选择器、数据库与 Redis 容器身份相同。初次部署验证缺少新应用修订的库存，使用既有工具追加 7804 条库存项后 verify-only 通过，绑定决策与 crosswalk 均为 0。线上发现旧媒体入口只取 v1 清单键；本轮补齐 v2 Blob Release 的固定版本读取，缺失 v1 时才查 v2，摘要与 Release ID 校验保持。此整改使用新应用版本 `0.7.33`。

当前 Authority 学习内容清单仍绑定 v0.37 / `proj-0260a81c…`，活动图谱和教学投影为 v0.48 / `proj-0734e535…`。原内容资格检查因此返回 404，已接受历史图片的原始文件仍可按 SHA 经 ESA 读取；本轮没有更改图谱、学习内容清单或 Runtime 来解除这一既有版本漂移。既有 Bode 等当前可用信息图已验证匿名 307 到 ESA，图片正文 SHA 一致。

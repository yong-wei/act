# 私有 OSS 经 ESA 分发版本化仿真模型

适用范围：`act-course-models` 中面向浏览器的 GLB 模型包、`static.adapt-learn.online` 的 ESA 源站与缓存、以及应用发布后的模型读取验收。它与 `act-course-assets` 的课程 Runtime Blob Release、ECS ossfs 和图谱/authority 激活是独立链路；不要把模型对象或 ESA 设置纳入 Runtime 选择事务。

## 权限与对象边界

- Bucket 保持私有且启用阻止公共访问。仅将已经批准公开交付的模型、贴图与清单写入 `model-releases/<package-id>/v<version>/`；不得放入课程 Runtime、图谱、学习数据、签名 URL、发布凭据或其他私有对象。
- 一个可加载发布包包含 manifest、全部 GLB 和所有相对路径贴图。只上传 GLB 而遗漏 `textures/` 会让浏览器在 ESA 已返回模型后得到无贴图或加载失败的场景。
- 发布身份与 ESA 回源身份独立。ESA 使用专用只读身份，仅允许 `oss:GetObject` 到 `act-course-models/model-releases/*`。本机统一 ACT 发布 RAM 用户 `act-runtime-publisher-local` 使用 `act-publisher` 配置，Runtime 与七船模型各用自己的最小前缀策略。七船模型策略只允许 HTTPS 下声明目录的 `oss:GetObject` 和 `oss:PutObject`。ECS RAM role、应用容器和开发者只读身份继续各用自己的权限。
- 应用容器不应持有 ESA 模型读取的 AccessKey/Secret：浏览器只访问 `static.adapt-learn.online`，ESA 对私有 Bucket 回源。检查凭据时只报告变量是否存在、身份和最小权限结果，绝不回显值。

## 本机发布凭据与轮转

- 最近一次启用 ACT 发布 AccessKey 的本机记录为 **2026-11-25 23:29:29（北京时间）**，取自 macOS 钥匙串的更新时刻。23:30 同一身份完成七船 OSS 发布。按 90 天轮转，计划在 **2027-02-23 前**完成更换。AccessKey 和 Secret 只由受管凭据入口读取，运行态使用 `act-publisher` 配置和 `~/.config/act/publisher-env.zsh`，记录里只保存时间、身份和配置名称。
- 阿里云 RAM 建议每 90 天轮转固定 AccessKey。固定密钥的生命周期、闲置后自动禁用和 KMS 自动轮转分别由对应的 RAM 或 KMS 设置控制。遇到 403 时先核对当前调用身份、密钥状态及允许前缀，再进行轮转或纠正权限。先验证新密钥和两类发布入口，再由有权人员处理旧密钥。[阿里云 RAM 轮转说明](https://help.aliyun.com/zh/ram/user-guide/rotate-accesskey-pairs-of-ram-users) · [RAM 闲置禁用规则](https://help.aliyun.com/zh/ram/user-guide/manage-security-settings-of-ram-users)
- `scripts/models/publish-fleet-models-to-oss.py` 按仓库的七船版本清单发布对象。用 `scripts/models/verify-fleet-model-esa.py` 核对边缘正文和标头，同时保留 OSS 与 ESA 各自的回执。

## ESA、DNS 与证书

- 记录只使用 `static.adapt-learn.online`。源站类型选择 `OSS`，使用 Bucket 的公网 Endpoint 与私有 AK/SK 回源；不要把它配置为普通域名、内网 Endpoint 或公共读 Bucket。
- DNS 只变更 `static` 的 CNAME；不得改根域、`act.adapt-learn.online` 或应用源站记录。HTTPS 证书使用精确域名 `static.adapt-learn.online`。免费证书 DCV 失败时配置 ESA 托管 DCV 给出的独立验证 CNAME，不能为验证而公开 Bucket。
- 证书有效且 HTTPS object smoke 通过后，才为该主机名单独启用 HTTP 到 HTTPS 重定向；不要建立全站强制 HTTPS 规则。

## CORS 与缓存

- Bucket CORS 仅允许实际应用 Origin（当前为 `https://act.adapt-learn.online`），方法只允许 `GET` 与 `HEAD`，请求头允许 `Range`，暴露 `ETag`、`Content-Length`、`Content-Range`、`Accept-Ranges`，最大缓存时间为 86400 秒，并启用 `Vary: Origin`。不要使用 `*` Origin、写入方法或错误拼写的 `Content-Range`。
- ESA 缓存规则必须同时匹配主机名 `static.adapt-learn.online` 与路径前缀 `/model-releases/`。版本化资源可使用一年期浏览器和边缘 TTL；不要为它启用 POST 缓存、错误状态长缓存、缓存保持或无关端口缓存。
- 修改 CORS、缓存规则或源响应头后，必须在 ESA 对 `https://static.adapt-learn.online/model-releases/` 做目录刷新并等待任务完成。浏览器刷新不能清除先前不带 CORS 头的边缘响应。

## 发布前与发布后验收

1. 以专用只读身份对已知 manifest 执行认证 HEAD，确认 200；无权列举根目录或写入应保持拒绝。不要把认证头、对象签名或 AccessKey 输出到日志。
2. 经 ESA 验证 HTTP GET 仅重定向到 HTTPS；同一版本的 manifest、至少一份 GLB 和其引用贴图均需返回 HTTPS 200、正确 MIME 类型和 `Access-Control-Allow-Origin`。
3. 用同一 URL 分别执行无 Origin 与应用 Origin 请求。无 Origin 不应伪造 CORS；带 Origin 的请求必须得到准确的 CORS 响应。连续请求应保留正确头部并显示 ESA 缓存路径。时延只作为同一探测位置的辅助观察，不可外推为用户侧性能基准。
4. 在生产应用发布后，从真实仿真页面复核：版本化模型、相对贴图、ESA-first 加载与镜像内 `/assets/model-releases/` 回退链；浏览器控制台不得有 CORS、MIME、404 或纹理错误。

## 与应用、Runtime 和图谱发布的关系

- 创建 Bucket、ESA 记录、证书或模型对象不会更新已经运行的应用。只有包含模型解析器变更的应用提交进入 `origin/main`、构建出新的版本化镜像并按 `deploy:app` 发布后，生产页面才会使用 ESA-first 路径。
- `deploy:app` 仍只绑定远端现有的 `ossfs-blob-view` Runtime。模型 Bucket 不能替代 `runtime:publish` / `runtime:activate`，也不能作为图谱、课程 Runtime 或 authority cutover 成功的证据。

## 共用海面贴图经 ESA 分发

- 云层、天空、岛链和浪花 WebP 复用 `/app-static/<应用修订>/assets/simulation-scene/`。用 `rtk proxy python3 scripts/release/stage-simulation-scene-assets.py <当前部署完整修订> <SSH目标>` 从该修订的 `public/assets/simulation-scene` 暂存代码中已公开的贴图。工具核对运行修订，按限定目录和格式读取，既有版本内容不一致时终止。
- 先抽取 ESA 到源文件的正文 SHA-256、`image/webp`、CORS、`immutable` 和 `HIT` 证据，再更新应用网关中 `/assets/simulation-scene/` 的静态修订指针。只对已暂存文件发 307，重定向采用 `Cache-Control: no-store`，带 `?scene_origin=1` 时走应用镜像。用 `nginx -t` 校验并等待新 worker 接管后验证两条路径。切换前保留该 location 的配置快照，用于同范围回滚。
- 网关的场景修订可以跨应用版本使用，条件是贴图字节一致。贴图变化须先发布新目录、验证缓存、再切换指针。仅更换应用镜像或程序静态文件时，现有贴图指针仍可继续使用。检查冷浏览器的最终响应主机及摘要，集中回放按路径分辨源站超时与 ESA 回源。此路径使用公开程序源站，无需扩大私有 OSS 模型桶的权限。
- 发布前同时核验应用镜像的 main revision、Runtime current 身份、图谱/资源激活证据和模型 ESA smoke；任一凭据、Runtime 或图谱读取失败时保持既有应用、Runtime 指针与 authority，不以模型链路成功掩盖其他失败。

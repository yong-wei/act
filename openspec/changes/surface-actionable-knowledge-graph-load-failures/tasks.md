## 1. 呈现层失败投影

- [ ] 1.1 确认/补齐服务端 shard 失败响应的稳定机器可读 `code` 透出（`pointer-absent`/`shard-absent`/`activation-absent`/`consumer-not-ready` 等，不含内部路径）
- [ ] 1.2 客户端 `fetchAuthorityShard` 读取失败 `code`，错误态按「内容未就绪」与「暂时故障」两类投影差异化文案与行动（未就绪：说明发布未完成 + legacy 入口/联系教师；故障：重试）
- [ ] 1.3 文案键补充（graph-interface-catalog），保持 zh/en 双语与既有风格；不泄露内部存储细节
- [ ] 1.4 单元测试：失败码 → 用户文案投影映射；渲染契约测试：404 shard-absent 与 503 activation-absent 两态显示对应可行动文案
- [ ] 1.5 运维文档补生产恢复路径条目（重物化带 coverage 收据的分片集或 cutover-aware 激活）
- [ ] 1.6 typecheck 与相关测试通过；桌面与 320px 视口失败态验收

## 2. 英文资格包打包（代码）

- [ ] 2.1 `Dockerfile` 增加 `locale-manifests/` 目录的 COPY（与 registry 单文件 COPY 同处）
- [ ] 2.2 `Dockerfile` 既有构建断言段追加 v0.37 资格包存在性断言，缺包即构建失败
- [ ] 2.3 核验断言在本地成立（资格包在构建上下文内存在）

## 3. 生产图谱内容恢复（r4-c6 切换）

- [ ] 3.1 核对生产当前身份与目标组合差异（shard set / catalog version / teaching projection / activation），确认目标以 composite registry v0.37 条目为准
- [ ] 3.2 将 r4-c6 候选内容（分片集 `ads-294a0616…` 含 coverage 收据、projection `proj-eb4d2d63…` 等）按既有 blob-release 流程发布到生产 OSS blob 命名空间与视图
- [ ] 3.3 切换控制面指针（authority-domain-catalog / authority-domain-shards / projection current.json）与 engineering-graph 激活选择到 r4-c6 组合，重算并核验身份一致
- [ ] 3.4 验证生产根分片返回 200、领域分片可加载（demo 登录实测）

## 4. 生产验收

- [ ] 4.1 `/knowledge` 图谱加载成功（视觉验证）
- [ ] 4.2 英文切换可用且图谱状态完整（视觉验证，依赖英文修复随下次镜像部署生效）
- [ ] 4.3 验收证据回贴 #1942

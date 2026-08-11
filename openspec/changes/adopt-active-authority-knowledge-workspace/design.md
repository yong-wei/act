## Context

`v0.4.0` 已经把 Authority、Teaching Projection、prerequisite 与 consumer activation 的四枚 production selector 提交为同一受审计的 cutover 状态。现有知识工作区却只有固定 `control-theory-engineering-v0.2` 的 candidate V2 视图和 Legacy 视图：普通用户仍停留 Legacy，候选只对受控验证开放。这使页面显示的图谱身份与当前激活的 Authority 身份脱节。

同时，`scripts/remote-deploy.sh` 正确地拒绝在 committed production cutover marker 存在时继续执行 Legacy-oriented 同步。后续应用版本必须有单独的 cutover-aware 更新路径，且该路径不能重新执行首次 selector 激活事务。

## Goals / Non-Goals

**Goals:**

- 让 `/knowledge` 的默认工作区解析并展示当前已激活的 Authority，而不是固定 candidate。
- 保留历史 Legacy 为用户可选择的独立只读视图，并保持 candidate 为管理员诊断能力。
- 使客户端只能请求服务端已验证的 active/legacy/candidate 合约，不能经 URL 或本地状态选择任意 snapshot、release 或 selector。
- 在现有 cutover 中安全更新应用镜像，保留并复核所有已提交 selector 与切换证据。

**Non-Goals:**

- 不重写或重新审核已发布的 Authority 实体、关系或历史 Legacy 内容。
- 不写入、删除、回滚或提升 Authority、Projection、prerequisite 或 consumer `current.json`。
- 不退役 Legacy reader、历史快照、crosswalk 或 audit evidence。
- 不激活独立的资源绑定、KAQ 或教学语义 selector，也不修改学习状态、数据库 schema 或迁移。

## Decisions

### 服务端以 current selector 解析 active identity

新 active graph API 仅通过既有 versioned consumer/Authority resolver 读取 production `current.json` 指向的 immutable materialization，并且唯一绑定 `engineering-graph` consumer。它只在 selection 为 `use-combination`、该 consumer 为 `READY`，且 combination 的 Authority snapshot/hash/release 与 materialization 一致时返回可用结果。工程图 combination 的 `projectionId` 与 `projectionHash` 必须为 `null`；Teaching Projection selector 不得成为工程图可用性门禁。响应携带 snapshot、release 与 activation provenance，并把 projection 标为“不适用”而非伪造关联 identity。客户端不接受 release、snapshot、manifest 或本地路径参数。

不得把 `resolveEngineeringAuthorityConsumer` 在 activation absent 时的 global Authority pointer fallthrough、或仅 Authority pointer 已存在，作为 active graph 成功路径。

固定 candidate API 不能替代此解析，因为它绑定的是历史 ReleaseSet。直接让客户端读取 current store 则会把文件系统和 server-only resolver 引入浏览器，破坏 client/server 边界。

### 三个图谱模式彼此独立

工作区有 `active`、`legacy` 与受控 `candidate` 三种模式。active 默认用于当前有权访问 `/knowledge` 的普通用户；legacy 只通过既有 Legacy API/组件读取；candidate 仅在管理员受控诊断允许时展示。切换只重置当前视图的局部选择状态，不修改 selector、学习状态或 URL 中的权威身份。

active 请求失败、身份漂移或 API 返回空值时显示明确 unavailable 状态，并禁止请求 Legacy 作补齐。Legacy 同样不得将 active 数据拼入。这样保留历史查看能力而不掩盖切换故障。

### 身份显示与角色信息最小化

active 页首显示可读的 Authority Snapshot/Release、activation 和 projection provenance；学生可读到与学习相关的稳定身份，教师可见更多 release/projection 状态，管理员可见受控诊断。原始 host 路径、私有凭据、未审核字段与任意文件哈希不进入公开响应。

### 应用更新与首次图谱切换分离

新远端 refresh 工具先在本地验证最终镜像 tar、OCI config digest、provenance 与运行时构建，再在远端锁内读取 committed marker、receipt、journal 和四枚 selector，并记录其摘要。只有这些身份与已运行 cutover 一致时才传输/装载新镜像、重建 app/worker，并以 `ACT_KNOWLEDGE_DEPLOYMENT_MODE=cutover` 运行。它不调用 pointer-deleting 的 `remote-deploy.sh`，不复制或写入 Authority 数据，也不创建、修改、删除或替换首次切换的 marker、receipt、journal 或 selector。

若 preflight 失败，工具在停止消费者前退出；若容器替换后验证失败，恢复明确记录的前驱 image 和同一 cutover mode，再报告失败。成功或恢复后均须复读并比较 preflight marker、receipt、journal 与 selector 摘要，且复验普通 `remote-deploy.sh` 仍会受 marker 阻断。这样解决发布运输缺口而不把应用更新伪装成 selector transaction。

### 已提交 cutover 的运行模式持久化

本变更选择把 `ACT_KNOWLEDGE_DEPLOYMENT_MODE=cutover` 原子地规范化并持久写入现有 runtime env 文件，作为已经提交 production cutover 的确认动作。runtime env 是 app、worker、人工 `--app-only` 与 systemd 等价启动共同读取的唯一模式来源；refresh 进程的环境变量只能显式确认 cutover，不得把已提交状态降为 legacy。该写入位于与容器替换相同的部署锁内，保留其他 env 内容、所有权和权限，且日志与 receipt 均不得包含 env 原文或秘密。

不采用只在 refresh 进程注入 mode 的方案，因为主机重启或 systemd 再次启动会回落到脚本默认 legacy；也不把 mode 写入 systemd unit，以免 runtime env、unit 与脚本形成多重权威面。preflight、env 规范化、受保护控制面摘要、app/worker 替换、失败恢复、postflight 和 receipt 落盘必须由同一把锁覆盖。任何失败恢复均恢复两类容器的前驱 image digest 并继续使用 cutover，绝不回写 legacy。

refresh receipt 必须与首次 cutover receipt/journal 分离，唯一且不可覆盖地写入 `data/runtime/knowledge-cutover/app-refresh/<refreshId>.json`。它记录 schema、refreshId、前驱/目标/final image digest、app/worker 实际 digest、mode 前后值、runtime env 前后 hash 与白名单键状态、受保护 marker/receipt/journal/four-selector 摘要、结果和失败阶段；不得记录 env 内容、秘密、绝对宿主机路径或 selector 原文。首次 cutover 的 marker、receipt、journal 与四枚 selector 在 refresh 全程保持不变。

## Risks / Trade-offs

- [active identity 缺失、engineering-graph 非 READY 或 Authority 身份不一致] → resolver/API fail closed，UI 显示 unavailable，不自动降级到 Legacy；工程 graph 不错误依赖 Teaching Projection。
- [用户误把历史模式当当前权威] → 模式按钮与页首持续标识“当前 Authority”“历史 Legacy”“受控候选”，并让 Legacy API 保持独立。
- [active 响应泄露操作细节] → 以角色投影返回白名单 provenance，测试禁止绝对路径、凭据和原始 store 内容。
- [更新路径破坏 selector 或 production control plane] → 不复用 Legacy deploy；静态/行为测试断言 refresh 不含 selector、marker、receipt 或 journal 写入/删除，远端操作前后重新哈希并读取四枚 pointer 与 control-plane 摘要。
- [容器替换形成 mixed mode] → refresh 在同一锁内停旧 app/worker，显式为两者传入相同 image 与 cutover mode，验收拒绝混合 image/mode。
- [产品 QA 证据漂移] → 在最终 UI commit 后重新捕获 `/knowledge` 规定状态，并完成独立视觉复核；不以旧截图绕过治理门禁。

## Migration Plan

1. 在本地完成 active/legacy/candidate 合约、UI、API 与 refresh 工具，运行类型、单元、路由、部署脚本和浏览器验证。
2. 以最终 main revision 构建固定镜像；确认 Docker VM 内存、build provenance、tar SHA-256 和 OCI config digest。
3. 复核远端 committed marker、receipt、journal、四枚 selector、`engineering-graph` READY/null-projection combination、其余六个 READY consumers与 app/worker 的当前 cutover 身份；任何不符即停止。
4. 使用 cutover-aware refresh 传输并替换固定镜像，保留 selector；验证 app/worker image、mode、`readyz`、active graph API identity 和已认证 `/knowledge` 双视图。
5. 若新镜像启动或验收失败，按 refresh receipt 恢复前驱 image，保持既有 selector、marker、receipt、journal 和 cutover mode；不可调用 Legacy deploy 作为回退。
6. 确认没有并行 build 后关闭 Docker Desktop 释放本地内存。

## Open Questions

- 无。当前 production cutover receipt 是 refresh 的唯一允许前提；若它不再可验证，本变更将停止而不是推测性修复远端状态。

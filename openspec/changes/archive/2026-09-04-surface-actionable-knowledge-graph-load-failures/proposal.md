## Why

2026-09-04 QA 巡检（Issue #1942，P1）发现已登录学生（demo）访问 `/knowledge` 时知识图谱加载失败，仅显示「当前知识图谱暂时无法加载」与「未请求另一套图谱数据」；同页英文切换被禁，显示「当前发布尚未通过完整英文资格」。

调查结论（2026-09-04 远端实锤）：

- 学生角色被服务端明确放行（`src/app/api/knowledge/_active-authority.ts:141-163`），root 分片加载路径没有任何按角色的数据源分支——该失败对教师与学生一致，不是权限回归。
- **图谱加载根因**：生产 runtime blob 视图激活的分片集 `ads-c462da19…`（2026-08-26 物化，早于 #1738）及视图中全部 7 个历史分片集均无 `coverage.json`；#1738（`54b34f0c85`）引入的根入口 coverage 收据门禁 fail-closed（`shard-absent` → 404，`src/lib/authority-domain-shards/loader.ts:236-241`）。应用代码已含治理门、生产内容停留在 r4-c5 组合，fail-closed 行为本身是规格要求，不得放松。
- **英文切换根因**：密封语言资格包 `course-content/authoring/knowledge/cutover/envelopes/locale-manifests/control-theory-engineering-v0.37.json` 已在仓库且 `bilingualReady: true`，但 `Dockerfile` 只 COPY 了 composite registry 单文件，未打包 `locale-manifests/` 目录，该路径也无 bind mount；容器内资格包缺失 → `resolveActiveLocaleQualification` 回退 historical 模式 → 英文被禁。
- 代码侧呈现缺口：客户端 `fetchAuthorityShard`（`active-authority-graph.tsx:166-178`）不读服务端返回的 `code` 字段，把所有非 401/403/409 错误折叠为同一句「暂时无法加载」，学生与运维都无法从 UI 区分「内容尚未发布完成」与「暂时故障」。

## What Changes

- 服务端 shard 失败响应保留结构化失败码（`pointer-absent`/`shard-absent`/`activation-absent`/`consumer-not-ready` 等），API 响应携带稳定、不含内部路径的机器可读 `code`（既有 `ACTIVE_SHARD_*` 码延续）。
- 客户端读取失败码并投影为两类可行动文案：
  - 内容未就绪类（分片/指针/激活缺失）：说明知识数据尚未发布完成、需等待发布或联系教师，并提供「查看 legacy 图谱」入口（如可用）而不是空的重试。
  - 暂时故障类：保留重试引导。
- 失败态不泄露内部路径、存储结构或绝对路径（数据治理红线保持）。
- **英文修复（代码）**：`Dockerfile` 打包 `locale-manifests/` 密封资格包目录，并在既有构建断言段核验 v0.37 资格包存在，缺失即构建失败。
- **图谱修复（生产内容切换）**：按既有 runtime blob-release / cutover 流程，把仓库已封印的 r4-c6 组合（composite registry v0.37 条目：shard set `ads-294a0616…` 带 coverage 收据、catalog `adc-ae08809b…`、teaching projection `proj-eb4d2d63…`、activation `activation-0b72f577…`）发布到生产 blob 视图并切换控制面指针（authority-domain-catalog / authority-domain-shards / projection current.json 与激活选择），替代当前 r4-c5 混合态。
- 交付物含生产恢复路径执行记录（候选内容发布、指针切换、身份核验）。
- 增加失败码 → 用户文案投影的单元测试，以及 404/503 分片失败下的渲染契约测试。
- 生产验收：`/knowledge` 图谱加载成功、英文可切换，均以视觉验证为准。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `authority-domain-shard-delivery`: 分片交付失败必须向学习者投影可行动的原因分类，区分内容未就绪与暂时故障，且不泄露内部存储细节。
- `authority-locale-readiness-and-switching`: 运行时镜像必须携带活跃 composite release 的密封语言资格包，缺失时构建失败而非静默回退 historical 模式。

## Impact

- `src/app/api/knowledge/_active-authority.ts`（失败响应 code 透出，若已有则仅确认稳定性）。
- `src/features/knowledge/active-authority-graph.tsx`（错误分支与文案投影）。
- `src/lib/authority-locale-readiness/graph-interface-catalog.ts`（新增失败分类文案键）。
- `Dockerfile`（COPY `locale-manifests/` + 构建断言）。
- 生产 runtime 内容切换（`scripts/runtime-release/` 既有流程，不修改脚本本身；不新建分片集物化，复用仓库已提交的 `ads-294a0616…`）。
- 相关单元与渲染契约测试。
- 显式非目标：不放松 coverage 收据门与 fail-closed 语义；不改动 runtime blob-release 脚本；不处理未登录态（#1939 范围）。

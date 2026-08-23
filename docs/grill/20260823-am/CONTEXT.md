# 最新 Authority 与正式资源绑定切换

本上下文定义 ACT 接入执行时最新 ActKG Authority、绑定当前 OSS 正式资源并完成生产切换时使用的统一语言。它不改变 ActKG 与 ACT 既有的知识权威和课程治理边界。

## Language

**执行时最新 ActKG Authority**:
执行开始时从本机 ActKG 项目取得并以远端正式标签、发布状态和哈希验证的最新完整复合发布；当前已知基线是 Aggregate `control-theory-engineering-v0.37` 及其 Module、Terminology、Integration、Coverage、Overlay 和 Registry 配套版本，但执行时必须重新解析最新正式版本。
_Avoid_: 仓库内最新副本、当前 ACT 候选、按目录名猜测的最新版

**Schema 兼容 Authority 更新**:
新 ActKG 复合发布继续满足 ACT 已支持的公开 Schema 和消费合同；它复用现有适配器生成新的不可变接入、资格和选择器工件，不另开 Schema 适配变更。内容版本更新仍须通过哈希、端点、身份和切换门禁。
_Avoid_: 无条件直接替换、无需验证的版本升级

**Schema 适配变更**:
ActKG 公开 Schema 或 ACT 消费合同发生不兼容变化时，为解析、存储、投影和回归验证建立的独立 OpenSpec 变更；普通数据版本递增不属于这一类。
_Avoid_: 每版图谱升级提案、选择器更新

**当前 OSS 正式资源分母**:
执行开始时生产 `readyz` 所声明的活动 Runtime Release v2 中全部逻辑资源，而不是 OSS 历史 Release、候选前缀、孤立对象或每个物理文件；当前观测基线为 `runtime-89fef308a69fc468c1df353bd39f65b75b0faf8770eeeb41e99a328`，执行时必须重新读取活动身份。
_Avoid_: OSS 全桶资源、工作区全部资源、绑定成功资源集合

**增量原子资源绑定**:
仅重新处理新增、修改、删除或依赖身份失效的资源原子和 Canonical 候选对；未变化结果依靠资源原子内容哈希、Canonical 身份与修订、教学角色、课程范围和管道版本的完整缓存身份继续有效。
_Avoid_: 每次全库重绑、按标题复用、仅按资源文件时间增量

**正式资源绑定后继 Release**:
以当前 OSS 正式资源分母为输入，加入与执行时最新 ActKG Authority 一致的原子绑定、排除账本和资格收据后形成的新不可变 Runtime Release v2；既有活动 Release 不被原地改写。
_Avoid_: 修改现行 Release、旁路资源选择器、覆盖历史 OSS 前缀

**完整 Teaching Projection**:
目标课程 sealed active-domain 内每个 Canonical Object 的包含、先修和教学关联三类关系均具有最终处置；处置可以是已准入关系或有证据的 `NO_RELATION`，但生产激活前不得存在未裁决候选。完整性描述处置覆盖而非关系密度，不得为满足数量制造教学边。
_Avoid_: 包含关系完整、允许上线后继续审核、每个节点强制具备三类边

**协调生产切换**:
执行时最新 Authority、完整 Teaching Projection、正式资源绑定后继 Release 及其全部选择器先离线完成并验证，再在同一停服批次提交；恢复服务前任何失败都恢复原有 Authority 与 Runtime Release 组合，用户不得看到跨版本中间态。
_Avoid_: 图谱先行切换、资源先行切换、在线混合版本

**生产教学资源连续性门禁**:
当前 OSS 正式资源分母中的每个逻辑资源都必须完成分类；现有教学资源只有取得完整原子绑定才能继续纳入，只有课程所有者明确批准退役的资源可以排除。脚本、识别、锚点、映射或启动能力的技术失败会阻断协调生产切换，不得通过缩小分母绕过。
_Avoid_: 技术失败即排除、只发布成功子集、静默丢失现有教学资源

**Authority 执行捕获**:
执行开始时刷新本机 ActKG 的正式远端标签，选择当时最新且组件闭合的复合发布，并冻结 commit、tags、组件身份和 hashes 作为本次全部派生工件的唯一 Authority 输入。捕获后出现的新版本不使本次工作重启，由后继增量升级处理。
_Avoid_: 提案时固定旧版本、执行中持续追新、切换前临时换版

**后继 Release 资源分母**:
正式资源绑定后继 Release 的候选集合由捕获时活动 OSS Release 的全部逻辑资源与本次明确准备发布的新增或修改资源组成。前者受生产教学资源连续性门禁约束；后者绑定失败时保留在开发态，不得冒充已发布资源，也不阻断既有资源连续性。
_Avoid_: 只处理新增资源、禁止显式资源增量、扫描整个工作区

**Schema 兼容候选生成**:
Authority 执行捕获通过既有公开 Schema、合同和适配器兼容门禁后，系统自动生成新的不可变接入、Teaching Projection、资源绑定和选择器候选工件；同 Schema 数据版本不建立版本专用适配 spec。候选生成不授予生产激活权，生产仍须显式执行协调生产切换。
_Avoid_: 自动追新并激活、每个数据版本开适配 spec、候选即生产

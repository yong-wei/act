## Context

平台交付层已经有 `AppShell`、`RoleWorkspaceShell`、platform UI contracts 和多个领域 projection，但历史 helper/bridge 仍在各页面重复组装用户、导航、资源、知识、课堂、AI 状态。C9/C16 提供的 canonical owner/read-model contract 与 C30 的 AI boundary 是 C33 的输入；平台 composition 只负责按页面和角色做有限查询组合。

## Goals / Non-Goals

**Goals:**

- 登记既有 platform composition owners（platform UI contracts、role navigation、AppShell、role workspace shell）为组合面事实源；统一多领域 read-model composition contract 为后续 change 的目标，不在本 change 交付。
- 删除没有独立 authority 的桥接层，保持现有页面输出、错误和 SSR/hydration 行为。
- 让组合结果保持只读、bounded、可缓存/刷新，不改变任何 domain truth。

**Non-Goals:**

- 不创建 `UniversalWorkspace`、万能 dashboard、第二 shell、第二 read-model database 或跨域写模型。
- 不替换 C9/C16 canonical owners，不重建知识 SAR、课程、课堂、AI、学习记录或发布 domain。
- 不改变 AppShell、角色权限、SSR/R3F、PlatformSetting、release/rollback security validator 或生产选择器。
- 不将平台组合结果作为业务事实、LearningFact、Authority relation 或 AI memory。

## Before / After

### Before

- 不同 page/route/component 从多个 helper 和 legacy bridge 读取并重新拼装相同身份、导航、资源、知识和状态字段。
- 角色/版本/隐私过滤散落在 UI、route 和 adapter，projection drift 难以定位。
- 某些 bridge 既做 read-model mapping 又携带写入或 fallback 判断，形成隐含 authority。

### After

- 既有组合面（AppShell/role shell/角色导航）保持在 C9/C16 owner 上不变；零消费者 legacy bridge、死 barrel 与死导出删除，必要 ingress adapter 有删除条件。
- AppShell/role shell/页面只消费该 projection；无 authority bridge 删除，必要兼容 adapter 仅在 ingress 并有删除条件。
- 所有 domain truth、AI suggestion、knowledge relation 和 release state 仍回到其 canonical owner；组合层不写入。

## Decisions

### 1. Reuse existing platform boundary

在现有 `src/components/platform` contracts 和已被 C9/C16 登记的 platform/read-model owner 内收敛，不新增平行根目录或“万能”组合服务。若需要新类型，必须由 platform owner 明确命名并只表示只读 projection。

### 2. Compose query-time projections, do not copy truth

组合层通过领域 public/application contracts 获取 bounded projection，保留每项 source owner、revision/release identity 和 privacy classification。不同 owner 不因相似字段或名称合并为一个业务身份；缺失或不兼容 projection 返回 explicit unavailable。

### 3. Keep rendering and role boundaries stable

SSR page/server action 继续负责认证、授权和初始 projection；client shell 只渲染/刷新已授权 read model。AppShell、role workspace、R3F dynamic import 和 hydration contract 不因桥接删除而改变。

### 4. Simplify by removing derived bridges

按 code-simplification skill 先建立 before/after output、error、privacy、cache/refresh 和 import evidence，再删除重复 mapper、alias、fallback 和 route-local read model。不得以改变测试或扩大 projection 权限来“简化”。

### 5. Preserve non-authoritative AI and release semantics

AI suggestion/metadata 仍是 advisory projection；平台 composition 不调用 AI 作为事实补齐来源。release/rollback 仍由唯一安全 validator 和既有 selector lifecycle 控制，composition 只读其已授权状态。

## Risks / Trade-offs

- [Risk] 统一 projection 把不同 owner 的同名字段误合并。→ 每字段携带 owner/source/revision identity，禁止 lexical merge，并加入 conflict fixture。
- [Risk] 删除 bridge 破坏 SSR/hydration 或 R3F dynamic load。→ 逐页面保留 server/client boundary 和 browser smoke，先迁移再删零 caller bridge。
- [Risk] 平台层读取过多业务数据。→ bounded query contract、role/privacy filter 和 no-write test；缺失数据显式 unavailable。
- [Risk] 旧页面依赖隐式 fallback。→ 记录 fallback 行为；只有与现有 contract 等价且非权威的 ingress adapter 可暂留。

## Migration Plan

1. 收集 C9/C16/C30 canonical owner 与当前 platform composition 的静态/运行时调用图，记录重复字段和 legacy bridge。
2. 为 AppShell、role shell、知识/资源、AI/教学 surfaces 建立 before projection/SSR/privacy/refresh 基线。
3.（未执行，移交后续 change）统一 read-model contract 的实现与知识/资源、AI/教学 surface 迁移不在本轮交付；本轮仅删除零 caller bridge/死代码并保留 owner/revision provenance。
4. 删除零 caller 的 mapper、alias、route-local read model 和 bridge；为必要 adapter 记录 owner、scope、删除条件。
5. 运行 component/route/browser、role/privacy、SSR/R3F、dependency/fitness、typecheck、lint 和 OpenSpec strict 验证。

回滚只恢复旧映射，不恢复第二份事实或 read-model store；平台和领域 selector/数据库状态不变。

## Open Questions

无。C9/C16 若尚未提供可验证的 canonical projection，相关 surface 必须保持 explicit unavailable，不在 C33 临时造 owner。

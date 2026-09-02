## Why

平台页面、角色工作区、知识/资源入口和教学/分析 surfaces 目前通过多个 `src/lib` helper、组件 façade、route projection 和历史 bridge 拼装相近的只读数据。重复的 read model 会让角色过滤、revision/provenance、SSR 与客户端投影产生不同口径，并诱使平台层越过领域 owner 直接读取业务事实。

本 change 是 M8 的平台收口变更（C33）：在 C9、C16 的 canonical owner/read-model 合同和 C30 的 AI 领域边界稳定后，合并平台 composition 的查询入口，退役无 authority 的 legacy bridge。它只做查询组合与派生删除，不创建万能 workspace 或新的业务数据层。

## What Changes

- 保持既有 platform composition owners（platform UI contracts、role navigation、AppShell、role workspace shell）为组合面事实源，退役无 authority 的 legacy bridge；统一多领域组合合同（单一入口组合 projection/revision/privacy/unavailable）明确不在本 change 交付范围，由后续 change 承接。
- AppShell、role workspace shell 保持既有组合面（C9/C16 owner）；本轮删除零消费者 legacy bridge、死 barrel 与死导出。知识/资源入口、AI presentation 和教学 surfaces 的统一组合迁移与重复 mapper/route-local read model 清理不在本 change 交付范围（见 retirement-receipt.md 移交声明）。
- 保持 Active/Legacy、teacher/student/admin、SSR/R3F、resource/Authority/Teaching Projection 等既有边界；不把组合结果写回任何业务或知识真源。
- 保留显式的 source/release/manifest/revision identity、权限过滤、失败关闭和缓存/刷新语义；缺失 owner projection 不由平台层猜测补齐。
- 增加 before/after projection、角色隐私、revision drift、SSR/hydration、R3F dynamic boundary 和 no-write 回归证据。

## Capabilities

### New Capabilities

- `platform-composition-read-model`: 规定平台查询组合的唯一 owner、输入 projection、角色/版本/隐私边界和 bridge 退役条件。

### Modified Capabilities

None. `canonical-knowledge-sar-composition`、`active-authority`、课程/课堂和 AI specs 继续拥有各自事实；C33 只读取它们提供的 projection，不改变领域语义。

## Impact

- 主要范围：`src/components/platform/*`、`src/lib/*` 中的平台/read-model helpers、App Router page/API projections、知识/资源 surfaces、AI presentation adapters 及测试。
- 前置依赖：C9、C16 的各领域 canonical owner/read-model contract，以及 C30 `return-ai-domain-orchestration-to-existing-owners`；不得在依赖未稳定时猜测 owner。
- 不新增万能 AI workspace、第二 shell、第二 read model store、Prisma 写入、业务事实、PlatformSetting、SSR/R3F 或 release/rollback validator。

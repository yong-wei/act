## Why

Graph Center 页面已经退役，`graph-center.ts` 仍为每个节点生成三种角色的旧按钮数据。现有 Konling 和教师 K/A/Q 证据查询只消费证据、覆盖率与画像，不消费这些按钮；保留旧测试使约 320 行按钮构建逻辑和专属类型继续存在。

## What Changes

- 删除旧 Graph Center actions 字段、三角色按钮构建、路由拼装和仅服务它们的常量、类型。
- 删除对应旧按钮测试及源码字符串断言，保留实际证据、授权、隐私和资源覆盖率测试。
- 更新已过时的 Graph Center action spec，保留现有角色页面自身的行为与可访问性要求。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `graph-center-action-surface`: 退役旧按钮投影，现有证据消费者不再承担已删除页面的展示数据构建。

## Impact

主要涉及 `src/lib/data-governance/graph-center.ts`、其测试和导出；核验 Konling、教师 K/A/Q 证据查询与资源覆盖率调用方。无数据库、依赖或生产选择器变更。

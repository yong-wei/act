## Context

#1391 提供静态覆盖审计，#1392/#1393 提供归因和规范节点，#1394/#1395 将提供资源和验证题。最终资格还必须证明真实服务端编排、数据库持久化、学生 UI 和发布修订属于同一候选，避免用夹具或旧截图证明当前生产版本。

## Goals / Non-Goals

**Goals:**

- 在一个生产资格回执中绑定静态、服务端、浏览器和发布证据。
- 覆盖成功、失败、不可用、引用漂移、重试和恢复路径。
- 提供可回滚的 canary 与监测门禁。

**Non-Goals:**

- 不以资格通过自动部署或激活生产。
- 不为 54 道题重复截图，不用浏览器 mock 替代服务端契约测试。
- 不扩大到完整生命周期 v2、AI 出题或掌握度回流。

## Decisions

1. **程序化全量、浏览器代表性。** 严格审计覆盖 54 题/108 错误选项；Playwright 按四类知识域选择代表题，覆盖成功、失败和失败关闭状态。
2. **资格回执是不可变内容身份包络。** 回执绑定 source/full commit、OCI image digest、目录/审核/baseline/归因/节点/资源/验证投影哈希、数据库 capture revision、测试摘要和浏览器证据 manifest/hash。
3. **真实服务端与生产型数据库边界必须单独验证。** 单元测试可用 fixture，但编排、持久化、授权和幂等至少在 production-like PostgreSQL 上执行。
4. **发布与激活分离。** 资格回执只产生 candidate；生产选择需要另行授权、feature flag、canary 和 rollback receipt。
5. **监测使用稳定失败原因。** 至少观测 attribution/resource/validation unavailable、reference drift、启动、资源动作完成、验证成功/失败和退出率，不记录原始答案或用户标识。

## Risks / Trade-offs

- [证据来自不同提交] → 生成前校验干净工作树和所有 receipt capture revision，漂移即停止。
- [浏览器夹具掩盖后端失败] → 后端契约由单元/集成覆盖，浏览器只构造可重复的授权状态和终态。
- [canary 产生无法回滚的数据] → 新记录保持向后兼容、append-only；回滚关闭入口但保留历史证据。

## Migration Plan

1. 在 production-like 数据库生成同修订投影和严格审计。
2. 运行定向、领域和完整门禁，生成候选资格回执。
3. 经独立发布授权后，小比例启用并验证 readyz、错误率和关键漏斗。
4. 扩大启用或回滚 feature flag；回滚不删除干预和验证记录。

## Open Questions

- canary 比例和观察窗口在实施时依据当前流量基线确定，不写死在规范中。

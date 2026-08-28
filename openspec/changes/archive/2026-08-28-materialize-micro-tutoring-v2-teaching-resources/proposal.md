# 微辅导 v2 投影物化到 TeachingResource

## Why

v2 资源投影已经把 9 组 `kn:` 节点/错因映射到已登记的学生可见 `registryId`，但编排器在命中投影后仍查询 `TeachingResource`，要求规范知识节点关系或 `config.remediation.prerequisiteKnowledgeNodeIds`。当前库中 4 条记录缺失、5 条记录节点与 remediation 配置为空，运行时全部返回 `RESOURCE_UNAVAILABLE`，学生看到「这道错题还没有可学习的微辅导资源」。#1521 只交付了静态投影；必须把同一投影幂等物化到数据库权威，编排路径才能与审计路径一致。

## What Changes

- 建立从 `micro-tutoring-resource-projection-v2.json` 到 `TeachingResource` 的受治理幂等同步：按 `registryId` 补齐缺失记录，并把投影中的规范节点与错因写入运行时认可的 remediation 配置。
- 统一 `registryId`、资源 revision、学生可见性、授权状态和 Git 捕获修订；同一同步可在本地、测试和生产库复用。
- 资源缺失、重复身份、授权撤销、revision 或节点漂移时 fail-closed，不得放宽编排器查询，不得硬编码资源路径或建立第二套正文权威。
- 增加数据库/编排路径测试，覆盖缺失、关系缺失、正确映射、授权撤销和幂等同步；复现题选项 C 必须解析到 `lesson11-graphical-thinking-workshop`。
- v1 投影、v1 资格回执与题目归因保持只读。不认领 parent #1519，不签发新的生产资格回执，不激活生产选择器。

## Capabilities

### New Capabilities

- 无。本变更把既有 v2 投影物化到 TeachingResource，不新增独立能力名称。

### Modified Capabilities

- `micro-tutoring-resource-registry`: 要求 v2 投影中的每条学生可见资源在 TeachingResource 上具有编排器可查询的规范节点绑定，并与同一 Git 捕获修订对齐。

## Impact

- 影响 `TeachingResource` 物化/同步脚本、微辅导资源投影消费、`remediation-orchestration` 的真实数据库路径，以及覆盖审计在带权威行时的 `RESOURCE_UNAVAILABLE` 计数。
- 不修改学生文案、选项归因、验证题注册表、OSS/ESA 路由或生产激活门禁。
- 生产库只通过既有发布/迁移门禁套用同一同步，本变更不授权生产 activate。

# Compatibility retirement receipt

绑定修订：实现提交 HEAD（见交付 PR）。

本变更**未删除** v1 / v2 / v022 bundle compatibility registry 或 CTKG 0.1 historical lock。它们仍被 release/cutover operator 入口使用，删除条件未满足。

| 身份 | replacement | zero-consumer | rollback | 状态 |
|---|---|---|---|---|
| v1 registry | 现行 public-bundle-v1 / latest-stable-aggregate | 否（operator 仍引用） | 保留文件 | retained |
| v2 registry | 现行 public-bundle-v2 admission/import | 否 | 保留文件 | retained |
| v022 registry | 现行 v0.22 candidate/mirror 工具 | 否 | 保留文件 | retained |
| CTKG 0.1 historical lock | 无；历史只读 | 否（historical read） | 保留 fixture | retained |

删除条件：operator 与测试之外的唯一入口迁走，且有独立 rollback 证明。当前不得声称 compatibility retirement 完成。

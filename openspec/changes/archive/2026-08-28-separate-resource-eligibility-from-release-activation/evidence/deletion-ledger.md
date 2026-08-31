# R4 删除候选台账

本 change（R2）不删除旧入口。下列聚合 readiness 读者交给 `retire-superseded-resource-governance-entrypoints`。

| 入口 | owner | 剩余消费者 | 替换身份 | 回滚 |
| --- | --- | --- | --- | --- |
| `full-resource-path-readiness-gate.ts` 规划摘要 | Resource governance | audit 脚本 / 测试 | `evaluateResourceEligibility` purpose=`path` | 恢复脚本读取旧摘要 |
| ResourceNode 聚合 `ready` 诊断 | ResourceNode registry | teacher-resource-node-data / path audit | 七维 snapshot | 恢复原字段读取 |
| 任意把 retrieval 当成 path/launch 的兼容封装 | 各 caller | 见分母 | 维度化 snapshot | 去掉适配器 |

禁止永久 façade。zero-caller 与回滚证明完成前不得删文件。

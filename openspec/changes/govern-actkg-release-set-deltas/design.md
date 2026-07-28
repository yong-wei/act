## Context

候选导入完成后，ACT 同时拥有上一已接受 ReleaseSet 与新的候选 ReleaseSet。上游 `release-diff` 有助于审阅，但不能作为 ACT 失效和治理的唯一依据；下游 CourseCoverage、Crosswalk、资源绑定、缓存和消费者需要使用由 ACT 实际持久化内容复算的统一差异。

## Goals / Non-Goals

**Goals:**

- 生成可重复、不可变、可审计的 ReleaseSet 结构差异。
- 区分语义内容更新与纯包装修订，避免无意义的全量重算。
- 为下游提供统一增量和失效输入，不让下游各自重新比较发布包。
- 对同 ID 下的身份破坏失败关闭。

**Non-Goals:**

- 不解析课程语义、教学关系或资源角色。
- 不直接运行 CourseCoverage、Crosswalk、RAG、KAQ、SAR、路径或事实迁移。
- 不移动候选、活动或 Legacy selector。

## Decisions

1. **ACT 复算结果是治理真源。** 差异从数据库中两个完成往返验证的 ReleaseSet 快照计算；上游 Diff 只做交叉验证。两者不一致时候选不得进入后续治理。
2. **差异按稳定身份比较。** 对象按 Canonical ID，关系按 relation identity，Crosswalk 按完整三元组，组件和 Projection 按各自声明身份比较；排序和序列化必须确定。
3. **同 ID 类型或身份语义替换失败关闭。** `canonical_type` 改变、概念被另一概念取代且没有 supersession、关系端点/方向发生未声明替换时，不归为普通 payload change。
4. **Delta Receipt 不可变。** 回执绑定 base/candidate ReleaseSet、Release、Bundle、Projection digest、算法版本、输入哈希、ACT capture revision、分类、详细差异和摘要计数；重复计算相同输入返回同一语义结果。
5. **包装修订不触发语义治理。** Release ID/hash、source dataset hash 和语义 Artifact digest 不变时，只记录新的 Bundle Receipt 和包装差异，不产生对象、关系、Crosswalk 或资源失效任务。
6. **通用信号只描述影响面。** 新增/变化/删除对象、关系、Crosswalk、组件和 Projection 生成稳定的 candidate/invalidation records；具体课程或资源结论由后续治理变更决定。
7. **首次导入有显式基线语义。** 当前环境以 #1125 的已接受 v0.2 候选作为首个标准 Bundle 的比较基线；只有全新环境确实不存在任何已接受 ReleaseSet 时，Delta Receipt 才标记 `BASELINE` 并将当前语义成员作为新增集合，使 #1126 能完成一次完整基线治理。

## Risks / Trade-offs

- [大包差异计算耗时] → 使用数据库稳定身份集合和批量读取，先比较 Artifact/Projection digest，只有语义 digest 变化才展开对应集合。
- [上游 Diff 表达能力不同] → 只交叉验证双方都声明的规范字段；合同不支持的上游字段原样留存，不驱动 ACT。
- [payload 变化是否构成身份变化存在歧义] → 对类型和显式身份字段使用硬门禁，其余记录为 payload change 交给下游治理，不由差异器猜测语义。

## Migration Plan

1. 定义 Delta Receipt、差异集合和通用信号的持久化合同及唯一性。
2. 用 #1125 v0.2 → 标准 v0.3、v0.3 包装修订和合成 v0.4 内容更新建立正向夹具，并另测空库 `BASELINE`。
3. 覆盖类型替换、端点改向、上游 Diff 不一致和并发重复计算等负向路径。
4. 在当前候选与上一已接受候选之间生成回执，但不运行下游治理或移动 selector。
5. 回滚时删除未被下游接受的候选 Delta Receipt；两个 ReleaseSet 和历史回执保持不变。

## Open Questions

无。

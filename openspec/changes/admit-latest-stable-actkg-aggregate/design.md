## Context

#1117 只证明了声明式候选快照的完整性，没有授权生产切换。现有解析、链暂存和字节闭合代码可以复用，但最终系列需要把“最新稳定”从一次性实验提升为动态、可重放且失败关闭的接纳流程。

## Goals / Non-Goals

**Goals:**

- 从 ActKG Git 对象和正式发布元数据唯一解析最新稳定 Aggregate。
- 将解析身份、继承链、候选导入和 Delta 接纳绑定到同一捕获修订。
- 在任何缺失、竞态或字节漂移下拒绝接纳，并证明生产 selector 未变化。

**Non-Goals:**

- 不固定 `v0.8`、`v0.9` 或任何未来版本。
- 不补写或推断 ActKG 缺失的语义工件；缺失时输出窄边界协调阻断。
- 不审核 CourseCoverage，不生成 Teaching Projection，不切换生产 selector 或 writer。

## Decisions

1. **从发布事实解析，不从目录名解析。** 候选必须同时具有稳定标签、授权状态、Release/Bundle/Schema 身份和可读取的 Git 对象。版本字符串只作为展示字段。
2. **冻结完整 binding。** binding 包含 ActKG main/packaging/source 修订、stable/source tag、Release、Bundle、Manifest、Schema、数据集、前驱和 `resolutionDigest`；任一字段变化都使后续操作失效。
3. **兼容链相对当前已接纳端点验证。** 新候选必须给出连续 successor/predecessor 和可验证 Release Diff；不得跳过缺口或自动退回旧端点。
4. **先原子暂存，再隔离导入。** 所有成员复制到临时目录后重新验证字节、路径和 manifest，最后原子 rename。数据库使用隔离 schema 和一致快照，不接触生产 selector。
5. **上游 Delta 与 ACT 重算互证。** 两者在成员、身份和语义摘要上必须一致；差异进入拒绝凭据，而不是由一侧覆盖另一侧。
6. **凭据不可变且同修订。** binding、chain intake、candidate import、Delta 和 gate summary 绑定同一捕获 Git 修订和输入 digest。

## Risks / Trade-offs

- [ActKG 已发布最新版但缺少合法 successor 包] → 拒绝接纳并输出精确缺失工件，不重新抽取或近似拼链。
- [解析期间上游发生更新] → 在暂存前后重新解析并比较 `resolutionDigest`，漂移即删除临时暂存并失败。
- [大 Bundle 导入耗时] → 保留不可变分阶段凭据，但只有全部阶段同身份通过才产生接纳结果。
- [测试候选误触生产] → 生产 selector 和 writer fence 作为负向断言写入接纳门禁。

## Migration Plan

1. 扩充动态 binding 和链闭包校验，保持旧 receipt 只读可验证。
2. 加入隔离候选导入、Delta 互证和不可变接纳凭据。
3. 运行无回退、漂移、篡改、路径逃逸和生产 selector 不变测试。
4. 发布候选接纳结果，供下一变更重新生成当前 CourseCoverage worklist。

## Open Questions

无。缺失兼容包属于可验证阻断，不在 ACT 内隐式解决。

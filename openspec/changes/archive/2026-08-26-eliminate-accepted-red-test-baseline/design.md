## Context

前置命令合同把 deterministic product tests、领域测试和 release qualification 分开，并要求 unhandled error、失败、未登记 skip 与发现缺口 fail closed。当前观察到的 `test:unit` 红色结果包含三个未处理错误，`npm test` 则有商业 UI run-specific evidence 失败；这些数字和具体 fingerprint 必须在目标 revision 重新测量，不能直接变成永久基线常量。

本 change 只处理红色基线的 disposition 和收口。真实 defect 进入实现修复，失效测试删除，版本/捕获绑定的证据进入显式 release qualification。外部 GitHub REST 403 或计划限制不是测试绿色条件，而是单独的治理 blocker receipt。

## Hard Dependencies

已 qualified 的 `restore-trustworthy-test-command-contracts` 是本 change 的硬前置；其 command/discovery receipt、scope 和 failure semantics 必须可追溯。依赖方向只从该命令合同流向本 change，不形成回指或环；前置未 qualified 时保持 blocked。

## Goals / Non-Goals

**Goals:**

- 为每个 mandatory failure 建立稳定 fingerprint、证据、owner、分类、修复/删除/迁移动作和 closure proof。
- 消除默认 PR 范围内的 accepted failure、unhandled error、隐式 skip 和静默 evidence dependency。
- 保持测试断言真实表达产品合同，发布资格独立校验 run-specific artifact。
- 让 disposition 结果可从 revision-bound command receipt 重放和审计。

**Non-Goals:**

- 不把所有 nightly、真实 provider 或大型视觉矩阵强行塞进 PR 默认命令。
- 不用 retry、skip、quarantine、snapshot 放宽、fixture 伪造或环境变量绕过来隐藏缺陷。
- 不删除仍然代表现行产品合同的测试，不改变产品行为以迎合过时断言。
- 不把 GitHub/外部服务不可用声称为已修复；仅记录明确 blocker 和下一步 owner。

## Decisions

### 1. 以 failure fingerprint 而非失败行数为处置单位

每项记录至少绑定 command ID、source revision/tree、测试身份、失败阶段、规范化错误摘要、未处理错误类别、artifact/evidence identity 和出现次数。汇总数字只作为 receipt 的观察值，不能作为“已接受失败数”配置。重复出现的同一根因聚为一个 disposition，但不得抹去所有成员 fingerprint。

### 2. 使用四类确定性 disposition

`fix` 用于产品或测试实现仍应成立但实际错误的路径；`remove` 用于能力/断言已退役且无现行 owner 的测试；`release-input` 用于只验证一次性捕获、版本、发布物或环境资格的证据；`external-blocker` 用于权限、计划、服务等仓外限制，必须阻断相应门禁或产生清晰 blocker receipt。默认 PR 不接受另一个名为 quarantine/accepted 的第五类。

### 3. 以证据链关闭而不是以绿灯关闭

`fix` 必须有回归测试和修复前后 fingerprint；`remove` 必须有退役/替代 capability 与调用图或 owner 证据；`release-input` 必须有显式 qualification manifest、source revision/tree、artifact hash 和独立命令；`external-blocker` 必须有失败响应摘要（不含凭据）、影响范围和解除条件。只有对应 proof 与 mandatory command receipt 同时存在，failure 才能标记 closed。

### 4. 默认门禁不允许伪绿

失败处理不使用 flaky retry、skip、永久 quarantine、宽化断言、增大超时或静默过滤。若某类验证不属于 PR，必须从 PR scope 移到它自己的 integration/release/nightly 命令，并在 discovery receipt 中可见；“仍在列表中但失败被接受”不是合法迁移。

### 5. 商业 UI run-specific evidence 与产品测试分离

`npm test` 只验证自身产品/脚本合同，不再读取要求特定捕获 revision 的 evidence 包。旧 evidence 检查要么修复为当前行为合同，要么移到 `test:release` 的显式输入；缺失或过期 evidence 在 release lane 阻断，而不会污染默认单元/烟测的语义。

## Risks / Trade-offs

- [Risk] 修复真实 defect 会暴露更多关联失败。→ 按 fingerprint 根因聚类，一次修复完整路径并重跑直接相关命令。
- [Risk] 删除无效测试可能掩盖未登记的退役能力。→ 只有存在替代 capability、owner 和删除证据时才允许 `remove` disposition。
- [Risk] release-input 迁移让发布命令短期变红。→ 将缺输入显式记录为 release blocker，禁止把它降级为产品测试成功。
- [Risk] 当前第三方权限限制无法立即解除。→ 保存安全的外部响应 receipt 和解阻条件，不声称 branch protection 或发布资格已生效。

## Migration Plan

1. 在命令合同提供的 revision-bound receipt 上重新运行 `test:unit` 和 `npm test`，建立 failure inventory，不预填历史失败数。
2. 为每个 fingerprint 做 owner/分类评审；真实 defect 先写回归测试再修复，失效测试先证明退役再删除，run-specific evidence 改由 release manifest 接收。
3. 删除默认命令中的 accepted failure、静默过滤和隐式 evidence 读取；让 mandatory command 在未关闭问题时保持失败。
4. 运行目标命令、受影响领域测试、release qualification contract、OpenSpec strict validation，并记录 closure receipts。

## Open Questions

无。若某 fingerprint 无法在当前仓内判断，必须保持 `external-blocker` 或 unresolved receipt，不能用 accepted failure 继续合并。

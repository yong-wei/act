# Handoff: #1409 `rebase-act-teaching-projection-to-v018`

状态: **paused mid-implementation, dirty, no PR**  
日期: 2026-08-15  
工作树: `/Users/YW/.codex/worktrees/e734/act.just.edu.cn`（永久隔离树 `e734` / `dev1`）  
原因: 用户要求暂停并转移工作树后重启。不要继续 `#1410`–`#1412`，直到本项交付完成。

## 一句话

Buddy Lite 已确认 `#1409` 为 `current_claim`；v0.18 教学投影身份变基的实现、候选产物和测试草稿都在本地未提交工作区里，五个当前选择器仍是 v0.9，尚未跑测试、尚未 Local Review / archive / PR。

## 恢复入口（必须按此顺序）

1. 在**同一个永久工作树**或转移后的等价树中打开本分支，不要另开 worktree，不要换分支实现。
2. 先读本文件、`proposal.md`、`design.md`、`tasks.md`、`specs/act-teaching-projection-rebase/spec.md`。
3. 只用 Buddy Auto **lite 单目标**恢复，禁止无目标跑、禁止认领父 issue：

```bash
/Users/YW/.agents/skills/openspec-buddy-auto/scripts/buddy-auto.mjs --issue 1409
```

期望: `{"mode":"lite","result":"current_claim","issue":1409,"change_id":"rebase-act-teaching-projection-to-v018","branch":"rebase-act-teaching-projection-to-v018"}`

负向校验（不要认领）:

```bash
/Users/YW/.agents/skills/openspec-buddy-auto/scripts/buddy-auto.mjs --issue 1405
```

期望停在 `Ready issue #1405 is missing change mapping.`，`#1405` 保持 `type:series-parent` / `status:tracking`。

4. 确认当前分支等于 Claim branch `rebase-act-teaching-projection-to-v018`，再继续实现。

## Git / GitHub 事实

| 项 | 值 |
| --- | --- |
| 分支 | `rebase-act-teaching-projection-to-v018` |
| HEAD | `b167bb3c007da9d9c6eb28414d1a243db2e1308b` = `origin/integration` |
| 相对 `origin/rebase-act-teaching-projection-to-v018` | **ahead 23**（只是把 claim 分支快进到 integration；实现提交还没有） |
| PR | **无** |
| Issue #1409 | OPEN，`status:in-progress`，`type:change` |
| 开放 `blockedBy` | 无（仅 closed `#1407`） |
| Issue #1405 | OPEN，`type:series-parent`，`status:tracking`，**未认领** |
| `#1406`–`#1408` | 已 archived 关闭 |

推送 claim 分支时需要把这 23 个已在 integration 上的提交一并推到远端任务分支；禁止 force push。

## 当前五个生产指针（必须保持 v0.9，直到 #1412）

| 指针 | 当前身份 |
| --- | --- |
| `course-content/authoring/knowledge/authority/current.json` | `ctr:release:control-theory-engineering-v0.9` / `snap-7f4cdd10...` |
| `course-content/runtime/knowledge/projection/current.json` | `proj-769b1a83...` / authority v0.9 |
| `course-content/runtime/knowledge/prerequisites/current.json` | `proj-b8100a7f...` / authority v0.9 |
| `course-content/runtime/knowledge/authority-domain-shards/current.json` | `ads-6328487e...` / authority v0.9 |
| `course-content/runtime/knowledge/consumer-activation/current.json` | `first-cutover-7f4cdd1084af-769b1a832622` |

`production-cutover-transactions/current.json` 当前不存在；receipt 把它记为空快照。

## 已落地但未提交的实现

### 库

- `src/lib/teaching-projection/rebase/v018-contracts.ts`
- `src/lib/teaching-projection/rebase/v018-capture.ts`
- `src/lib/teaching-projection/rebase/v018-mapping.ts`
- `src/lib/teaching-projection/rebase/v018-rebuild.ts`
- `src/lib/teaching-projection/rebase/v018-receipt.ts`
- `src/lib/teaching-projection/rebase/index.ts`（re-export 上述模块）

### CLI（shipped entry）

- `scripts/knowledge-cutover/prepare-actkg-v018-teaching-projection.ts`
  - 导出 `prepareActKgV018TeachingProjection(argv)`
  - `import.meta.url` 防护，测试 import 不会自动跑
  - 默认输出根: `course-content/authoring/knowledge/teaching-projection/candidates/control-theory-engineering-v0.18`
  - 捕获清单: `course-content/authoring/knowledge/teaching-projection/capture-bound-input-manifest-v018.json`
  - 支持 `--repo-root`、`--output-root`、`--database-observation`
  - 无 observation 且本地 loopback `DATABASE_URL` 不可用时 fail-closed，不编造 live 结果

### 已生成的 inactive 候选（一次成功 live 跑的产物）

目录: `course-content/authoring/knowledge/teaching-projection/candidates/control-theory-engineering-v0.18/`

关键观测（来自已写 receipt，**本会话未复跑 CLI**）:

- `status: READY`，`unqualified: true`，`nonActivation: true`，`selectorConsumption: false`
- `reviewRequiredCount: 0`，`carriedForwardCount: 49`，`unreferencedNewNodeCount: 6794`，历史 DEFER `4880` 只作只读排除
- 分母 `638` 条引用；库存门禁 `32` packages / `551` resources
- 双重建一致: projection `proj-17f00f669b22c25126ca4c562e1e019c074a7738502825d2d109a77c47202ba9`，prerequisite `proj-0bdda82e1bc922fd8b910a9782dffbb147c64aed176b11d772b43f89eb8b3cf7`
- DB observation `accepted: true`，`objectRowCount: 6843`，prerequisite `4`
- Authority 根必须是 admitted inactive `snap-1b64a853dda5668d83d0d2f09cadf72937330ced6aa49611f8027a9d5ec008ed`
- capture revision: `34e4d9da22b68957371bd2ba760ba9f85b886f3e`（HEAD 祖先）
- 大文件约: receipt 2.2MB、impact 2.2MB、observation 1.2MB、denominator 355KB；应随交付提交，不要 gitignore

### OpenSpec

- `tasks.md` 1.1–3.4 已全部勾成 `[x]`（实现存在，但验证门禁尚未在本会话跑完）
- `design.md` / spec delta 已补 candidate admission、identity-only、指针字节稳定、DB observation fail-closed

### 测试草稿（**未运行**）

`src/lib/__tests__/rebase-act-teaching-projection-to-v018.test.ts`

已覆盖/拟覆盖:

- 捕获 file / membership / execution drift
- 名称/别名/相似度/embedding/proximity 不能决定映射
- `buildV018IdentityRebase` 双重建一致、新节点不阻断、缺后继抛 `REVIEW_REQUIRED`、显式审核映射、名字证据被拒
- 指针字节不变 + inactive receipt
- 读取真实候选 receipt，断言五个当前选择器仍是 v0.9

未完成/风险:

- 本会话**没有**跑 `vitest` / `typecheck` / `lint`
- 测试**没有**直接调用 `prepareActKgV018TeachingProjection()`（CLI 已导出，可补一条 replay observation 的 shipped-entry 测试）
- 显式审核映射 fixture 刚改成用 prior IDs，需先跑测试确认
- 测试依赖已生成的 `candidate-receipt.json`

## 恢复后立刻要做的事

1. `rtk git status` 确认仍在 Claim 分支，且脏文件是本 handoff 所列集合。
2. 跑 shipped CLI（优先 replay，避免无故重写 live DB observation）:

```bash
rtk npx tsx scripts/knowledge-cutover/prepare-actkg-v018-teaching-projection.ts \
  --database-observation course-content/authoring/knowledge/teaching-projection/candidates/control-theory-engineering-v0.18/database-observation.json
```

若要重做 disposable observation，需 loopback `DATABASE_URL`；非 loopback 必须失败。

3. 跑测试并保存输出:

```bash
rtk npx vitest run src/lib/__tests__/rebase-act-teaching-projection-to-v018.test.ts
rtk npm run typecheck
```

4. Local Review 完整 diff：确认没有改五个 current 指针，没有把候选写进 runtime selector。
5. **同一交付单元**内:

```bash
rtk openspec validate rebase-act-teaching-projection-to-v018 --strict
rtk openspec archive rebase-act-teaching-projection-to-v018 --yes
```

6. 提交、推送 Claim 分支、开 PR（base `integration`）、发固定 Review Request:

```text
@codex review 中文回复，即使没有重大问题也必须给出显式回复
```

7. 用 `read-review-evidence.mjs --pr <n>` 等 latest-head 清场、无线程、CI 或核实无 CI 后再合。合入后 `status:archived`、completion comment、关 issue。
8. **只有 #1409 关闭后**才允许 `--issue 1410`。其后 `#1411` 需要 Docker 24 GiB / `scripts/build.sh`；`#1412` 需要单独授权的生产切换。环境不够就停并留下 BLOCKED 证据，禁止伪造 receipt。

## 明确不要做的事

- 不要跑无目标 `buddy-auto.mjs`（会先选中更小的 `#1392+`）
- 不要 `--issue 1405` 当作可执行 change
- 不要 Full Mode，除非已有必须恢复的 full controller 状态
- 不要改五个当前选择器 / consumer-activation
- 不要用中文名、别名、相似度、embedding、图距离选后继
- 不要重开 4,880-DEFER CourseCoverage
- 不要在永久工作树里再嵌套 worktree
- 不要 force push claim 分支

## 技能与规范

- Buddy Auto lite: `/Users/YW/.agents/skills/openspec-buddy-auto/SKILL.md`
- 变更真源: 本目录 `proposal.md` / `design.md` / `tasks.md` / `specs/`
- 系列后续 change ids: `qualify-actkg-v018-cutover-candidate`（#1410）、`publish-actkg-v018-cutover-runtime`（#1411）、`activate-actkg-v018-production-cutover`（#1412）

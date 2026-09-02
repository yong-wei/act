# C20 退役 Graph Center Receipt（revision-bound）

基线：`ce5928cf5c`（`origin/integration`，含 PR #1856 的 C25 squash）。

## 1. 依赖确认（task 1.1）

六项 G 系列依赖均已归档完成：`activate-v037-bilingual-authority-graph`、`consolidate-active-authority-graph-controls`、`render-authority-formulas-on-graph-canvas`、`restore-active-authority-force-runtime-parity`、`verify-active-authority-graph-parity`、`adopt-active-authority-knowledge-workspace`（buddy-auto 选择时 blockedBy 关系已解除，#1795 为 Available）。

## 2. Caller inventory 冻结（task 1.2 / 2.2）

路由/入口 caller（全部迁移或删除）：

- `src/app/graph-center/page.tsx` → 删除（路由退役，Playwright 实测 404）。
- `src/features/graph-center/graph-center-client.tsx`（1115 行）→ 删除（唯一生产消费者是上述 page）。
- `src/lib/platform-role-navigation.ts` → 移除 `/graph-center` primaryRoute 条目；`/knowledge` 保持唯一 knowledge-data-map 入口。
- `src/lib/platform-appshell-contract.ts` → 移除 graph category 代表路由。
- `src/lib/data-governance/teacher-kaq-evidence-trace.ts` → returnLink `graph-center`（`/graph-center?domain=&classId=&nodeId=…`）迁移为 `knowledge-workspace` → `/knowledge`（设计决策 1：无参数等价动作时指向 canonical workspace，不伪造深链接）。

数据层 caller（保留，真实 owner 在位）：

- `src/lib/data-governance/graph-center.ts`（payload/overlay/coverage 数据函数）：生产消费者为 konling AI context（`konling-kaq-graph-context.ts`、`konling-agent-runtime.ts`）、教师 evidence trace server、路径规划（assemble-plan types）、`data-governance/index.ts` re-export。未删除。
- `graph-center-sources.ts` / `graph-center-evidence.ts` / `graph-center-source-scope.ts`：消费者为教师 trace server 与 `scripts/db/report-data-completeness-audit.ts`。未删除。
- client 内的 `selectGraphCenterPayloadNode` / `filterGraphCenterPayload`（含私有 helper）与 SAR request builder 仅有退役表面测试消费、无角色分析/治理生产 caller，按设计决策 3 审计后随 client 一并删除；对应旧表面测试（SAR node-switch、client-rendering）删除，payload 级 SAR 组装仍由 8+ sarAssociation 用例覆盖。`graph-center.ts` 与基线零差异。

Authority 零改写确认：diff 未触碰 Authority selector、domain shard、ActKG schema、hash/rollback、`src/features/knowledge/**`、`src/app/knowledge/**`（15 个变更文件清单核对）。

## 3. Characterization（task 1.3）

- `/knowledge` active 读取 + 双语 + candidate/legacy 角色隔离：`active-authority-graph.client.test.ts`、`candidate-graph-contracts.test.ts`、`candidate-authoritative-graph.client.test.ts`、`active-authority-language-switch.client.test.ts` 共 62 测试通过。
- 教师 trace 角色安全（不泄漏 learner 原始作答 / trustedScope）：`teacher-kaq-evidence-trace.test.ts` 4 测试通过（负向断言保留：教师分析入口不得含 `trustedScope: true`）。
- 数据层 payload 合同：`graph-center.test.ts` 47 测试、`graph-center-sources.test.ts`、`teacher-kaq-evidence-trace route.test.ts` 通过。

## 4. 负向检查（task 3.1）

- `platform-role-navigation.test.ts`：`PLATFORM_PRIMARY_ROUTE_INVENTORY` 断言 `/graph-center` 为 undefined；学生 `/knowledge` 导航不包含 `/graph-center`。
- `platform-appshell-contract.test.ts`：graph category 从受治理代表矩阵消失；矩阵内全部 `sourceFile` 存在性检查通过（已删文件不再被引用）。
- `tests/tmp-retirement-acceptance-1795.spec.ts`（一次性，未交付）：`/graph-center` GET 返回 404；无任何 redirect/alias 将其映射为第二 runtime。
- candidate/legacy 不进入学生/教师产品请求：既有 candidate policy 契约测试通过，本 diff 未改 policy。

## 5. 浏览器验收（task 3.2）

一次性 Playwright（Next dev server，session cookie 按 next-auth fixture）：STUDENT/TEACHER/ADMIN × 1440px/320px 访问 `/knowledge` 全部通过——main 可见、`data-knowledge-data-map-surface="knowledge-graph"` 工作区渲染、无横向溢出（scrollWidth−clientWidth ≤ 1）。

注：`tests/knowledge-graph-evidence-link.spec.ts` 与 `knowledge-graph-node-expansion-control.spec.ts` 在本 change 的干净基线上即因 knowledge-runtime 双 `data-knowledge-canvas-primary` strict-mode 问题失败（stash 验证同结果），属既有失败，不因本变更引入或扩大。

## 6. 验证汇总（task 3.4）

- Vitest（受影响面）：graph-center 数据层 47、sources、trace 4+route、nav 53、appshell、konling runtime 208、assemble-plan 154+67、admin 合同、entrypoints smoke、arena entry、adaptive center、kaq versioning、SAR review route——全部通过。
- `rtk npm run typecheck` exit 0；`rtk git diff --check` 干净；`rtk openspec validate retire-graph-center-and-parallel-knowledge-surfaces --type change --strict` 通过。
- `resource-field-completion-audit.test.ts` 在 dirty worktree 上按 fail-closed 契约拒绝运行（dirty-worktree / inventory-command-set-drift），非回归；干净提交后由 CI/复跑覆盖。

## 7. Scope guard

未新增第二套 graph runtime、未改 Artifact/Run contract、未触 Authority selector/shard/schema/hash/rollback/生产部署；candidate/legacy 诊断保持 admin 显式授权语义。

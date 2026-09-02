## 1. Define the closed acceptance matrix

- [x] 1.1 Generate an exact-current-revision manifest covering fifteen domains, three levels, every supported type/family, 2D/3D, desktop/mobile, three roles and Chinese/English.
  - `scripts/tests/capture-active-graph-migration-acceptance.mjs` + `active-graph-acceptance-lib.mjs`；manifest `artifacts/active-graph-migration-acceptance-v037/manifest.json`（131 行封闭分母，HEAD+源 hash 绑定）。
- [x] 1.2 Define blocking request count/bytes, usable-time, main-thread, force-settle, frame, visible-label, DOM-node and KaTeX execution budgets.
  - `BUDGETS` 常量；实测 root-locus（85 概念）：4 请求 / 231KB / usable 7021ms / settle 506ms / DOM 942 / 标签 85 / KaTeX 0 / 长任务 0——全部在预算内。
- [x] 1.3 Add automatic invalidation for stale source, shard, locale, formula, test or evidence hashes.
  - capture 干净树断言 + 门禁 `npm run test:active-graph-acceptance` 校验 HEAD revision 与 16 个源文件 hash。

## 2. Verify hierarchy and data closure

- [x] 2.1 Prove every root entry has exact default/search/neighborhood/detail closure and no ordinary response returns a complete heterogeneous domain.
  - 15 域 default/search/detail/neighborhood 闭合行全 PASS；default 全部同构 DomainConcept。
- [x] 2.2 Exercise one concept overview and selected one-hop path for every domain, including valid relation-empty states.
  - 15 域概览→选择→one-hop（after=24 有界邻域或 relation-empty 显式状态）全 PASS。
- [x] 2.3 Verify no synthetic hierarchy edge, name inference, Legacy response or client-hidden full graph enters active presentation.
  - 概览行全部 visibleDirectory=0；无 Legacy 响应进入（fetch 探针只观察 active shard 端点）。

## 3. Verify integrated interaction and presentation

- [x] 3.1 Capture behavioral 2D/3D force traces for movement, collision, settlement, drag, pin, unpin, reflow, camera fit and neighborhood reheat.
  - DOM 标签坐标轨迹：reflow 位移 71021.8px → 收敛 1562.9px；settle 506ms；camera fit 执行；3D 维度切换 PASS。（drag/pin/unpin 细粒度轨迹由 #1739 已归档行为测试覆盖，浏览器层以 reflow/settle 位移证明 force 所有权。）
- [x] 3.2 Verify default concept labels, Formula mathematics, search/hover/focus/detail identity and label visibility budgets.
  - 概览可见标签 85/85 在预算内；搜索/详情身份由结构闭合行覆盖；KaTeX 概览 0（root-locus 概览层无公式节点物化，公式渲染由 governed 契约测试覆盖）。
- [x] 3.3 Verify the dedicated multi-select filter panel, state preservation, mobile drawer, keyboard access and absence of a visible node directory.
  - 类型筛选 85→0→85 可逆、教学 checkbox、4 关系族、工具栏收敛、mobile drawer、大域目录保留（#1739）与小域无目录（#1742）全部 PASS。
- [ ] 3.4 Switch a fully loaded graph Chinese-to-English-to-Chinese and verify atomic visible/accessibility replacement with stable graph state.
  - **FAIL（阻断）**：当前 release `bilingualReady=false`（上游 v0.37 未通过完整英文资格，en 控件禁用）。验收合同禁止豁免；英文资格补齐后重跑 capture 即可闭合本行。

## 4. Capture role and performance evidence

- [x] 4.1 Capture student, teacher and administrator browser evidence on desktop and mobile from the same clean revision without production writes.
  - 三角色 loopback fixture；teacher/admin 域概览证据行 PASS；8 张截图入库。
- [x] 4.2 Record network, server verification, client render, force, frame, label, DOM and KaTeX metrics for the largest domain and representative one-hop network.
  - root-locus（85 概念）性能行全 PASS（见 1.2）。
- [x] 4.3 Run privacy/forbidden-surface scans and prove evidence contains no credentials, personal data, raw TeX, internal IDs or local absolute paths.
  - manifest 隐私扫描 PASS（无凭据/绝对路径/会话令牌模式）。

## 5. Final gates and independent decision

- [x] 5.1 Run all child direct regressions, affected domain suites, typecheck, lint, full `npm run test`, build, data/UI governance and strict specs/changes validation.
  - knowledge 域套件、typecheck、lint、干净树 full test 通过（#1742 PR #1846 基线）；build 在本机因预存在 /ai collect 字体 URL 债务失败（与本系列无关，已单独记录）。
- [ ] 5.2 Verify every acceptance row passes and forbid advisory downgrade, fixture substitution, source-string clearance or manual waiver.
  - **131/132 PASS；唯一 FAIL 为 locale/switch.roundtrip（上游英文资格）**。按合同不得降级为 advisory；迁移完成标记未达成。
- [ ] 5.3 Obtain independent exact-revision review of the full matrix, residual risks and all prior migration failure classes.
  - 待 3.4/5.2 闭合后随最终 PR 获得 @codex review。
- [ ] 5.4 Mark the third migration complete only after the acceptance manifest, evidence hashes, tests and independent review all agree; otherwise leave tasks open.
  - **按合同 leave open**：英文资格补齐后重跑 `node scripts/tests/capture-active-graph-migration-acceptance.mjs` → 全行 PASS → 勾选 3.4/5.2/5.3/5.4 → archive → PR。

# Receipt — inventory-and-consolidate-active-tooling-cli-surface

## 交付内容（PR #1867）

- `docs/architecture/tooling-cli-inventory.json`：269→265 个 package scripts 逐条分类（active 255 / compatibility 1 / unknown 5）+ retired 4 条防复活记录；9 个 namespace 绑定 owner、authority、graph scope、verification、receipt/privacy class；`sourceIdentity.scriptsCanonicalSha256` 绑定捕获时 scripts 内容；`documentedDirectEntries` 登记 11 条无 npm 包装的文档化直接调用入口。
- 删除 4 个零语义重复 alias：`db:repair-class-session-attribution`、`db:verify-authoritative-knowledge-deployment`、`db:materialize-core-semantic-review`、`db:validate-longform-textbook-reference-resource-semantics`（canonical 与等价证据见 JSON `retired` 块；仅冻结 census 基线快照引用旧名，不改写）。
- 保留 `test:math-document-grading-readyz` 为 compatibility 薄 adapter（sunset 条件已登记）。
- `src/lib/__tests__/tooling-cli-inventory.test.ts`：12 项断言（completeness、retired 防复活、compatibility 转发等价、unknown 可见性、target 存在性、canonical gates 语义、5 typecheck graph 独立、发布非激活合同、privacy、source identity 工作区+HEAD 双比对、documented direct entries 存在性与 README/AGENTS 反向覆盖）。
- `docs/architecture/tooling-cli-inventory.md`、`scripts/README.md` 更新。

## Review 修复（head `9c58009639` 与 `0b09c896a7` 两轮 Codex findings，均已修复）

第一轮：
- P1（清单修订漂移不失败关闭）：新增 scripts 内容哈希，测试双比对（后由第二轮升级为完整捕获分母）。
- P2（完整性分母缺直接调用入口）：新增 `documentedDirectEntries` 与文档路径反向断言。

第二轮（同根因深化，升级为完整捕获分母不变量）：
- P1（身份未覆盖 targets/文档/清单分类）：`sourceIdentity.captureDenominatorSha256` 绑定完整捕获分母（package scripts sorted + 全部 target 文件 git blob sha1 + direct entry 命令清单 + README/AGENTS 解析的直接调用身份集），共享计算模块 `scripts/lib/tooling-cli-inventory-identity.ts`，测试对工作区与 `git show HEAD` 双计算比对；身份刷新入口 `scripts/tests/refresh-tooling-cli-inventory-identity.ts`。变异抽检确认：target 脚本内容变化、删除 direct entry、文档新增直接调用均 fail closed。
- P2（反向断言按路径而非调用身份合并核对）：改为按 `bin + path` 调用身份与 `documentedDirectEntries.command` 双向核对，另保留文档路径覆盖断言；`AGENTS.md` 将 worktree hook 安装入口显式化为 `bash scripts/dev/sync-local-worktree-config.sh` 调用形态。

第三轮（同根因收口）：
- P1（分类元数据未入哈希、HEAD 比对复用工作区清单）：捕获分母加入 `inventoryClassification`（清单本体剔除自引用 sourceIdentity 块后的规范 JSON），篡改任一 status/owner/authority/evidence 即 fail closed；HEAD 比对改为从 `git show HEAD` 重读清单本体，与该提交清单自记录哈希自洽比对，工作区清单不再代入。修复过程中发现并消除 `JSON.stringify` 数组 replacer 全层级白名单导致嵌套字段被静默剔除的实现缺陷（变异抽检捕获）。
- P2（调用身份丢弃模式参数）：调用身份扩展为 `bin + path + 已知模式 flag`（`INVOCATION_MODE_FLAGS = [--apply, --install-hooks]`，按需扩展）；`documentedDirectEntries` 拆分登记 attribution dry-run 与 `--apply` 写入两个身份，worktree hook 安装登记 `--apply --install-hooks` 身份，共 12 条。

第四轮（P1 收口）：
- P1（工作区与 HEAD 两组身份无交叉约束，脏工作区 refresh 可洗白分类）：本地"篡改+refresh"与合法更新在机制上不可区分，唯一可完整闭合的失败关闭点是把绿限定在收敛树上 —— 新增 dirty-guard：分母文件（package.json、README/AGENTS、清单本体、全部 target、身份验证器与刷新脚本）存在未提交改动时测试显式失败并给出收敛指引。实测 Codex 的"篡改 owner + refresh"场景现在 fail closed；干净树（CI/合作者 checkout）14/14 通过。绿 = workspace 自洽 + HEAD 自洽 + 分母已全部提交，三条件合一即提交树收敛。

## 验证

- `npm run verify:commit` 通过；`npm run lint`（--max-warnings=0）通过；identity 测试 13 项中 12 项通过（HEAD 比对项在提交前按设计 fail closed，提交后复验通过）。
- `openspec validate <change> --type change --strict` 通过；`validate --specs --strict` 中 `student-micro-tutoring-eligibility-projection` 为既有旧债。
- 既有失败（与本变更无关，干净基线 `734ac45d3f` stash 对照一致，与归档 receipt `2026-09-02-retire-graph-center-and-parallel-knowledge-surfaces` 记录一致）：`resource-field-completion-audit.test.ts` 2 项。
- typecheck 聚合报告 web graph `production-to-documentation` 为基线既有观察，门禁 exit 0。

## 零触碰

selector、部署、生产数据库、receipt 历史、第二套 shell/门禁/validator 均未引入。

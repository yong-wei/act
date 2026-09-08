# 剩余全仓测试失败交接：归因尚未完成

日期：2026-09-08。用途：供新任务继续调查本轮图谱、路径整改后剩余的全仓测试失败。

## 必须先知道的结论

最终全量有 **73 个用例失败，分布在 43 个失败测试文件中**。部分文件在加载阶段失败，没有逐用例失败列表。73 不是独立缺陷或独立根因的数量。

**不能将这 73 项统称为“历史债务”，也不能断言全部与本次整改无关。**此前“没有新增失败”的比较基准，是本轮整改已经完成、尚未整合上游的中间结果，不是原始未修改基线。

已取得的证据：

- 原始基线隔离检出中，前一任务的只读验证代理报告：定向 182 项，163 通过、19 失败。这证明部分失败在原始基线存在。
- 这 19 项的逐项机器报告目前未在交接检查中找到；不要把数量推算成最终 73 项中已经逐一确认的对应清单。需要重新生成可审计对照结果。
- 整合前中间结果：12,068 项，11,947 通过、74 失败、47 pending。
- 最终源码提交：12,093 项，11,973 通过、73 失败、47 pending，1,027 个测试文件。
- 最终与上述中间结果相比，失败用例名称和失败文件集合都没有新增；工具清单的一项 dirty denominator 断言转为通过。
- 尚未对最终全部失败在原始基线做同环境对照。因此，剩余归因工作是真实未完成事项。

## Git 与工作区

| 对象 | 身份 |
| --- | --- |
| 主工作区 | `/Users/YW/Documents/Site/act.just.edu.cn` |
| 当前分支 | `codex/graph-path-redesign` |
| 原始整改基线 | `f455748e1d763bea110add70f64fe9d1a506d6f8` |
| 首个整改提交 | `2b2e5699b87ff381540ad3999d4e557fe849befa` |
| 整合的上游提交 | `232c0223e80c13b9e33cd455705237818d90c872` |
| 最终源码提交、全量实际执行对象 | `88e8ad0ffc36b51ed0495eed30dae2cbbf625e5b` |
| 已提交的验证文档 | `8fcce6a7113c128379d76e7c7151f16bc5602267` |
| 现存原始基线检出 | `/tmp/graph-path-redesign-base-git` |

交接撰写前，工作区仅有用户原有未跟踪文件 `debug-drag-tmp.ts`。本交接文档是随后新增的文档。不要删除、移动或提交该用户文件来满足测试的 clean-worktree 断言。

原始基线临时检出的 HEAD 已重新核实为 f455748e；其 `node_modules` 是符号链接，所以它不是依赖完全独立的环境。再次使用前核对 Git 身份、脏状态、依赖链接目标、配置与生成物，避免把环境差异误判为代码差异。

截至交接初稿（8fcce6a 后）尚未推送、创建 PR、请求 GitHub Codex Review、合并到 integration 或部署生产。不要据旧会话摘要推断当前远端状态；需要远端操作时再核验。

## 证据文件

以下路径相对主工作区；`.tmp` 为本地文件，切换机器或清理后可能不存在。

| 文件 | 用途 |
| --- | --- |
| `artifacts/graph-path-redesign/test-summary.json` | 已提交的最终统计、43 个失败文件及具体失败用例名称；无完整堆栈 |
| `.tmp/graph-path-redesign/final-committed-vitest.json` | 最终 88e8ad0 的原始 Vitest JSON，包含失败信息与套件加载错误 |
| `.tmp/graph-path-redesign/final-committed-vitest.log` | 同轮日志 |
| `.tmp/graph-path-redesign/final-after-remediation-vitest.json` | 整合上游前中间结果；不是原始基线 |
| `.tmp/graph-path-redesign/final-integrated-vitest.json` | 合并提交前结果；有 HEAD 指针字节对齐失败 |
| `.tmp/graph-path-redesign/compare-verification.py` | 旧比较辅助脚本，默认比较中间结果与合并提交前结果；不能直接当作原始基线对照 |
| `openspec/changes/archive/2026-09-08-redesign-graph-path-experience/validation.md` | 功能验证、审查裁决和已知限制 |
| `openspec/changes/archive/2026-09-08-redesign-graph-path-experience/design.md` | 本轮最终设计与有意替代的旧约束 |
| `artifacts/graph-path-redesign/browser-summary.json` | 图谱 12 状态及资源导航验收摘要 |

读取完整 JSON 时同时检查 `testResults[].message`、套件状态及 `assertionResults[].failureMessages`。只统计逐用例失败会漏掉测试文件加载失败。对外输出前去除认证信息、原始学生数据及不必要的完整堆栈。

## 已看到的失败类型与归因限制

| 类型 | 具体证据 | 当前判断 |
| --- | --- | --- |
| 缺少环境依赖 | generated-slide-layout-renderer 找不到 Playwright chromium_headless_shell-1223 | 当前失败直接由浏览器可执行文件缺失触发；仍需同环境基线对照 |
| 缺少验收工件 | relation-visual-semantics 读取 `artifacts/knowledge-graph-semantic-map-486/01-default-semantic-map.png` 时 ENOENT | 不应生成任意图片冒充历史证据；先确认工件应随仓库交付还是属于单独验收任务 |
| 工具清单不同步 | tooling-cli-inventory 报 `typecheck:konling-scripts` 未登记 | 需要核对脚本与清单各自引入提交，不凭文件未改就认定无关 |
| 接口/测试替身不匹配 | global-ai-sidebar-presentation 多项出现 `setStreamingOrComposing is not a function` | 可按共同接口根因调查；尚未确认是 mock 过期还是实际实现回归 |
| 数据契约不匹配 | teacher-review-contracts 的一项预期 DOCUMENT，实际 undefined | 可能是 fixture、解码器或生产契约问题，未完成归因 |
| 发布身份和历史断言 | Authority、Teaching Projection、冻结清单、字节等价及旧 selector 预期失败 | 前一代理已在原始基线复现其中一部分；具体项需补机器对照证据 |
| 其他业务失败 | 微辅导证据、批改持久化、学生证据缓存等 | 不应仅因本轮没有直接修改测试文件就归为既存问题 |

已解决的两个干扰因素：

1. 本轮首次全量有旧生成 WASM 的身份不匹配；执行 `rtk npm run wasm:build:control-engine` 后对应控制内核检查通过。对照时必须核对生成物来源。
2. 合并上游后但尚未提交时，authority-locale-readiness 的“工作区发布指针与 HEAD 字节一致”断言失败。发布指针与上游本来一致，提交 88e8ad0 后定向及最终全量均通过。这不是剩余 73 项之一，不要重复报告。

## 43 个失败文件

数字为原始报告中逐用例失败数量；“加载阶段”表示没有失败断言列表，需查套件 message。此表是调查目录，不是已确认的 43 个根因。

| 文件 | 失败用例 |
| --- | --- |
| `src/app/__tests__/konling-conversation-library-route.test.ts` | 加载阶段 |
| `src/app/__tests__/lesson-plan-session-routes.test.ts` | 1 |
| `src/lib/__tests__/active-authority-real-store-contract.test.ts` | 1 |
| `src/lib/__tests__/actkg-v022-composite-envelope.test.ts` | 1 |
| `src/lib/__tests__/ai-domain-orchestration-boundaries.test.ts` | 1 |
| `src/lib/__tests__/ai-task-boundary-ui-source.test.ts` | 1 |
| `src/lib/__tests__/arena-preview-control-engine.test.ts` | 1 |
| `src/lib/__tests__/authority-domain-learning-content.test.ts` | 2 |
| `src/lib/__tests__/authority-domain-shard-coverage.test.ts` | 1 |
| `src/lib/__tests__/canonical-learning-fact-identity.test.ts` | 1 |
| `src/lib/__tests__/commercial-ui-governance.test.ts` | 3 |
| `src/lib/__tests__/content-knowledge-runtime-release-toolchains.test.ts` | 1 |
| `src/lib/__tests__/enable-incremental-domain-teaching-projection.test.ts` | 6 |
| `src/lib/__tests__/formal-runtime-atomic-resource-binding.test.ts` | 1 |
| `src/lib/__tests__/governed-math-attach.test.ts` | 1 |
| `src/lib/__tests__/konling-conversation-library-ui.test.ts` | 1 |
| `src/lib/__tests__/konling-session-detail-route.test.ts` | 加载阶段 |
| `src/lib/__tests__/konling-study-question-structure-decoration-1950.test.ts` | 1 |
| `src/lib/__tests__/legacy-adaptive-entrypoint-retirement.test.ts` | 1 |
| `src/lib/__tests__/migration-backfill-competition-toolchains.test.ts` | 1 |
| `src/lib/__tests__/pid-evidence-runtime-attestation.test.ts` | 1 |
| `src/lib/__tests__/platform-appshell-contract.test.ts` | 1 |
| `src/lib/__tests__/platform-brand-kit.test.ts` | 1 |
| `src/lib/__tests__/publish-cross-domain-teaching-semantics.test.ts` | 加载阶段 |
| `src/lib/__tests__/publish-foundation-domain-teaching-semantics.test.ts` | 2 |
| `src/lib/__tests__/publish-modern-domain-teaching-semantics.test.ts` | 2 |
| `src/lib/__tests__/resource-field-completion-audit.test.ts` | 2 |
| `src/lib/__tests__/standalone-copilot-conversation.test.ts` | 1 |
| `src/lib/__tests__/tooling-cli-inventory.test.ts` | 3 |
| `src/features/admin/__tests__/ai-provider-settings.test.ts` | 1 |
| `src/features/ai/__tests__/global-ai-sidebar-presentation.client.test.tsx` | 10 |
| `src/features/assignment-authoring/__tests__/teacher-review-contracts.test.ts` | 6 |
| `src/features/assessment/__tests__/micro-intervention-learning-evidence.test.ts` | 2 |
| `src/features/knowledge/__tests__/knowledge-graph-edge-presentation.test.ts` | 1 |
| `src/features/knowledge/__tests__/relation-visual-semantics.test.ts` | 1 |
| `src/features/interactive/__tests__/generated-slide-layout-renderer.test.tsx` | 1 |
| `src/lib/generated-content-authority/__tests__/generated-content-authority.test.ts` | 3 |
| `src/lib/knowledge-surface/__tests__/latest-cutover-live.test.ts` | 1 |
| `src/lib/resource-governance-retirement/__tests__/resource-governance-retirement.test.ts` | 2 |
| `src/lib/data-governance/__tests__/math-document-grading-batch.test.ts` | 1 |
| `src/lib/data-governance/__tests__/math-document-grading-persistence.test.ts` | 2 |
| `src/lib/data-governance/__tests__/student-evidence-feature-cache.test.ts` | 2 |
| `src/lib/data-governance/__tests__/visual-evidence-description.test.ts` | 1 |

## 建议的新任务执行顺序

1. **保护当前工作。**核对分支、HEAD、dirty ownership；保留图谱/路径整改和用户文件。不要先切回 integration，也不要修改共享 node_modules 来制造某一侧通过。
2. **重现最终失败。**先使用最终提交的环境和报告中列出的 43 个文件定向运行，记录失败签名。环境错误先单列；若安装浏览器等修正环境，两侧都使用同样条件重新对照。
3. **建立真正的原始基线对照。**在 f455748e 的隔离检出执行同一批原有测试；记录缺失/改名测试、锁文件版本、Node、Next、Prisma、WASM 与浏览器状态。两侧版本不同则记录差异，必要时分别按各自锁文件安装，再用受控环境排除环境影响。
4. **按共同根因归类。**至少使用“原始基线同样失败”“本次引入”“上游整合引入”“环境/工件不足”“测试期望过期但需确认”“未能复现/待归因”六种状态。失败名称相同不等于根因相同，应比较错误信息与实际触发路径。
5. **追踪可疑增量。**原始基线 → 2b2e569 用于隔离本轮整改；2b2e569 → 88e8ad0 用于隔离上游整合及后续修复；必要时独立检查上游 d281a2eb9a 与 232c0223e8。测试没有修改也可能被共享依赖改动影响。
6. **形成归因表后修复。**每项保留基线/当前结果、共同根因、首次引入提交或证据不足说明、是否实际产品缺陷、修复位置与回归测试。不要通过删除断言、放宽身份检查或重写历史工件来获得绿色结果。
7. **验证与交付。**先共同根因定向回归，再相关领域；实现和独立审查整改稳定后跑一次全量。提交前满足项目门禁，报告全部剩余失败的处置，不把“本次无新增”混成“全仓通过”。

可以按权限/证据写入、学习状态及批改持久化、资源和发布身份、UI/清单/测试环境的顺序排查；这是调查优先级，不是已经确认的严重级别。

## 复测命令与成本

全量实际使用仓库 Vitest，发现范围来自 `vitest.config.ts`：`src/**/__tests__/**/*.{test,spec}.{ts,tsx}`；排除 API 目录、integration、real-db 和 real-smoke 测试。它不等于跑完所有真实数据库和浏览器 E2E。

```bash
rtk proxy env VITEST_MAX_WORKERS=2 node_modules/.bin/vitest run --reporter=json --outputFile=.tmp/failure-audit-current.json
```

此前调用设置了 `VITEST_MAX_WORKERS=2`，但当前 vitest.config.ts 没有显式读取这个变量；不要未经核实宣称它可靠限制并行数。新任务需要明确限制时使用 Vitest 的 `--maxWorkers=2` 参数，并在两侧保持一致。

从已提交清单生成命令参数，可避免手工漏掉加载失败文件：

```bash
rtk proxy python3 - <<'PYCODE'
import json
import subprocess
from pathlib import Path
report = json.loads(Path('artifacts/graph-path-redesign/test-summary.json').read_text())
files = [row['file'] for row in report['failures']]
subprocess.run([
    'node_modules/.bin/vitest', 'run', '--maxWorkers=2', *files,
    '--reporter=json', '--outputFile=.tmp/failure-audit-current.json',
], check=False)
PYCODE
```

基线检出没有本轮新增的 test-summary.json 时，从主工作区读取同一清单，再以基线为 cwd 执行；先逐项确认文件存在，不要静默跳过。原始失败报告用于排查，原封不动保留；另写精简归因表。

最近一轮已提交版本全量耗时 **321.7 秒，约 5 分 22 秒**，不含类型检查、浏览器验收和提交 hook。最慢的控灵 runtime 测试文件约 101 秒。定向测试通常明显更快，具体取决于所选失败文件。

`npm test` / `npm run test:unit` 包装命令此前被 dirty-worktree 门禁提前拒绝；本轮透明记录后直接运行测试主体。新任务应区分包装门禁拒绝与实际测试失败，不要删除用户文件规避门禁。

## 原整改的审查范围与保留事项

- 本地独立审查覆盖原整改及后续指定增量。最终增量范围为 2b2e569..88e8ad0；精确 resourceId 目标被同知识资源替代的 P1 已修复并复核，真实索引验证通过。
- 早前接受的资源索引 capture 返回边界、可信结果来源锚点问题已经整改。不要仅凭历史 finding 重复修补。
- 图谱 12 状态通过，包括 2D/3D、窄屏、标签与筛选栏不重叠；这不证明上述全部失败都与图谱无关。
- 用户明确授权统一资源索引、动态特征及直接消费 79 条真实 Engineering 先修。上游 #2059 仅采用其中 1 条为教学 REQUIRED；本轮有意不以教学 core 范围过滤其余 78 条，不应把这个已接受的设计差异自动判为回归。
- 已有独立审查结论：**本轮增量审查未发现新的 P0/P1 重大问题**。剩余 73 项的完整归因尚未完成，不能据此声称全部为既存失败或全仓可以直接发布。

## 可直接交给新任务的请求

请先阅读本交接文档和 artifacts/graph-path-redesign/test-summary.json，对最终剩余的 73 项失败、43 个失败文件做同环境原始基线对照与根因归类。不要预先把它们认定为历史问题，也不要回退已完成的图谱/路径整改。先给出可复现的归因结果，再修复已证实的问题；保留用户 debug-drag-tmp.ts，不推送或部署。若要使用子代理，请在新任务中明确授权并按项目命名角色分配非重叠工作包。

## 交付更新

用户随后授权提交、推送和合并。本交接文档随 `redesign-graph-path-experience` 归档到当前目录，正式规范同步到 `openspec/specs/graph-path-experience/spec.md`。交付准备整合了上游 `99307d7096` 的实验脚本与报告，没有修改 src 业务源码；最终源码的全量测试证据仍绑定 88e8ad0。PR、远端分支及合并状态应由新任务查询 GitHub 实时确认，不能沿用初稿的未推送描述。

# 控制奥德赛执行完整性验证

实施基线为 `c86731f54e9abf7f2b6ca4f00fa5256a92e97cec`，以下证据覆盖本地未提交实现。未执行提交、推送、应用部署、Runtime 发布或激活；未修改数据库 schema。

## 已实现行为

- 输入记录采用版本 1 的固定步变化段，变化段最多 4096 个，总步数由服务器关卡距离、速度和 dt 独立限制。连续相同命令和配置压缩为一段。
- 保留手动命令、自动给定偏移、运行中模式与参数变化。变化段可记录实际使用的输出等级；服务器独立核验所有等级不超过数据库权限，控制器、模块及参数上限由账户数据决定。
- 新普通运行的关卡与 tier 权限遵循现有页面规则：首关，已有本关进度或个人成绩，或前关已有进度；tier 不超过已解锁 tier。Arena 指派保留临时访问例外，并不奖励普通游戏进度。
- 服务端重放必须在记录的最后一步首次合法通关；伪造成绩、缺失记录、非法配置、碰撞、未通关及多余终局步均不获得新奖励。游戏分数从重放指标按原公式计算。
- 恢复使用第一次持久化输入与权限快照；缺失验证记录的历史未完成运行不能被新载荷替换。历史完成成绩保持可读。
- 账户权限读取、初始化、购买、升级、AI 兑换和奖励采用同一账户事务锁。重放不持锁，奖励事务读取最新进度，只更新积分和相关进度，保留并发升级与其他关卡进度。
- 两端使用同一奥德赛关卡、终局和指标逻辑。先检查实际所在地形段的碰撞，再检查通关；终局返回 false，停止同帧剩余固定步。
- 遥测按实际固定步采样；界面每六步同步一次，终局强制同步。组件订阅所用字段，示波器由遥测和尺寸变化触发重绘，静止状态不扫描历史。
- Rust 纯延迟保持恰好 N 个历史输入；离散模型使用含模型类型、系数、系数顺序和 dt 的有界 32 项缓存。延迟由独立队列处理，不参与离散化键。
- 排行榜先在 PostgreSQL 按用户选最佳 GAME 记录，再排序取前五十名。个人最佳在数据库按关卡与 tier 聚合；兼容载荷 levelId 和旧 missionId，参数安全绑定，并列顺序固定。

## 自动验证

受影响 Vitest 完整组：7 文件、70 测试通过。命令：

```sh
rtk proxy env ODYSSEY_TEST_DATABASE_URL=postgresql://odyssey_test@127.0.0.1:56203/postgres npx vitest run src/app/__tests__/control-odyssey-database.test.ts src/app/__tests__/control-odyssey-action.test.ts src/app/__tests__/control-odyssey-submission-recovery.test.ts src/features/interactive/__tests__/control-odyssey-rust-runtime.test.ts src/features/interactive/__tests__/control-odyssey-execution.test.ts src/features/interactive/__tests__/control-odyssey-canvas.client.test.tsx src/features/arena/__tests__/control-odyssey-sync.client.test.tsx
```

最后一次服务端整理后再次验证 action 29 测试与数据库 7 测试，均通过。未改变的数值、画布与同步测试复用上述证据。

数值与行为回归包含：真实 Rust 手动通关重放、自动偏移与动态 Kp、模式与输出限幅变化、零/一/二采样的实际模型响应、十五关与 Smith 有限性、低帧率停止剩余子步、碰撞与终点重合、暂停/恢复/重置、终局遥测完整性、十 Hz 面板同步及静止/尺寸变化示波器重绘。

共享 facade 关联测试：3 文件、23 测试通过：

```sh
rtk proxy npx vitest run src/lib/__tests__/control-engine-facade.test.ts src/lib/__tests__/arena-preview-control-engine.test.ts src/features/interactive/__tests__/control-engine-rerender.client.test.tsx
```

Rust 全部测试：92 通过，doc-tests 0：

```sh
rtk proxy env PATH="/opt/homebrew/opt/rustup/bin:$PATH" cargo test --manifest-path rust/control-engine/Cargo.toml
```

WASM 正常构建通过：

```sh
rtk npm run wasm:build:control-engine
```

生成物为正常构建的 WASM 二进制与身份清单。构建环境没有 wasm-opt，使用脚本支持的无额外优化路径；未手工修改生成物。

生产类型图 web 与 worker 均通过：

```sh
rtk npm run typecheck
```

兼容性整改后的 web receipt 为 `9dddd5e1c75f51243880111ecf6dd171fdf2553db3c16cf4076f75289db4ac73`；worker receipt 为 `d9821351354a7e55e6fc0afcb648462ff3993123ebcb2deabd1186d443f6eb79`。

针对修改文件的 ESLint 和 `rtk git diff --check` 均通过。OpenSpec 严格验证通过：

```sh
rtk proxy npx --yes --package @fission-ai/openspec@1.13.0 openspec validate harden-control-odyssey-execution --type change --strict
```

## 隔离 PostgreSQL 证据

测试显式使用本机临时端口 56203、odyssey_test 用户和合成数据，拒绝默认 5432 或非本机连接。未访问业务数据库。每轮测试清理自己创建的合成账户、运行和旧 mission 记录；临时集群由父任务管理。

七个真实数据库回归分别验证：

1. 八次并发初始化只有一份账户。
2. 两次并发购买同一控制器仅扣款一次。
3. 两项不同解锁不能花费同一余额。
4. AI 兑换与升级竞争时不超支。
5. 两次并发升级保留两个等级，第二次使用最新价格。
6. 两关奖励与升级并发时保留升级和两关进度；篡改重试轨迹不替换首份输入，也不重复奖励。
7. 同一用户 250 次尝试与其他 60 名用户共同排名时仍返回 50 名不同用户；验证 GAME 过滤、旧 missionId、个人 tier 聚合及注入字符串安全绑定。

真实数据库测试仅替换登录身份、缓存刷新及学习事实后续物化；奖励、余额、等级、进度、租约和聚合查询均使用实际 Prisma/PostgreSQL。学习事实与 Arena 桥接另由 action 回归验证，不将其 mock 证据视为真实外部链路验收。

## 重放基准

同机固定夹具：level-1、bronze、P 五级、Kp=1.6，无附加模块；预热一次后测量十次。可复现命令：

```sh
rtk proxy env NODE_OPTIONS=--conditions=react-server npx tsx openspec/changes/harden-control-odyssey-execution/benchmark-odyssey.ts
```

| 版本 | median | max |
| --- | ---: | ---: |
| 原版已记录基线 | 494 ms | 632 ms |
| 仅加入 Rust 缓存的中间测量 | 508.29 ms | 584.12 ms |
| 最终实现 | 12.83 ms | 16.05 ms |

Rust 缓存后仍由每个步长重复读取、校验并哈希整个 WASM 文件主导开销。最终 facade 在每次有界同步重放开始时校验封存包一次，每步继续检查返回数值。未增加 worker 或通用 batch API。

最终夹具指标：调节时间 `2.7999999999999905` 秒，超调 0，平均相对误差 `6.677521765922331`%，稳态误差 `0.0000673808556519778`%，控制能量 `0.006207697544954706`，控制平滑性 `0.04965516243138106`。普通 step facade 与封存重放 executor 的逐步完整状态严格相等。带纯延迟的数值变化属于本次纠正，未修改阈值掩盖差异。

此结果为本机单进程夹具，不能推导生产并发容量。

## 独立审查 finding 与唯一一轮整改

ACCEPT：统一要求输入轨迹误伤旧 Arena 提交恢复。部署前已经持久化完整 v1 配置快照的 AUTO 运行，在尚未创建 Arena 提交时，原实现能够从持久化快照进行服务端官方重放；本次新增轨迹门槛阻断了这一兼容路径。

整改仅恢复该旧官方副作用：

- 例外只从既有 GAME 日志读取完整 v1 快照，核验原 runId、已定义关卡、合法 tier、基础控制器、有限配置、权限快照、AUTO 模式及持久化关卡/task 配对。新请求不能创建或替换这样的旧快照。
- 旧 AUTO 官方恢复继续调用 `computeOfficialOdysseyTelemetry`，参数与发布范围全部来自原快照；不修改其原游戏分数或普通指标。
- 该路径不补发普通积分、不推进普通进度，也不生成普通完成证据；完成后再次重试同样跳过普通证据修复。旧奖励标记保持原值。
- 新运行仍必须提供轨迹，普通旧缺轨迹、旧 MANUAL 官方运行、错误 task 配对及不完整旧快照继续拒绝。已有有效轨迹的恢复流程保持原行为。

新增五个 action 回归覆盖：旧奖励未发/已发两种 AUTO 恢复、篡改重试输入与发布范围、完成后的证据防护、普通旧缺轨迹拒绝、旧 MANUAL 官方拒绝及错误 task 配对拒绝。

整改验证：

```sh
rtk proxy npx vitest run src/app/__tests__/control-odyssey-action.test.ts src/app/__tests__/control-odyssey-submission-recovery.test.ts
rtk proxy env ODYSSEY_TEST_DATABASE_URL=postgresql://odyssey_test@127.0.0.1:56203/postgres npx vitest run src/app/__tests__/control-odyssey-database.test.ts
rtk npm run typecheck
rtk proxy npx eslint src/app/actions/control-odyssey.ts src/app/__tests__/control-odyssey-action.test.ts --no-warn-ignored
rtk proxy npx --yes --package @fission-ai/openspec@1.13.0 openspec validate harden-control-odyssey-execution --type change --strict
rtk git diff --check
```

结果：action 与 submission recovery 两文件共 41 测试通过；隔离数据库七测试通过；web/worker 类型图、针对性 lint、严格规范验证与 diff 检查通过。数值、UI 和 Rust 未重新扫描或重跑，其代码在本轮未修改。旧 Arena 恢复的身份、重试及副作用防护由 action mock 验证，未将其作为真实 Arena 外部落库验收。

原 finding 的实施整改已完成。同一审查代理随后只复核旧 AUTO Arena 恢复分支、直接测试和规范说明，以及整改直接引入的 P0/P1 风险；确认旧恢复阻断已解决，未发现新的 P0/P1 重大问题。未重复全面审查未改动的数值、UI 或其他后端。

## 真实浏览器验收

环境为本工作树的 `http://127.0.0.1:3200`、Chromium 和隔离 PostgreSQL 合成账户。Browser plugin not available，因此按前端验收技能使用项目现有 Playwright。测试服务在本次 WASM 重建后重新启动；未复用其他工作树或生产服务。

项目烟测通过：

```sh
rtk proxy env PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3200 npx playwright test tests/control-odyssey.spec.ts --workers=1 --reporter=line
rtk proxy npx eslint tests/control-odyssey.spec.ts
```

烟测修正了一个既有定位问题：为“配置并开始”加 exact 匹配，避免点击包含同名文本的外层关卡卡片。匿名烟测仅将无关的全局 AI 会话列表替换为空列表，避免预期 401 干扰控制台健康断言；游戏、WASM 和成绩接口没有被该烟测替换。

另外通过临时 Playwright 脚本进行了真实登录和数据库读回验证：

| 场景 | 观察结果 |
| --- | --- |
| 桌面进入、商店、AUTO 调参并启动 | 页面身份和内容正确，无框架错误覆盖层，控制有效 |
| 篡改提交分数为 9999、清零指标 | 服务端保存 9799 分、平均相对误差约 6.6775%、调节时间约 2.8 秒，符合真实重放和原评分公式 |
| 服务端处理后中断首次响应，再自动重试 | 两次提交请求只新增一份运行，新增 97 积分，控制器等级保持不变 |
| 同账户 4800 积分并发发起两次 P 五级升级 | 一个请求成功、一个因余额不足拒绝，只扣 3200 分，P 升至六级，其他控制器保持不变 |
| 手动输入与重置 | 向下键输入有效，重置后进度归零，图形更新正确 |
| 静止示波器 | 350ms 内绘制计数保持 140，不持续逐帧扫描 |
| 1440px 缩至 800px | 示波器实际宽度由 1440 变为 800，绘制计数由 140 变为 141 |
| 390×844 移动端结果 | 分数和同步状态可见，结果可滚动，“下一关挑战”和“返回配置”可达，返回配置正常 |

普通手动、重置、缩放和移动端流程没有页面或控制台错误。故障注入流程出现一次预期的 `net::ERR_FAILED`；并发余额不足请求返回预期的业务失败，不将这些人为制造的结果归为运行异常。

空白隔离库起初缺少累计画像队列的初始化 fence，导致已保存成绩后的学习证据同步失败。为继续验收，仅在临时库创建了合成 migration/fence 数据和 pgcrypto 扩展，未修改产品代码或业务库。之后成绩和学习证据重算请求持久化流程通过；未运行后台画像物化 worker，不能据此声称画像计算完成。

暂停/恢复、逐步动态参数与终局边界继续由本次已通过的组件和真实 Rust 回归覆盖；未将它们描述为全部经过浏览器操作。截图和临时脚本保存在任务的本机验收目录，不进入仓库。

## 最终结论

任务 12/12 完成。实现代理使用 `gpt-6.1-sol`，只读核验与独立审查使用 `gpt-6-luna`，未修改项目代理配置。

本地审查范围为 `c86731f54e9abf7f2b6ca4f00fa5256a92e97cec` 到本任务的未提交变更，不含原有五份课程设计与媒体修改。原兼容性 finding 已解决；本轮增量审查未发现新的 P0/P1 重大问题。

未运行生产压力测试、后台画像物化 worker 或真实 Arena 外部发布链路；旧格式 Arena 恢复由 action 回归及独立复核覆盖。未提交、推送、部署或归档本变更。测试只使用临时本地数据库与合成数据。

验收后已关闭本任务的 3200 端口服务和 56203 临时 PostgreSQL，删除本任务创建的数据库目录与合成认证配置，保留验证报告和截图。其他服务及业务数据库未改动。

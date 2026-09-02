## Context

`diagnosis-accuracy-regression-gates` 已确立评测基建形态：版本化场景、fixture/live 双入口、`artifacts/<domain>/<runId>/` 只增不改布局、阈值门禁。知识问答盲审的评价对象是模型回答的引用与讲解质量，批次长（数百条）、依赖外部模型服务，外部失败是正常运行条件而非异常。

## Goals / Non-Goals

**Goals:**

- 任意比例中断后可继续执行，已完成项不重复计费、不重复记录。
- 每条审计的模型、提供方、提示版本、评分版本、时间、代码修订与错误原因可追溯。
- 不完整批次明确 `incomplete`，正式汇总默认 fail closed。
- 规则评分与独立盲审产物分离。

**Non-Goals:**

- 不做分布式调度、并发 worker 池或服务化；单进程顺序执行即满足当前批次规模。
- 不引入数据库；文件系统即持久层。

## Decisions

### 唯一任务键 = 产物路径

任务键由 `清单版本 + 评测模式（rule-score | blind-audit）+ 条目 ID + replicate` 派生，落盘为 `records/<mode>/<taskKey>.json`。幂等性由「文件存在即完成」天然保证：重复运行前先列目录，已存在的键直接跳过，不需要外部状态。已冻结记录永不覆盖；重试失败项写入 `failures/<taskKey>.json` 并在下次运行时仅对 failure 记录重新发起。

### 原子落盘

单条记录先写 `*.tmp` 同目录临时文件再 `rename`，POSIX 语义下崩溃不会留下半写记录；启动时清理孤儿 `.tmp`。

### 完整性门禁在汇总阶段 fail closed

`aggregate` 读取 `manifest.json` 声明的预期条目数与 `records/`、`failures/` 实际数量对比：`completed < expected` 时输出 `status: "incomplete"`，正式指标字段（专家/模型对照表）不生成，只输出进度诊断。`incomplete` 汇总可以被显式 `--allow-incomplete` 查看但产物继续标记，不产生正式指标文件。

### 元数据内嵌每条记录

每条 record 自带 `model`、`provider`、`promptVersion`、`scoreVersion`、`startedAt/finishedAt`、`gitRevision`、`error {code, message}`。汇总校验所有 record 的模型/版本一致性，混版本批次拒绝汇总——防止续跑时静默拼接不同配置的结果。

### fixture 模式默认，live 显式 opt-in

与 diagnosis-benchmark 一致：`run-fixture`（确定性 fake provider，含故障注入剧本）用于测试与 CI 安全验证；`run-live` 需显式环境变量并按配置调用真实 provider。

### 互斥不变量与系统边界（#1820 评审收敛）

锁层采用 lease 语义：发布 = `mkdir pub-<n+1>`（内核级原子单胜，是持有锁的唯一途径）；正常释放只在自有槽写 `released` 标记，锁结构与槽序列永不删除或重置；运行期在每个外部调用前断言"最新槽仍归属本进程"。由此给出可验证的不变量：

- 任意时刻至多一个**活跃**持有者；被超越者（更高槽已发布）在下一次外部调用前必然退出。
- 崩溃恢复重放至多一条在途任务（provider 调用不可撤销，这是物理边界而非实现缺口；"跳过已完成"保证不再重复）。
- 记录层独立仲裁：单条落盘经临时文件 + `link(2)` 发布，目标已存在即放弃——并发写同一任务键时先写者胜、后写者不覆盖，与锁状态无关。

判定链（最新槽 holder 存活拒绝、空 holder 宽限内拒绝、released 允许接替）只是进入竞争的许可条件，不承载正确性。

## Risks / Trade-offs

- [并发运行同 runId] → 存储层以 `O_EXCL` 创建 run 锁文件，第二个进程拒绝启动而不是竞写。
- [清单漂移] → manifest 记录清单内容哈希；续跑时清单哈希不一致直接失败。
- [失败项被无限重试] → 每次运行对失败项最多重试一轮，错误计数写入 failure 记录，累计错误保留供人工裁决。

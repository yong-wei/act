## Context

Canonical assignment publication currently allows an editor to await a pending save as part of publication. The agreed product contract instead defines a publication baseline that already exists before the publish command: it is saved, matches the teacher's current content, and has no conflict. This change also closes duplicate revision paths caused by double-clicks, retries, concurrent requests, and historical repeated publication.

## Goals / Non-Goals

**Goals:**

- Bind every editor task to one stable assignment identity and one mutable pre-publication draft.
- Make publication a command over an explicit saved baseline, never an implicit save operation.
- Deduplicate equivalent publication requests and return one immutable published revision.
- Return to and locate the published assignment in the teacher list.
- Repair historical duplicates without destroying submissions or review lineage.

**Non-Goals:**

- 不修改教师编辑布局、rubric 算法或学生作答合同。
- 不把自动保存版本历史化；发布前仍只有一份可变草稿。
- 不删除任何已有学生提交、批阅或历史访问所依赖的发布版本。

## Decisions

### 1. 发布请求携带稳定身份与保存基线

发布命令携带 assignment id、draft id、保存修订/版本和内容摘要。服务端在事务内确认该基线仍是草稿当前已保存内容且无冲突，再冻结发布修订。请求正文不携带可被发布命令顺便保存的新内容。

备选方案是在发布接口内部先保存。该方案重新引入保存失败、版本冲突与发布副作用交织，因此不采用。

### 2. 幂等键由作业身份与发布基线派生

相同 assignment id 和保存基线产生同一发布操作身份。双击、重试和并发请求读取或等待首次成功结果；新保存基线才有资格产生新的发布修订。

### 3. 发布完成结果包含列表定位信息

成功响应返回稳定 assignment id、published revision id 和列表定位所需的安全标识。客户端立即导航到教师作业列表，由列表查询权威数据并突出刚发布记录，不在编辑页提供再次发布入口。

### 4. 历史修复保留有提交版本

修复脚本按稳定作业归属聚类重复发布版本。没有任何提交或批阅依赖的重复版本可删除；有依赖的版本转为历史、只读、不可再投放，并选出唯一当前发布版本。脚本支持 dry-run、计数和幂等重跑。

## Risks / Trade-offs

- [旧客户端仍提交发布时保存内容] → API schema 拒绝内容字段，并提供明确的基线过期错误。
- [并发发布锁竞争] → 使用数据库唯一约束和事务内幂等记录，而不是仅依赖客户端禁用按钮。
- [历史版本误删] → 删除前检查提交、批阅、受众和引用；任何不确定引用均保留为历史。
- [列表暂时查不到刚发布记录] → 导航携带稳定定位标识，列表查询失败时显示可重试状态而不是回到编辑页重发。

## Migration Plan

1. 增加发布操作幂等约束和稳定身份校验，保持旧数据只读兼容。
2. 更新发布 API 与客户端，使发布只接受已保存基线。
3. 运行历史重复数据 dry-run，人工核对聚类和引用计数后执行修复。
4. 验证每个作业只有一个当前发布版本进入学生投放查询。
5. 回滚应用代码时保留新约束和修复结果；不可恢复已删除的无引用重复版本，因此执行前需备份修复清单。

## Open Questions

- 历史重复聚类若无法从现有 lineage 证明属于同一作业，应保持未修复并进入人工清单，不自动猜测。


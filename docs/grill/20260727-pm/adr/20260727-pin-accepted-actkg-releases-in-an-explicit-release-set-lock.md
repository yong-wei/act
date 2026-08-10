---
status: accepted
context: authoritative-knowledge-graph-migration
---

# 使用显式 ReleaseSet 锁定清单接收 ActKG 发布包

ACT 仓库维护可审查的 ReleaseSet 锁定清单，只记录候选知识基座接受的 ActKG Release 标识、版本、受控路径和哈希。新增或升级 Release 必须先修改锁定清单并通过发布状态、Schema、哈希、端点闭合和无损导入校验，随后以事务方式更新候选数据库。

ACT 不扫描目录自动接收所有标记为 RELEASED 的包，也不在运行时获取 ActKG 最新版本。相同 Git 修订、锁定清单、导入合同和投影版本必须生成相同候选数据库内容及投影摘要。

这一机制增加一次显式接入提交，但使候选图谱、部署版本和审计证据能够稳定对应。

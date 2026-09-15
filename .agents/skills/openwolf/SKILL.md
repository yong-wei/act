---
name: openwolf
description: 恢复任务上下文、查询项目历史或维护 OpenWolf 交接记录时使用。
---

# OpenWolf

项目协议以 [.wolf/OPENWOLF.md](../../../.wolf/OPENWOLF.md) 为准，按当前任务需要读取。

- 续接已有工作：读取 `.wolf/STATUS.md` 的相关任务，核验其中会变化的 Git、部署和任务状态。
- 查询历史原因：定向检索 `.wolf/cerebrum.md` 或 `.wolf/buglog.json`，用当前规范、代码与日志验证适用性。
- 定位未知模块：可用索引辅助导航；已知文件直接读取，无需先遍历 anatomy。
- 显式交接或完成跨会话任务：在现有任务记录中写清结果、证据、未完成事项和下一步，不创建第二套状态真源。

技能、命令和 hooks 的可用性以当前环境为准。上游模板提到的 `openwolf find`、`map`、`designqc` 或 `/handoff` 不一定存在；先查帮助或可用工具，缺失时使用文件搜索、现有浏览器或手工交接。不要为完成普通任务隐式升级全局工具。

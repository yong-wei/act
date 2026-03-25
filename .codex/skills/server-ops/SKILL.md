---
name: server-ops
description: Use when this repository needs server-side operations, online fault investigation, remote deployment checks, runtime environment verification, or local/remote database sync for the Podman-based production stack.
---

# Server Ops

## Overview

这个 skill 用于处理本仓库的服务器相关操作，覆盖远端调查、部署验收、数据库同步和测试账号核对。

主入口只保留总览。遇到具体工作流时，优先打开对应参考文件，不要把所有操作混在同一条线里执行。

## When to Use

- 需要 SSH 到 `121.40.124.135` 调查线上问题
- 需要核对 Podman 容器、systemd、Nginx、环境变量
- 需要重新部署并验证 `app + postgres + redis + worker + scheduler`
- 需要把远端数据库导出并同步到本地分析
- 需要核对或修复线上测试账号

## References

- 远端调查与故障排查: `references/remote-investigation.md`
- 部署与验收: `references/deploy-and-verify.md`
- 数据库导出/下载/本地恢复: `references/database-sync.md`
- 测试账号核对与修复: `references/test-accounts.md`

## Operating Rules

- 先确认当前环境：本地开发、远端生产，还是两边联动
- 先做只读检查，再执行变更
- 涉及数据库覆盖导入时，先做本地备份
- 涉及远端服务重启时，保留前后状态与关键日志
- 验收至少覆盖容器状态、核心接口、关键环境变量和日志摘要

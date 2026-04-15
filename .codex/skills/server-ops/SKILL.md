---
name: server-ops
description: Use when this repository needs server-side operations, online fault investigation, remote deployment checks, runtime environment verification, or local/remote database sync for the Podman-based production stack.
---

# Server Ops

## Overview

这个 skill 用于处理本仓库的服务器相关操作，覆盖远端调查、部署验收、数据库同步和测试账号核对。

主入口只保留总览。遇到具体工作流时，优先打开对应参考文件，不要把所有操作混在同一条线里执行。

## Hard Constraints

- 部署模式固定为“本机构建镜像或镜像包，再在远端执行装载与启停”；不得改为远端源码构建、远端常驻代码目录构建或任何临时改变部署模式的做法。
- 远端 `/home/projects/act` 只允许保留运维脚本、环境变量文件与 `course-content/runtime`；不得上传业务源码、测试、文档、记忆文件或其他代码目录。
- 禁止在远端执行 `podman build`、`docker build`、`npm run build`、`next build` 或任何等价的源码构建命令。
- 若发现远端已有源码残留，应优先清理为最小运维壳层，再继续后续排障或部署。
- 若需要更新部署逻辑，只能修改本地仓库中的运维脚本与文档，并通过既定的本机构建流程产出镜像，再按既定方式部署。

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
- 涉及部署时，先确认本次操作是否符合“本机构建、远端仅装载镜像”的固定模式；若不符合，立即停止
- 远端目录若需要整理，只保留 `scripts/`、`deploy/podman/`、`.env*`、`data/runtime/act-obe.env` 与 `course-content/runtime/`
- 涉及数据库覆盖导入时，先做本地备份
- 涉及远端服务重启时，保留前后状态与关键日志
- 验收至少覆盖容器状态、核心接口、关键环境变量和日志摘要

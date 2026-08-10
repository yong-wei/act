---
name: server-ops
description: Use only when the user explicitly requests deploying or publishing this project to a server, or when the task necessarily requires inspecting or changing a remote server, its production runtime, or its remote database.
---

# Server Ops

## Overview

这个 skill 只用于本仓库明确涉及远端服务器的操作，覆盖服务器发布与部署、远端调查、生产运行态验收、远端数据库同步和线上测试账号核对。

主入口只保留总览。遇到具体工作流时，优先打开对应参考文件，不要把所有操作混在同一条线里执行。

## Trigger Gate

只有满足以下至少一项时才允许启用本 skill：

- 用户明确要求把本项目发布或部署到服务器、生产环境或线上环境。
- 当前任务必须通过 SSH 或等价远端接口读取、诊断或修改服务器状态，例如容器、systemd、Nginx、远端日志、远端环境变量、远端数据库或线上账号。

以下任务一概不得触发本 skill：

- 本地代码、数据、迁移、构建或测试工作，且用户没有要求部署到服务器。
- Git、GitHub、ActKG 或其他仓库中的 Release、tag、Bundle、图谱发布核对。
- 仅基于本地仓库、发布工件、Issue、OpenSpec 或数据库快照分析图谱 authority、cutover readiness、CourseCoverage 或迁移条件。
- 任何不需要读取或改变远端服务器状态的“发布”“切换”“上线准备”讨论。

语义存在歧义时默认不启用；不得因为任务出现“发布”“生产”“图谱切换”或“运行时”等词就推断为服务器操作。

## Hard Constraints

- 部署模式固定为“本机构建镜像或镜像包，再在远端执行装载与启停”；不得改为远端源码构建、远端常驻代码目录构建或任何临时改变部署模式的做法。
- 本地镜像打包必须使用本机 Docker 守护进程执行 `scripts/build.sh` 中的 `docker buildx build`；若 Docker 未运行，应先启动 Docker 并验证 `docker info`，不得擅自切换到 Colima、Podman、Lima 或其他构建运行时，也不得用旧镜像包替代本次构建。
- 发布构建固定使用 Docker Desktop 24 GiB 内存、8 GiB Swap 和 `NODE_MAX_OLD_SPACE_SIZE=12288`；`docker info --format '{{.MemTotal}}'` 低于 20 GiB 时必须停止，不能在不足内存的 VM 中反复降低或试探 Node heap。
- 当前构建必须自然结束后才能重启或退出 Docker Desktop；远端部署及最终验收完成、确认没有其他获授权的本地构建后，必须退出 Docker Desktop 释放 VM 内存，不能只停止 builder 容器。
- 远端 `/home/projects/act` 只允许保留运维脚本、环境变量文件与 `course-content/runtime`；不得上传业务源码、测试、文档、记忆文件或其他代码目录。
- 禁止在远端执行 `podman build`、`docker build`、`npm run build`、`next build` 或任何等价的源码构建命令。
- 若发现远端已有源码残留，应优先清理为最小运维壳层，再继续后续排障或部署。
- 若需要更新部署逻辑，只能修改本地仓库中的运维脚本与文档，并通过既定的本机构建流程产出镜像，再按既定方式部署。

## When to Use

- 用户明确要求将本项目发布或部署到服务器
- 需要 SSH 到 `121.40.124.135` 调查线上问题
- 需要核对 Podman 容器、systemd、Nginx、环境变量
- 需要重新部署并验证 `app + postgres + redis + worker + scheduler`
- 需要把远端数据库导出并同步到本地分析
- 需要核对或修复线上测试账号

## References

- 远端调查与故障排查: `references/remote-investigation.md`
- 课堂同步错误与 `Failed to fetch` 根因分流: `references/classroom-sync-errors.md`
- 部署与验收: `references/deploy-and-verify.md`
- 数据库导出/下载/本地恢复: `references/database-sync.md`
- 测试账号核对与修复: `references/test-accounts.md`

## Operating Rules

- 先确认当前环境：本地开发、远端生产，还是两边联动
- 先做只读检查，再执行变更
- 若问题表现为课堂中 `同步错误`、`fail to fetch`、学生端不跟随教师进度、教师端无法推进步骤或 reveal/release 状态不同步，先读 `references/classroom-sync-errors.md`
- 涉及部署时，先确认本次操作是否符合“本机构建、远端仅装载镜像”的固定模式；若不符合，立即停止
- 远端目录若需要整理，只保留 `scripts/`、`deploy/podman/`、`.env*`、`data/runtime/act-obe.env` 与 `course-content/runtime/`
- 涉及数据库覆盖导入时，先做本地备份
- 涉及远端服务重启时，保留前后状态与关键日志
- 验收至少覆盖容器状态、核心接口、关键环境变量和日志摘要
- 当且仅当任务已经满足 Trigger Gate 且服务器部署包含图谱或权威数据变化时，必须先在本地验证迁移、导入与 revision/provenance 闭合；Candidate、Shadow 与 Legacy 可以并存，除非用户明确授权且 cutover gate 通过，不得把服务器部署等同于 authority cutover

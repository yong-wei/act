## Context

当前教材混合检索索引的真实位置是 `course-content/runtime/resources/textbook-hybrid-retrieval/bge-m3`，但 `textbook-v2-adapter` 的默认路径、runtime 静态资源路由、构建/发布/部署脚本及其测试仍使用 `course-content/runtime/resources/textbook-retrieval`。与此同时，现有 `bge-m3/windows.jsonl` 缺少 loader 与 schema 强制的 `segments` 字段，导致即使路径修正后索引也无法被加载器接受。

## Goals / Non-Goals

**Goals:**

- 将混合检索索引默认路径统一为 `course-content/runtime/resources/textbook-hybrid-retrieval/bge-m3`。
- 保持 `indexRoot` > `ACT_TEXTBOOK_RETRIEVAL_INDEX_ROOT` > 默认路径的解析优先级。
- 统一构建、发布、远程部署脚本、runtime 路由和测试中的路径。
- 重建 `bge-m3` 索引，使 `windows.jsonl` 包含 `segments` 并与当前 `textbooks-v2` 运行态一致。
- 将路径与索引窗口契约写入 OpenSpec spec。

**Non-Goals:**

- 不修改教材正文、不新增教材资源、不补充小学数学资源。
- 不修改结构化教材 `textbooks-v2` 的 `runtimeRoot`。
- 不处理 `input-provenance.json` 缺失（P0-ENV-02）与配置 sourceRevision 漂移（P1-ENV-01）等独立问题。
- 不引入新的配置文件；默认路径继续由运行时代码与脚本显式维护。

## Decisions

### 使用规范路径常量而非新增配置文件

在 TypeScript 适配器中保留 `DEFAULT_INDEX_ROOT`，但修正为 `course-content/runtime/resources/textbook-hybrid-retrieval/bge-m3`。Node 发布脚本、Shell 部署脚本和测试各自显式使用同一路径，并通过测试防止再次漂移。新增配置文件会扩大数据契约和迁移范围，本变更收益不足以支撑该改动。

### 更新 runtime 原始资源路由白名单

`src/app/course-runtime/[...assetPath]/route.ts` 的私有路径守卫改为阻止 `resources/textbook-hybrid-retrieval`，避免检索索引文件通过原始资源路由暴露。

### 重建索引而不是放宽 loader

现有 `windows.jsonl` 缺少 `segments`，但 loader、schema 和检索结果都需要 segments 来还原证据单元。正确做法是按当前 `textbooks-v2` 运行态重建索引，而不是放宽 loader 契约。现有 `.cache/textbook-hybrid-retrieval` 提供 BGE-M3 向量缓存，可离线重生成。

### 部署脚本使用嵌套索引目录

`scripts/release/export-textbook-runtime-v2.mjs` 与 `scripts/remote-deploy.sh` 将索引目录从 `resources/textbook-retrieval` 改为 `resources/textbook-hybrid-retrieval/bge-m3`。`replaceRuntimeDirectories` 已支持任意路径深度，无需修改事务替换逻辑。

## Risks / Trade-offs

- [旧部署仍残留 `textbook-retrieval`] → 远程部署校验和 release preflight 改为 canonical path；旧目录不在契约内，验证失败即 fail closed。
- [索引重建依赖本地缓存] → 构建前检查 cache hit；若出现 cache miss，需要外部 embedding 服务，未配置服务时不生成生产索引。
- [`validate-textbook-runtime-v2.mjs` 仍可能因缺少 `ajv` 或 `input-provenance.json` 失败] → 本变更不扩大范围，作为独立残余风险报告。

## Migration Plan

1. 修改适配器默认路径与路径优先级测试。
2. 修改 runtime 路由、构建/发布/部署脚本及其测试。
3. 使用现有缓存重建 `course-content/runtime/resources/textbook-hybrid-retrieval/bge-m3`。
4. 运行 `verify-index`、定向 Vitest 与类型检查。
5. 后续通过 `export-textbook-runtime-v2.mjs` 或 `remote-deploy.sh` 部署，事务替换保留回滚能力。

## Open Questions

无。

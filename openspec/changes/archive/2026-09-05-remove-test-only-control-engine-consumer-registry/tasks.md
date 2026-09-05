## 1. 删除失效登记表

- [x] 1.1 删除 `src/lib/control-engine/server-consumers.ts`、`src/lib/__tests__/server-control-engine-consumers.test.ts` 及 index 的对应导出。
- [x] 1.2 修订 `docs/operations/control-engine-facade.md` 的过期登记表与 R6 描述，确认无生产代码引用被删符号。

## 2. 验证现有入口

- [x] 2.1 确认 generated package 与当前源码匹配（`wasm:build:control-engine` 重建后 identity 校验通过），façade、simulation-api-rust-runtime、practice-live-control-engine、control-odyssey-rust-runtime、arena-analysis-whitebox-evaluation 共 42 用例通过；未修改数值及身份校验。
- [x] 2.2 运行 typecheck（零错误）、architecture fitness（failureCount 1784→1782，净减 2 即被删文件自身违规；其余为基线既有债务）、本 change 的 OpenSpec strict 与 diff 检查；完成说明列出删除的生产/测试代码量。

## 完成说明（任务 2.3）

删除量：生产代码 77 行（`server-consumers.ts`）+ index 导出块 8 行 + 文档登记表描述 1 行；测试代码 68 行（`server-control-engine-consumers.test.ts`）。合计 -154/+1，无替代登记表或转发层。

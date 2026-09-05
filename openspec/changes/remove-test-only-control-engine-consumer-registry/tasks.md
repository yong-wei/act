## 1. 删除失效登记表

- [ ] 1.1 删除 `src/lib/control-engine/server-consumers.ts`、`src/lib/__tests__/server-control-engine-consumers.test.ts` 及 index 的对应导出。
- [ ] 1.2 修订 `docs/operations/control-engine-facade.md` 的过期登记表与 R6 描述，确认无生产代码引用被删符号。

## 2. 验证现有入口

- [ ] 2.1 确认 generated package 与当前源码匹配，运行 façade、simulation-api-rust-runtime、practice-live-control-engine、control-odyssey-rust-runtime、arena-analysis-whitebox-evaluation 相关测试；不修改数值及身份校验。
- [ ] 2.2 运行 typecheck、现有 architecture fitness、本 change 的 OpenSpec strict 与 diff 检查；完成说明列出删除的生产/测试代码量。

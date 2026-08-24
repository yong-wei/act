## 1. Runtime Path Contract

- [x] 1.1 将 `src/lib/source-pack/textbook-v2-adapter.ts` 默认索引路径改为 `textbook-hybrid-retrieval/bge-m3`
- [x] 1.2 在 `src/lib/__tests__/textbook-v2-adapter.test.ts` 增加显式参数、环境变量、默认路径优先级测试，并覆盖普通与渐进式检索
- [x] 1.3 确认 `src/lib/smart-lesson-plan/textbook-resource-pack.ts` 不覆盖 `indexRoot`，依赖修正后的默认优先级
- [x] 1.4 更新 `src/app/course-runtime/[...assetPath]/route.ts` 的索引私有路径守卫
- [x] 1.5 更新 `src/app/__tests__/course-runtime-route.test.ts` 到 canonical 路径

## 2. Build, Release and Deploy

- [x] 2.1 更新 `scripts/release/export-textbook-runtime-v2.mjs` 的 `indexRoot` 与 `stagedIndex`
- [x] 2.2 更新 `scripts/release/validate-textbook-runtime-v2.mjs` 的默认 `indexDir`
- [x] 2.3 更新 `scripts/build.sh` 的 `TEXTBOOK_RETRIEVAL_INDEX_DIR`
- [x] 2.4 更新 `scripts/remote-deploy.sh` 的本地/远端/容器/staging 索引路径
- [x] 2.5 更新 `scripts/tests/test-runtime-externalized-deploy.mjs` 与 `scripts/tests/test-remote-deploy-script.mjs`

## 3. Index Regeneration

- [x] 3.1 在最终 HEAD 上重建 `course-content/runtime/resources/textbook-hybrid-retrieval/bge-m3`
- [x] 3.2 在最终 HEAD 上运行 `textbook_hybrid_retrieval.py verify-index`

## 4. Verification

- [x] 4.1 运行定向 Vitest 测试
- [x] 4.2 运行 TypeScript 类型检查
- [x] 4.3 复核 `src/`、`scripts/build.sh`、`scripts/release/`、`scripts/remote-deploy.sh` 不存在未处理旧路径引用
- [x] 4.4 增加真实 canonical 索引 smoke test，验证普通与渐进式检索返回非空 `candidate.text`（在现有 `d3b22612` runtime 上可运行，不能替代最终 HEAD release preflight）
- [x] 4.5 在最终 HEAD 上实际跑通 `validate-textbook-runtime-v2.mjs` 与相关 deployment tests

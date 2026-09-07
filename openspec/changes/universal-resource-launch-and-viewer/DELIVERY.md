# 交付说明

本变更只交付应用代码、测试与发布前断言，不执行生产发布。

生产发布必须按以下顺序单独授权：

1. `npm run deploy:runtime` 在 resume 与新鲜发布两条路径上都会运行：
   `npx tsx scripts/knowledge/assert-teaching-projection-app-revision.ts`
   不要只手跑脚本后跳过正式发布入口。
2. 仅当当前 Teaching Projection manifest 的 `authoringRevision` 与部署目标
   `APP_REVISION` 完全一致、且捕获修订不带 `-dirty` 时继续。
3. 另行授权并执行内容发布。
4. 内容发布验收通过后，再另行授权应用部署。

断言失败时必须停止，不得修改 RegistryIndex 持有规则、猜测资源路由、重放
overlay A 或重新密封 activation 来绕过修订不一致。

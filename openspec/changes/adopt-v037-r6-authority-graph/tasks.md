## 1. 前置与代码改造

- [ ] 1.1 提交/stash 上游克隆 `/Users/YW/Documents/Project/ActKG` 的 `.wolf/*` 脏改动，确认 HEAD=origin/main 且含 r6 tag
- [ ] 1.2 U1：`buildAuthorityDomainShards` 的 relation-family 分片并入所交付关系的全部端点对象（bounded closure，去重、仅呈现必需字段），新增/更新 `authority-domain-shard-delivery` 相关单测覆盖「族分片端点零缺席」
- [ ] 1.3 U6：`teachingCoverage.relationCount` 等覆盖计数字段改从最终分片 payload 重算，新增账实一致单测
- [ ] 1.4 `families.ts` + `materialize.ts`：`prerequisite` 谓词加入族映射与 `SUPPORTED_PREDICATES`，单测覆盖 79 条边的族归属与有向呈现
- [ ] 1.5 `build-v037-authority-snapshot.ts`：收取 localized-content `field_path=alias` 与 mli `alternative` 行；registry `multilingualLabelCount` 语义统一为构建器实际产出口径
- [ ] 1.6 `build-v037-r4-domain-catalog.ts`：7476/7300/176/零退役断言参数化为「声明退役集 + crosswalk 重钉」，catalogVersion 去硬编码
- [ ] 1.7 `v037-adapter.ts`、`build-v037-r5-locale-qualification.ts`、`restage-runtime-teaching-bindings.ts`、`emit-crosswalk-and-sources.ts` 的 r4/r5 硬编码参数化或改 r6

## 2. 捕获与快照

- [ ] 2.1 运行 capture 子命令产出 `cutover/candidates/control-theory-engineering-v0.37-r6/authority-capture.json`（COMPATIBLE，digest 绑定 ca20b912…）
- [ ] 2.2 运行 `build-v037-authority-snapshot.ts` 产出新 snap-*，原地 reopen 校验通过，不写任何 selector

## 3. 目录、投影与激活

- [ ] 3.1 catalog 候选构建：退役 4 个 v0.22 继承成员的治理裁决证据（引用扫描）入候选目录，crosswalk 重钉 7472 成员
- [ ] 3.2 domain-fragments 重组（compose-successor-domain-fragments）+ 课程投影重绑（restage-runtime-teaching-bindings）+ 教材 crosswalk/sources 按 r6 重发
- [ ] 3.3 消费者激活 staging（前任 activation-0b72f577）与六 selector apply 脚本就绪

## 4. 物化与资格

- [ ] 4.1 `materialize-authority-domain-shards.ts` 产出新 ads-* 并原子切换 current.json；分片内嵌教学投影为新 domain-fragments 指针
- [ ] 4.2 `verify-r4-authority-presentation-labels.ts` 呈现资格通过；locale 资格包重建并回填 registry 13 字段
- [ ] 4.3 U1 验收：新分片集全量复核 ENGINEERING 关系端点零缺席（对比 ads-294a0616 基线的 2462 条受影响边）；U6 验收：teachingCoverage 计数与 payload 逐域一致

## 5. 验证

- [ ] 5.1 定向 vitest：authority-domain-shard-coverage / delivery / sources、authority-domain-display-catalog、authority-locale-readiness、authority-locale-v037-package、latest-authority-oss-cutover
- [ ] 5.2 `rtk npm run test:unit`、`rtk npm run typecheck` 通过
- [ ] 5.3 浏览器冒烟：/knowledge 根视图、进入领域先后修族过滤、zh↔en 切换、别名检索命中（对照 artifacts/activate-v037-bilingual-authority-graph-1741 先例留证）
- [ ] 5.4 `rtk openspec validate adopt-v037-r6-authority-graph --type change --strict` 通过

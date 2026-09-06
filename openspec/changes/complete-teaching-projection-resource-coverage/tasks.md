## 1. 卡片身份与名称索引

- [x] 1.1 盘点 633 张未绑定卡与 `card-name-index.json` 4279 个未解析 canonicalKey，按可解析/已退役/需评审分类计数（回答 design Open Question 2）
- [x] 1.2 为 633 张卡生成 canonical 候选并完成独立语义评审，评审通过的写入 `card-crosswalk.jsonl`；补齐 `card-name-index.json` 可解析项，已退役项记显式豁免
- [x] 1.3 改 `runtime-full-binding.ts:260-262` 绑定通道：先消费卡 frontmatter `canonical_id`，再查 `card-crosswalk.jsonl`，两者皆无才记 `no-exact-identity` 账本

## 2. 信息图入投影

- [x] 2.1 `contracts.ts` 的 `TEACHING_RESOURCE_TYPES` 增加 `infographic` 类型
- [x] 2.2 restage 枚举 `infographs/authority/nodes/*.png`（1235 张），文件名 canonical token 精确绑定 overlay core，token 不在 core 内的进账本
- [x] 2.3 restage 枚举 `infographs/nodes/*.png`（161 张），按 legacy node_id 走 crosswalk/评审通道绑定；已退役节点 id 记显式豁免（回答 design Open Question 3）

## 3. lesson/step 与 core-nodes 回归

- [x] 3.1 把 `active-inventory.ts` 的课次/步骤盘点并入 restage 输入，lesson/step 资源类型恢复进投影
- [x] 3.2 改 `runtime-full-binding.ts:438`：core-nodes 从 `course-content/runtime/knowledge/prerequisites/releases/<pub>/core-nodes.json` 喂回，替代硬编码空数组
- [x] 3.3 restage 校验所选出版物 identity 与投影 Authority release 一致，不一致 fail closed

## 4. 单元绑定与仿真关联

- [x] 4.1 为 3-9 / 5-5 / 5-6 单元的 canonical 节点补教学绑定声明（coresByUnit 非空），使讲义 3-9/5-5/5-6 与习题 5-6 经既有通道绑定
- [x] 4.2 Odyssey `level-data.ts` 关卡数据补 canonical 关联字段，restage 移除硬编码 `relatedNodeIds: []`
- [x] 4.3 Arena `seed-challenges.ts` 的 `relatedKnowledge` 升级为 canonical id，restage 消费 canonical 端点
- [x] 4.4 lesson02 已退役：16 条 `launcher-lesson02-*` 从绑定分母直接清理——盘点侧登记退役排除清单，数据源侧删除残留 DB launcher 行；清理前验证课次路由、教案、课堂实例无活引用（design 决策 6 已定案）
- [x] 4.5 逐条评审 55 条 `classroom-sim-without-unit`：可归属课次的补映射，否则记显式永久例外

## 5. Franklin 对齐

- [x] 5.1 修正 Franklin crosswalk，使 4 个 `ctc:v11g-*` 端点对准 overlay A core（376 个）内的语义等价节点，经独立语义评审确认
- [x] 5.2 无等价节点的行记显式例外账本，不强行绑定

## 6. 账本治理

- [x] 6.1 例外账本接入治理报告：按原因类别输出计数、趋势与条目清单
- [x] 6.2 `--allow-ledger` 从总量 900 改为按原因类别的配额配置，初始值取 B′′ 各类实际剩余
- [x] 6.3 随缺口闭合逐类收紧配额至仅剩显式豁免，每次收紧为独立可回退配置变更

## 7. 重发布与验证

- [x] 7.1 本地重发布 B′′，校验全资源类型齐备（讲义/卡/信息图/仿真/习题/视频/音频/教材/lesson/step）
- [x] 7.2 校验例外账本仅剩显式豁免项，投影 gate 达 PUBLISHED
- [x] 7.3 新增聚焦测试：crosswalk 消费规则、信息图绑定、core-nodes 喂回、分类配额门禁
- [x] 7.4 运行 `rtk npm run typecheck` 与相关测试套件
- [ ] 7.5 PR 合入 `integration` 后冻结该 SHA 并执行 `deploy:runtime`（生产发布，执行时单独授权）

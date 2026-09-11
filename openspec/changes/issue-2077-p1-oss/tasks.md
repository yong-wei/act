## 1. 硬门禁与快照

- [x] 1.1 在现有 `adaptive-path-differentiation.ts` 增加硬门禁纯函数：Jaccard 相似度 ≤ 30%、每条 ≥2 独有已发布身份、独有占比 ≥50%、前半段 ≥1 独有、前两个非强制资源不同；先修/公共终点/sharedRequired 不计入
- [x] 1.2 从已加载的 `PublishedResourceFeatureIndex` + 活动 release 构造 `planningResourceSnapshot`，并写入候选批次 metadata
- [x] 1.3 为硬门禁与快照字段补最小单测

## 2. 装配与失败关闭

- [x] 2.1 删除 `assemble-plan.ts` 需求满足后「同类型已发布资源只再收一条」的跳过，补位优先未占用的 recommendable 节点
- [x] 2.2 `resolveAdaptivePathGenerationRegistry` 在索引/投影/release 不可用时失败关闭，禁止 catch 后改走未挂接发布索引的本地登记表
- [x] 2.3 三策略配额接到现有画像加权：薄弱点/优势迁移各 ≥2 个对应已发布资源，偏好路径非强制 ≥60% 且 ≥2 个独有偏好已发布资源

## 3. 批次成功条件

- [x] 3.1 成功批次仅在恰好 3 条且硬门禁通过时持久化为成功三卡；否则返回 `insufficient-candidate-diversity`，不得输出伪差异三卡或第 4 条主族路线
- [x] 3.2 比较投影展示每条路径实际消费的已发布身份与规划快照，学生 API 仍不下发原始对象键
- [x] 3.3 更新既有区分度/批次/option-count 测试与 #2055 e2e 合同，使软 7 选 3 不再被当成成功

## 4. 验证

- [x] 4.1 运行相关 path-planning / candidate-batch 单测与 `openspec validate issue-2077-p1-oss --strict`
- [x] 4.2 受控画像单变量对照：更换薄弱点或偏好后，规划快照或路径节点中的已发布集合可观测变化

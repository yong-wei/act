## Context

规划闭环已经是：活 `PublishedResourceFeatureIndex` → 登记表物化 → 三策略装配 → 事后 Runtime 绑定 → 批次区分度。#2033 的成功标记是 7 项中 3 项（Jaccard **距离** ≥ 0.40，相似度可到 60%）；`assemble-plan.ts` 在需求满足后跳过同类型第二份已发布资源。新 Runtime 控制面是 `runtime:publish` / `runtime:activate`，本变更只读当前活动指针。

## Goals / Non-Goals

**Goals:**

- 生成前留下本次活索引 + 活动 release 快照，失败关闭。
- 三条路径真正吃已发布/OSS 资源，并通过 #2077 硬门禁；不够就返回 `insufficient-candidate-diversity`。

**Non-Goals:**

- 不新建 OSS 清单扫描、第二规划器或第二套身份规则。
- 不改 `runtime:publish` / `runtime:activate`、overlay、生产选择器，也不在本变更里发布或激活 Runtime。
- 不改历史批次，不把完整 Git SHA 当兼容性代理。

## Decisions

1. **快照复用已加载索引。** `resolveAdaptivePathGenerationRegistry` 已先 `loadPublishedResourceFeatureIndex()`。批次 metadata 写入 `planningResourceSnapshot`：`indexId`、`projectionId`/`projectionHash`、`runtimeReleaseId`，以及 recommendable 项的 `resourceId`、`resourceVersion`、`sourcePath`/`objectKey`（objectKey 有绑定就记绑定，否则记 sourcePath）。禁止再扫桶。

2. **索引失败不得改走本地登记表。** 现有加载已 throw。禁止 catch 后只用四族本地源继续生成。版本漂移继续用现有 409。

3. **删同类型已发布截断。** 去掉需求满足后「同 type 只再收一条 publishedResource」的跳过。补位时优先 `diversityAvoidNodeIds` 未占用的 recommendable 节点。先修/公共终点/sharedRequired 仍共享。

4. **硬门禁接在现有 counted nodes 上。** 继续剔除统一先修、终结验证与读失败资源。独有身份优先 `resourceFeatureRef.resourceId`，否则 `objectKey`。#2077「相似度 ≤ 30%」= Jaccard **相似** ≤ 0.30，即现有距离函数 ≥ 0.70。7 项指标仍持久化供比较区，但成功与 `highDifferentiation` 必须过硬门禁，不再 7 选 3。

5. **成功与诚实失败。** 成功批次：恰好 3 条且硬门禁与策略配额都过。否则不输出三条伪差异卡；返回 `insufficient-candidate-diversity`（可并列既有 `insufficient-verified-resources`）。主规划族仍不得当第 4 条。

6. **策略配额用现有族。** foundation-remediation ≥2 个缺口相关已发布资源；simulation-driven ≥2 个仿真/工作台/案例/综合已发布资源；preference-matched 非强制资源 ≥60% 匹配偏好且 ≥2 个独有偏好已发布资源。画像单变量变化必须改变参与规划的已发布集合。

## Risks / Trade-offs

- [当前活动 Runtime 可绑定资源仍少] → 诚实失败，不降阈值，不另发 Runtime。
- [硬门禁比 7 选 3 严] → 旧成功批次不回填；只约束新生成。
- [卡片/信息图可能无 blob objectKey] → 独有集合认发布身份，绑定层仍按 #2055 记录。

## Migration Plan

先补硬门禁纯函数与快照字段，再删装配截断、改持久化成功条件，最后更新比较投影与测试。无需数据迁移。回滚即恢复软标记与截断。

## Open Questions

无。活动 Runtime 以部署目标当时指针为准，本变更不钉死某个 releaseId。

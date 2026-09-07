## Why

教学投影 B′ 已绑定 519 份资源，但知识图谱 inspector 的启动链路只为 28 份讲义产出可点击 href：launch map（`src/lib/layered-graph/course-page-context.ts:175-226`）只覆盖 lesson/handout/step 三种类型，textbook/card/video/audio/exercise/simulation 落入 default 分支被标记 `unavailable`；即使补齐 launch map，第二道闸门 `closeResourceBlockWithLiveRegistryIndex`（`src/lib/knowledge-surface/registry-closure.ts:118`）仍会因 live registry index 不持有这些 href、B′ authoringRevision 与部署 revision 不一致而整块剥离资源。全平台没有通用查看器壳与可用的 Fullscreen API 封装，学习者无法在图谱、路径中心、控灵三处就地打开已绑定资源。

## What Changes

- 扩展 `buildTeachingResourceLaunchMaps` 至全资源类型：video/audio → 课次入口或媒体锚；exercise → 经 manifest 级映射补 stepId 后复用 step 启动合同；simulation → Arena 任务页 / control-odyssey / `/interactive-learning/resources/<dbId>`；card → 查看器壳内部打开；textbook → `buildTextbookReaderHref` + 书籍 id 别名表（本变更落别名表与 locator→阅读器坐标解析的最小实现，全面坐标体系在 Change 2）。
- 闭合第二道闸门：在 `resource-registry-metadata.ts` 为对应条目登记 `launchTarget`，使 inspector 暴露的每条 href 被 live registry index 精确持有；建立 B′ authoringRevision 与部署侧 APP_REVISION 的对齐发布断言。
- 新增统一查看器壳组件（Radix Dialog 96vw，参照 `TextbookReaderModal` 双模式）：按类型分发给既有渲染器（ResourceRenderer / KnowledgeCard / 信息图放大 / 嵌入 TextbookReader / 仿真渲染或跳转），壳级 Fullscreen API + 「打开完整页」切换整页正常访问模式。
- 渲染补全：`ResourceRenderer` 的 STATIC_MEDIA 补音频分支；exercise 经 stepId 定位到课次 demo step。
- 三处入口接入：图谱 inspector 点击资源从整页 `<a>` 跳转改为打开查看器壳；路径中心 `launchExecutionNode`（`src/app/assessment/adaptive-practice/page.tsx:4894`）接入；控灵资源卡/引用面板的接线在 Change 6 完成，本变更只交付壳组件与打开 API。
- 不新建平行渲染体系（一律委派既有 renderer）；不改 sanitizer 与回答正文链接策略；不做自适应练习题独立组件（列为后续）；不执行生产发布。

## Capabilities

### New Capabilities

- `universal-resource-viewer`：统一查看器壳契约——按资源类型的分发规则、Fullscreen/整页双模式、三处入口的统一打开 API，以及禁止在壳内重建运行时的委派约束。

### Modified Capabilities

- `authority-surface-complete-linkage`：launcher-safe descriptor 要求从「部分类型有安全 href」收紧为「每种可启动类型都必须暴露 live registry index 持有的安全 href」，资源块身份闸门新增 authoringRevision 与部署 revision 对齐的发布断言。
- `authority-card-infograph-inspector`：资源启动交互从整页跳转改为默认在统一查看器壳内就地渲染，保留「打开完整页」逃生口；委派既有 launcher/renderer 的约束扩展到查看器壳分发。

## Impact

影响 `src/lib/layered-graph/course-page-context.ts`（launch map）、`src/lib/resource-registry-metadata.ts` 与 live registry index 构建（launchTarget 登记）、`src/features/lesson-engine/resource-renderer.tsx`（音频分支）、`src/features/knowledge/active-authority-graph.tsx`（inspector 入口）、`src/app/assessment/adaptive-practice/page.tsx`（路径中心入口）、新增查看器壳组件与打开 API、发布断言脚本。不改投影生成管线、不改 overlay A、不改 sanitizer、不改应用镜像与部署流程。依赖 Change 1（B′′ 数据闭合）与 Change 2（教材坐标解析）的产出；生产内容发布与部署不在本变更执行。

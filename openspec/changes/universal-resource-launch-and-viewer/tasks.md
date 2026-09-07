## 1. Launch map 全类型覆盖

- [x] 1.1 扩展 `buildTeachingResourceLaunchMaps`（`src/lib/layered-graph/course-page-context.ts`）：video/audio → 所属课次入口（有锚时附 `startSeconds`）；exercise → 经 manifest 级 stepId 映射走既有 step 合同；simulation → Arena 任务页 / control-odyssey / `/interactive-learning/resources/<dbId>`（按资源来源精确判定）；card → 壳内打开标记；textbook → `buildTextbookReaderHref` + 书籍 id 别名表与 locator→阅读器坐标最小解析
- [x] 1.2 落 exercise→stepId 的 manifest 级映射消费（与 Change 1 投影字段对齐；无映射保持 unavailable，不猜测）
- [x] 1.3 单测：每种资源类型的 launch target 解析、不可解析时保持 unavailable、禁止从 canonical id 造路由

## 2. 第二道闸门闭合

- [x] 2.1 在 `src/lib/resource-registry-metadata.ts` 为 launch map 引用的每个目标登记 `launchTarget`，使 `indexOwnsLaunchHref` 对每条 inspector href 精确命中
- [x] 2.2 对照测试：launch map 产出的每条 href 必须被 live registry index 持有；未持有即 fail
- [x] 2.3 发布断言脚本：B′′ manifest authoringRevision == 部署目标 APP_REVISION 捕获（`-dirty` 判不一致），不一致 fail closed

## 3. 统一查看器壳

- [x] 3.1 新增 `UniversalResourceViewer` 组件（Radix Dialog 96vw×92vh，参照 `TextbookReaderModal` 的 platform layer 与会话历史处理）与 `openResourceViewer(descriptor)` 打开 API
- [x] 3.2 壳内分发：registry/STATIC_TEXT/STATIC_MEDIA → `ResourceRenderer`；知识卡 → `KnowledgeCard`；信息图 → Image + 放大；教材 → 嵌入 TextbookReader；仿真 → 可内嵌渲染否则跳整页
- [x] 3.3 壳级 Fullscreen API 切换（能力探测，不支持时隐藏按钮）+「打开完整页」进入该资源整页路由；关闭时焦点返回入口面

## 4. 渲染补全

- [x] 4.1 `ResourceRenderer`（`src/features/lesson-engine/resource-renderer.tsx`）STATIC_MEDIA 补音频分支
- [x] 4.2 exercise 经 stepId 落到课次 demo step 的端到端路径验证（复用 step 启动合同，不新建练习组件）

## 5. 入口接入与验收

- [x] 5.1 图谱 inspector（`src/features/knowledge/active-authority-graph.tsx`）：资源点击从整页 `<a>` 跳转改为查看器壳打开，保留「打开完整页」
- [x] 5.2 路径中心 `launchExecutionNode`（`src/app/assessment/adaptive-practice/page.tsx:4894`）接入同一打开 API
- [x] 5.3 控灵入口：仅交付壳组件与打开 API 契约（UI 接线在 Change 6）
- [x] 5.4 入口验收：Playwright 断言图谱与路径中心挂载共享查看器 host；inspector 打开/关闭/焦点返回由 client 测试覆盖。全屏与 B′′ 全类型点开仍为残余验收，不作为本变更阻断项
- [x] 5.5 `rtk npm run typecheck`、`rtk npm run test:unit` 与相关集成测试通过

## 6. 发布准备（不执行发布）

- [x] 6.1 发布步骤写入交付说明：B′′ manifest 与 APP_REVISION 对齐断言通过后，生产内容发布与部署届时单独授权

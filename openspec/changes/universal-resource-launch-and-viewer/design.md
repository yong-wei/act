## Context

教学投影 B′（`proj-d22e0cca…`）有 519 份已绑定资源，但图谱 inspector 的资源启动链路存在两道断点：

1. **launch map 类型缺口**：`buildTeachingResourceLaunchMaps`（`src/lib/layered-graph/course-page-context.ts:175-226`）的 switch 只覆盖 lesson / handout / step；textbook、card、video、audio、exercise、simulation 落入 default 分支（`:218` 注释明说不产出链接），经 `resolveSafeLaunchTarget` 后前端只剩整页 `<a>` 跳转的少数条目（`src/features/knowledge/active-authority-graph.tsx:980-1022`）。B′ 没有 lesson/step 资源，519 份绑定里只有 28 份讲义有 href。
2. **第二道闸门剥离**：`closeResourceBlockWithLiveRegistryIndex`（`src/lib/knowledge-surface/registry-closure.ts:118`）要求 (a) B′ manifest authoringRevision 等于部署侧 live registry index 的 captureRevision（`src/features/knowledge/resource-index/revision.ts:41`，`-dirty` 判空），(b) 每条 href 被 live index 某条目的 launcherRef / registryId / sourceRef 精确持有（`indexOwnsLaunchHref`，`:60`）。当前 168 条 index 只持有 2 条路由型 launcherRef（2 个 Arena 任务），连讲义 href 都不被持有——launch map 补齐后资源块仍会被整块剥光。这是硬门槛，不是 UI 问题。

渲染与路由现状（复用依据）：

- `/interactive-learning/resources/[id]`（`src/app/interactive-learning/resources/[id]/page.tsx`，经 `src/features/lesson-engine/resource-renderer.tsx`）可渲染全部 registry 组件 + STATIC_TEXT / STATIC_MEDIA，是通用整页落点。
- 教材有整页 `/textbooks/...` + 拦截路由 modal（`TextbookReaderModal`，96vw×92vh，Radix Dialog，整页/模态双模式），是查看器壳的形态样板。
- 知识卡只有 `KnowledgeCardDialog`（75vh modal）无独立路由；信息图有放大 Dialog；讲义有 handout-print 打印页；视频/音频无独立页（`LessonEntryMediaHub` 内嵌；`ResourceRenderer` 的 STATIC_MEDIA 只认 `.mp4` 不认音频）；自适应练习题内联在 adaptive-practice 页、无独立组件；仿真场景有 `/simulations/<scene>` 沉浸页，课堂内 `SimulationCourseResource` 只显示启动卡新开页。
- Fullscreen API 全平台仅 `src/features/knowledge/classroom-player.tsx:36-46` 一处且是死代码；无通用查看器壳。

相关 spec 约束：`authority-card-infograph-inspector` 要求资源启动委派既有 launcher/renderer、不得在抽屉内重建运行时、媒体传 `startSeconds` 锚、文本/习题传原子锚；`authority-surface-complete-linkage` 要求每条资源有 launcher-safe descriptor、可启动类型暴露 live registry 持有的安全 href。

依赖关系：本变更消费 Change 1（投影数据闭合，B′′）与 Change 2（教材坐标解析）的产出；textbook 分支的完整坐标体系在 Change 2，本变更只落书籍 id 别名表与 locator→阅读器坐标解析的最小实现。控灵入口接线在 Change 6，本变更只交付壳组件与打开 API。

## Goals / Non-Goals

**Goals:**

- B′′ 全部已绑定资源类型在图谱 inspector 可点击打开并就地渲染：lesson / handout / step / video / audio / exercise / card / infographic / textbook / simulation。
- 每条对外暴露的 href 被 live registry index 精确持有，authoringRevision 与部署 revision 的对齐在发布环节可断言。
- 统一查看器壳：模态内委派既有渲染器就地渲染，壳级 Fullscreen API，「打开完整页」切换该资源的整页正常访问模式。
- 图谱 inspector、路径中心 `launchExecutionNode` 两处入口完成接入并各有 Playwright 验收；控灵入口以打开 API 形式就绪。

**Non-Goals:**

- 不新建资源类型的平行渲染体系；一切渲染委派既有 renderer / launcher / 路由。
- 不改控灵回答正文 sanitizer 与链接策略；不在本变更接线控灵入口（Change 6）。
- 不做自适应练习题的独立组件（列为后续工作）。
- 不改投影生成管线、overlay A、应用镜像；不执行生产发布与部署（仅写发布断言脚本与步骤，执行另行授权）。
- 不扩大教材范围到三本源教材之外。

## Decisions

1. **launch map 扩展复用现有 switch，每类型映射到已存在的路由或壳内打开。** video/audio → 所属课次入口 `/interactive-learning/courses/<routeSegment>`（有 manifest 级媒体锚时附 `startSeconds`）；exercise → 经 manifest 级映射补 `stepId` 后走既有 step 合同 `…/student/demo?step=<stepId>`；simulation → Arena 任务页 / control-odyssey 关卡 / `/interactive-learning/resources/<dbId>` 三选一（按资源来源精确判定，不从 canonical id 造路由）；card → 不产出整页 href，标记为壳内打开（`viewer:` 协议目标）；textbook → 经书籍 id 别名表 + locator 最小解析产出 `buildTextbookReaderHref`。备选是新建统一 `/resource/<id>` 路由分发；拒绝，因为 `/interactive-learning/resources/[id]` 与既有课次/教材路由已覆盖整页需求，新路由只会制造第二套身份。

2. **第二道闸门用「登记」而非「放行」闭合。** 在 `src/lib/resource-registry-metadata.ts` 为 launch map 会引用的每个目标登记 `launchTarget`（静态路由型条目），使 `indexOwnsLaunchHref` 对每条 inspector href 精确命中；不改 `closeResourceBlockWithLiveRegistryIndex` 的持有判定逻辑本身。备选是在闸门里加白名单；拒绝，持有判定是治理不变量，开口子会让漂移资源重新流入。

3. **authoringRevision 对齐做成发布断言，不做运行时绕过。** 发布脚本在内容发布前断言 B′′ manifest authoringRevision == 部署目标 APP_REVISION（同一捕获 Git SHA，`-dirty` 视为不一致），不一致则 fail closed。运行时不新增回退路径。这保持「治理清单、registry、schema、writer discovery、anchor、export/proof、manifest 绑定同一捕获修订」的仓库不变量。

4. **统一查看器壳是唯一新组件，三处入口共用。** `UniversalResourceViewer`：Radix Dialog、96vw×92vh（参照 `TextbookReaderModal` 的 platform layer 与会话历史处理），内部按资源类型分发——registry 组件/STATIC_TEXT/STATIC_MEDIA → `ResourceRenderer`；知识卡 → `KnowledgeCard`；信息图 → Image + 放大；教材 → 嵌入 TextbookReader；仿真 → 可内嵌则渲染、否则跳整页。壳提供 Fullscreen API 切换（`requestFullscreen` / `exitFullscreen`，替代 classroom-player 死代码路径）与「打开完整页」按钮（进入该资源整页路由，即正常访问模式）。壳不实现任何资源运行时，只分发。备选是每处入口各写各的 modal；拒绝，三个入口的打开语义必须一致，分散实现会立刻漂移。

5. **查看器壳打开 API 为 `openResourceViewer(descriptor)`。** descriptor 携带资源身份、类型、标题、整页回退 href 与类型特定载荷（如 `startSeconds`、stepId、教材坐标）；图谱 inspector 与路径中心在本变更接入，控灵在 Change 6 复用同一 API。inspector 的默认点击行为从整页 `<a>` 跳转改为壳内打开，保留「打开完整页」逃生口；这既满足「委派既有 renderer」约束，又不剥夺用户进入完整页的选项。

6. **渲染补全保持最小。** `ResourceRenderer` STATIC_MEDIA 增加音频分支（复用现有播放器原语）；exercise 不新建组件，经 stepId 复用 step 启动合同落到课次 demo step。自适应练习题独立组件明确不做。

## Risks / Trade-offs

- [launchTarget 登记遗漏导致闸门继续剥离] → 为每类 href 建对照测试：launch map 产出的每个 href 必须命中 live index 持有判定；CI fail closed。
- [exercise→stepId 的 manifest 级映射缺失] → 映射不进投影时不产出 href（保持 unavailable），不猜测；缺口进例外清单随 Change 1 账本治理。
- [查看器壳嵌入 TextbookReader / 仿真时的样式与焦点冲突] → 壳只管布局与全屏，内部渲染器保持自治；Playwright 验收覆盖打开/全屏/整页切换/关闭焦点返回。
- [Fullscreen API 在部分浏览器（iOS Safari）不可用] → 能力探测，不可用时隐藏全屏按钮，模态与整页模式不受影响。
- [textbook 最小坐标解析与 Change 2 完整坐标体系冲突] → 本变更只消费 Change 2 已落地的别名表与解析接口；接口签名在设计评审时与 Change 2 对齐，不各自发明。
- [改动 `active-authority-graph.tsx` 影响 inspector 既有交互] → 保留 inspector spec 的稳定面板、就地更新、焦点恢复语义；点击目标从 `<a>` 换成按钮 + 壳，键盘与可及性路径不变。

## Migration Plan

1. 实现 launch map 扩展、registry launchTarget 登记与发布断言脚本；本地用 B′/B′′ 夹具跑闸门测试。
2. 实现查看器壳与 ResourceRenderer 音频分支；两处入口接线。
3. Playwright 验收三处入口行为（控灵入口验证 API 契约，UI 接线在 Change 6）。
4. `rtk npm run typecheck`、`rtk npm run test:unit`、相关集成测试通过后提交。
5. 生产内容发布（B′′ manifest 与 APP_REVISION 对齐发布）列为步骤但不执行，届时单独授权。
6. 回滚：入口点击行为可配置回整页跳转；registry launchTarget 新增条目可单独摘除，不影响既有持有条目。

## Open Questions

- card 类型在壳内打开时的 descriptor 目标形态（`viewer:` 协议字符串 vs 结构化对象标记），实现时以不污染 `resourceLaunchTargets: Record<string, string | null>` 现有消费方为原则确定。
- exercise 的 manifest 级 stepId 映射由 Change 1 的投影字段承载还是本变更新增 sidecar 映射文件承载，需在实现启动时与 Change 1 产出对齐一次。

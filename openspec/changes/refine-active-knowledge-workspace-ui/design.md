## Context

新版工作台由 `KnowledgeGraphWorkspace` → `ActiveAuthorityGraph` → `ActiveAuthorityRenderer`（2D：`react-force-graph-2d`，坐标在 `active-authority-geometry.ts` 预计算并以 `fx/fy` 固定）组成，标签由 DOM 标签层按 `placeActiveAuthorityLabels` 放置。现状缺陷见 proposal.md。

掌握度数据面的事实（本地库核对）：

- `LearningFact` 共 5603 行，`CANONICAL` 身份 0 行；历史事实以 `contextJson.knowledgeNodeIds` 记旧图谱节点。
- 新版节点 ID 形如 `ctkg:m3-v2b:canonical-object:<hash>`；作者态 `teaching-projection/legacy-crosswalk.jsonl` 默认空，尚未发布到 runtime；课程覆盖审核表使用另一套 `ctc:` 命名空间，不能直接使用。
- `src/lib/canonical-learning-fact-identity/crosswalk-serving.ts` 已提供读时解析，不改写事实。

## Goals / Non-Goals

**Goals:**

- 1440×900 下根视图、领域视图、选中态满足既有清晰度边界（零 glyph 重叠，可见标签重叠 ≤5%）。
- 深浅主题下画布与面板均由 token 派生且可读。
- 掌握度链路端到端可用：有合格数据即显示，无数据如实为空。

**Non-Goals:**

- 不生成或审核 Legacy→Canonical 对照数据，不发布 runtime，不回填历史事实。
- 不提供教师班级热力叠加（仍归 Graph Center class overlay）。
- 3D 渲染器只同步共享调色板，不做布局重构；旧版图谱不改。

## Decisions

1. **根视图确定性气泡 packing。** `makeRootLayout` 改为 `packRootBubbles`：按半径降序、以稳定相位的黄金角螺旋（16:10 纵横比）逐个寻找首个零重叠位置（间隙 18 世界单位），替代圆环。气泡半径 = max(名称内嵌所需半径, `48 + 2 × sqrt(memberCount)`)，`nodeRadius` 对根不再夹到 34–54。备选：复用 `packKnowledgeGraphRootNodes`——放弃，其按固定半径排布，无法表达按知识点数量变化的气泡尺寸。
2. **根标签内嵌。** 根标签放在气泡中心，名称按测量宽度均衡折为 1–3 行（避免单字孤行），下方附“N 个知识点”或“掌握 N%”副行；字号按 `clamp(12, 14 × zoom, 18)` 缩放；无背景底板。领域节点标签仍在 glyph 下方。
3. **领域布局标签感知。** 碰撞半径改为 `max(renderRadius, labelHalfWidth × 0.62, (labelHeight + 2r)/2) + 10`，层间距与同层间距随最大标签宽度放大；孤立概念改为在连通簇下方按行排布的紧凑带，替代外圈螺旋。标签是屏幕定尺寸而布局是世界坐标，fit 后可读性取决于簇的纵横比：2D 下深而窄的先修链（层数 > 最宽层 × 1.25）改为左→右流向；力导后仍偏高的连通簇沿 x 拉伸至 16:10（最多 2.2 倍，只增大距离不引入新重叠）。2D fit 预留安全区（领域：上 64 / 下 124 px，根：上 48 / 下 32 px），内容不压在工具栏、覆盖统计与关系族栏下。DOM 标签字体与测量字体一致，并把芯片内边距计入碰撞盒。
4. **选中邻居标签避让。** 选中节点标签无条件显示；邻居标签按优先级参与碰撞检测，放不下时依次尝试下方、上方、右侧、左侧四个锚位，仍冲突则隐藏（hover/inspector 可见）。
5. **主题调色板运行时读取 token。** 新增 `useActiveCanvasPalette()`：从 `document.documentElement` 读取 `--platform-*` HSL 三元组，`MutationObserver` 监听 `class` 变化后重建调色板并请求重绘；节点色调映射到 `action-primary / evidence-* / privacy-* / brand-*` 角色。图例样本与画布共用同一调色板。
6. **仪表盘质感。** 根气泡：径向渐变填充、偏移内高光、上缘 rim-light 弧、外 halo；hover/当前气泡缓慢呼吸（`prefers-reduced-motion` 关闭）。领域节点：实心 glyph + 细描边 + 选中外环；有掌握度时在 glyph 外绘制 270° 进度弧。
7. **inspector 与工具栏避让。** 桌面 inspector 改为 `top-16 bottom-3 right-3`，工具栏保持 `top-3`；两者 z 序不再依赖覆盖。
8. **关系族“缺失”与“失败”分离。** `ShardFailureEntry` 增加 `kind: 'absent' | 'error'`；HTTP 404 且 code 为 `ACTIVE_SHARD_SHARD_ABSENT` 判为 absent：中性 `role="status"` 文案、无重试、开关保持可切换但标注“暂无”。其余保持错误色 + 重试。
9. **掌握度服务端聚合。** 新增 `GET /api/knowledge/shards/active/mastery`：
   - 鉴权沿用 `authorizeActiveGraph()`；仅 STUDENT 读取本人，TEACHER/ADMIN 返回 `not-applicable`。
   - 身份来源：`CANONICAL` 且 `canonicalObjectId` 属于当前 active 领域分片成员的事实；历史事实仅在运行态 `resolveConfiguredTeachingProjectionRoot()/legacy-crosswalk.jsonl` 存在且行非 stale 时经 `resolveHistoricalLearningFactDisplayContext` 读时解析。对照表为空时不查询历史事实正文，只统计数量。
   - 评分：`score/100`，缺失时 `success=1 / partial=0.5 / failure=0`，`unknown/abandoned` 不计；每对象取最近 20 条均值；证据数 <2 → `evidence-needed`；≥0.8 `mastered`，≥0.5 `developing`，否则 `weak`；置信度 `min(1, n/5)`。领域汇总只对有证据对象求均值。
   - 纯函数 `buildActiveAuthorityMasteryOverlay()` 放在 `src/lib/authority-learner-mastery/`，路由只做 IO。
10. **客户端叠加不触碰布局。** 掌握度作为独立 state 传入渲染器 paint 路径，不进入 `nodes` 结构签名，避免重算坐标。

## Risks / Trade-offs

- [packing 改变根坐标导致既有根布局测试失效] → 更新测试为新的契约（零重叠、名称内嵌、尺寸单调）。
- [运行时读取 CSS 变量在 SSR/测试环境不可用] → 提供与 token 同值的回退调色板，Vitest 用回退值断言。
- [15 个领域分片逐个加载影响掌握度接口延迟] → 仅在存在可映射事实时加载分片；空数据路径只做两次 count 查询。
- [对照表后续发布后命名空间仍不匹配] → 只接受 canonicalId 落在当前 active 分片成员中的行，其余计入 `unresolved`。

## Migration Plan

纯应用代码变更，无迁移。回退即还原提交。

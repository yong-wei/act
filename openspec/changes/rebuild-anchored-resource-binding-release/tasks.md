## 1. 内容真源补齐

- [x] 1.1 生成 `course-content/authoring/knowledge/resource-bindings/course-node-crosswalk.jsonl`：以 `canonical-nodes.json` 220 个课程节点为分母，用 `course-order/topics.jsonl`、`20260823-asr-batch/course-to-authority-map.json`、`crosswalk-v037.json` 名称精确匹配预填，未解析行标 `unmapped`；输出覆盖统计
- [x] 1.2 讲义章节锚点：脚本解析 runtime `*-handout.md` 的 `##/###` 标题生成 `headingId = h<n>-<slug>`，按术语重叠（label 2 / description 1，≥2）预填章节 ↔ 课程节点，写入 `resource-anchors/<unit>.json` 的 `handoutSections`
- [x] 1.3 音频锚点：把 `audio-semantic-segments/<unit>.json` 转为 `resource-anchors/<unit>.json` 的 `media[audio].segments`（startSeconds/endSeconds/nodeIds/provenance=asr-terminology）
- [x] 1.4 导入视频锚点：导入 Videos 项目 `captions.generated.ts` 与 `captions.ts` 偏移，按 `narrationDuration + intro + outro ≈ ffprobe` 逐单元校验，产出 cue 段与术语匹配节点候选；偏差超容差标记 `offset-unverified`
- [x] 1.5 课程视频转录：读 `.agents/skills/locallm/SKILL.md` 选定本机 ASR（优先复用 `fun-asr-nano + qwen3-forcedaligner + fsmn-vad`），对 28 个 `*-course.mp4` 抽音轨转录，产出 transcript / word-timestamps / segments 到 `20260913-course-video-asr/`，并生成时间段锚点
- [x] 1.6 转录导出：`course-content/scripts/export_runtime.py` 新增写 `runtime/lessons/<unit>/media/<unit>-{audio,intro-video,course}.transcript.json`（contract `act-media-transcript/v1`，含媒体 sha256、processorIdentity）；对 31 课执行导出
- [x] 1.7 锚点 review 账本：`resource-anchors/review/<unit>.jsonl` 结构与合并规则（accept/reject/override），首版为空

## 2. 绑定发布族

- [x] 2.1 `src/lib/resource-binding-release/contracts.ts`：`AnchoredResourceRuntime`、`AnchoredBindingRuntime`（anchor、appearance、teachingOrder、focus、provenance）、manifest、gate、audit 类型与 zod/手写解析器
- [x] 2.2 `hash.ts` 与 `identity.ts`：canonical JSON 摘要、`bindingReleaseId = <authorityReleaseId>-b<n>` 派生（扫描既有 releases 递增）
- [x] 2.3 `sources.ts`：加载 Authority 身份、prerequisite publication、active lesson inventory、`sequence.json`、crosswalk、anchors、review、course-order、textbook v2 crosswalk、卡片/信息图/仿真精确通道、激活运行态清单（媒体 sha256）
- [x] 2.4 `builder.ts`：按规则生成 resources/bindings（step→group 节点；handout→heading；audio/video→time；textbook→section；card/infograph/simulation/exercise 沿用；排除 `act:lesson:*` 与全书级 textbook），计算 `appearance/teachingOrder/focus`
- [x] 2.5 `gate.ts` 与 `audit.ts`：fail-closed 检查（入口资源、缺锚点、Authority 不一致、媒体 sha256 漂移、锚点越界、unmapped 节点）与扇出审计（对比旧 B′）
- [x] 2.6 `store.ts`：写 `course-content/runtime/knowledge/resource-bindings/releases/<id>/{binding-manifest.json,resources.jsonl,bindings.jsonl,gate.json,audit-report.json}` 与 `current.json`；读取与校验
- [x] 2.7 CLI `tools/resource-bindings/cli.ts` 与 npm scripts `resource-bindings:check|write|qualify`
- [x] 2.8 单测：identity 派生、builder 规则（含整课喷涂回归：step 不绑同单元其他节点）、appearance 判定、gate 每类失败、store 往返

## 3. 激活锁与运行态身份

- [x] 3.1 `versioned-knowledge-activation/contracts.ts`：combination 增加 `bindingReleaseId/bindingHash`；`stage.ts` 校验绑定发布 Authority 一致与媒体 sha256；`readiness.ts` 把绑定发布列为 course-runtime/konling/learning-path/teaching-resource-rag 本地依赖
- [x] 3.2 `teaching-projection/live-course-pointer.ts`：要求 `resource-bindings/current.json` 与 activation 一致，返回 `bindingReleaseId/bindingHash`
- [x] 3.3 本地构建 `control-theory-engineering-v0.37-r6-b1`，stage 新 activation（不 publish/activate/deploy），生成审计报告并写入 `docs/reports/`
- [x] 3.4 更新激活相关测试（`activate-versioned-knowledge-consumers.test.ts`、`assert-knowledge-publication-consistency.ts` 等）

## 4. 深链与消费者

- [x] 4.1 `teaching-resource-launch-maps.ts`：按 anchor 生成 `?step=`、`handout-print#<headingId>`、`/interactive-learning/courses/<seg>?media=<id>&t=<s>`、教材小节；不为 lesson 生成 href；导出锚点标签格式化函数
- [x] 4.2 `handout-print`：渲染稳定标题 `id`（与 1.2 同一算法，抽为共享模块）并按 hash 滚动
- [x] 4.3 课次入口页与 `lesson-entry-media-hub.tsx`：解析 `media/t`，选中槽位，`loadedmetadata` 后设 `currentTime`；对比绑定 `mediaSha256` 与 `resource.sha256`，不一致时整段播放并提示定位待更新
- [x] 4.4 抽屉：`authority-domain-shards/resource-bindings.ts` 改读绑定发布；`ActiveResourceBinding` 增加 `anchorLabel/appearance`；`active-authority-graph.tsx` 展示锚点标签与首次/复现标记
- [x] 4.5 路径规划：`planning-projection-index.ts` 改读绑定发布并携带 anchor/appearance/teachingOrder；新增 `application/mastery-thresholds.ts`；`knowledge-path-mount.ts` 读取 `knowledgeMastery` 做准入与跳过；`knowledge-path-assembly.ts` 排序加入首次优先与教学顺序就近；`planningResourceSnapshot` 记录 `bindingReleaseId/bindingHash`
- [x] 4.6 路径时间线与 `/learning-resources/[resourceId]`：资源节点显示锚点标签与 appearance，启动 href 带定位参数
- [x] 4.7 其余 B′ 绑定读取点切换或退役：`published-resource-index.ts`、`layered-graph/resolver.ts`、`full-resource-path-readiness-gate.ts`、`authority-domain-shards/learning-content.ts`、`teaching-projection/store.ts` 的 bindings 读取加弃用告警；`restage-runtime-teaching-bindings.ts` 绑定部分退役说明
- [x] 4.8 Konling 与教学资源 RAG 的候选来源切换到绑定发布（只改数据源与准入，不改解释结构）

## 5. 验证

- [x] 5.1 新增 `scripts/db/seed-path-mastery-test-learners.mjs`：本地写入三个测试学习者的 `AdaptiveMasteryUpdate`（零掌握 / 部分 ≥0.5 / 已掌握 ≥0.85 且 confidence ≥0.6），只允许 loopback 数据库
- [x] 5.2 单测：launch maps 深链、mastery 门控与排序、抽屉锚点标签、媒体定位 hook、活指针与激活锁
- [x] 5.3 三档学习者对同一目标切片生成路径（`path-advisor-tool`），断言资源池与顺序差异并写入 `docs/reports/`
- [ ] 5.4 Playwright：抽屉点击音频跳到时间戳、讲义跳到章节、step 参数定位、路径节点启动带锚点；控制台无错误
- [x] 5.5 `npm run typecheck`、`npm run lint`、`npm run test:unit`、限域脚本测试；更新 `docs/ProjectDescription.md` 与 `.wolf/STATUS.md`

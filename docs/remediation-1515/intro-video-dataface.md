# Intro-video 数据面探查报告（任务族 3 前置，2026-08-24）

## 结论

任务族 3（intro-video 生产源 importer）的数据源已定位并核验可及，但 **Videos 项目侧的配音与最终渲染状态未收口**，完整 importer 依赖视频侧先完成以下收口。ACT 侧不阻塞：资源信封已将 intro-video 列为显式 limitation，投影 COMPLETE 不依赖该子类型。

## 数据面事实

- **Videos 项目**：`/Users/YW/Documents/Project/Videos`（Remotion，独立运行时，不入 ACT 依赖）。
- **课程组合**：`src/projects/lesson-<unit>/` 共 32 个单元项目，每个含 `Composition.tsx`、`captions.ts`（分段时间轴+段标题）、`timeline.ts`、`VIDEO-DESIGN.md`、`assets/audio/captions.generated.ts`（生成字幕真源）。
- **ACT 目标身份**：`runtime-media:<unit>:<unit>-intro-video`（如 `runtime-media:4-3:4-3-intro-video`），与 lesson-<unit> 一一对应（3.1 的映射基础成立）。
- **渲染产物**：`out/*.mp4` 共 99 个，命名含阶段后缀（framework/findings/final/leftover + 时间戳），**每单元"最终版"的判定规则需要在 Videos 侧确认**（3.3 的 final-render-hash 验证前提）。

## 配音状态分布（captions.generated.ts 的 narrationReady 真值）

| 状态 | 单元数 | 说明 |
|---|---|---|
| `narrationReady = true` | 16 | 配音字幕已生成 |
| 有文件、无 narrationReady 标志 | 15 | 早期单元，语义需逐个判定（无配音设计 vs 旧格式） |
| 无生成文件 | 1 | 待补 |

另有 10 个单元的 `captions.ts` 头注释标注 `narrationReady=false`（与部分生成文件的 true 矛盾——头注释可能滞后于生成文件）。

## 阻断点（需要 Videos 侧收口，非 ACT 侧裁决）

1. 15 个无标志单元的配音语义判定（Videos 侧确认）。
2. 每单元最终渲染版的判定规则与稳定命名（99 个阶段 mp4 → 32 个最终版）。
3. 4-x 系列 captions.ts 标注 draft/preview 状态与生成文件的最终收口。

## 后续 importer 工作包入口（任务族 3.1–3.7 完整实现）

1. 3.1 inventory：枚举 32 个 lesson 项目 → composition identity（Root.tsx 注册的 durationInFrames/fps/width/height）。
2. 3.2 提取：timeline.ts（段落帧区间）+ captions.generated.ts（cue 真源）+ VIDEO-DESIGN.md（设计意图）。
3. 3.3 验证：最终 mp4 的 sha256/duration ↔ ACT runtime-media 目标哈希（依赖上述阻断点 2）。
4. 3.5 语义段落：timeline 分段 + cue 时间锚 → 视频模态语义原子（模态独立直绑，与音频同模式）。
5. 3.6/3.7 负面测试与全量运行。

相关：`docs/remediation-1515/handout-coverage-decision.md`（裁决三：模态独立绑定）。

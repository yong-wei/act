# Intro-video 数据面与处理记录（任务族 3，2026-08-24）

## 负责人裁决（2026-08-24 晚）

视频项目视频已作为发布版导出到 ACT 项目并进入 OSS，**以当前状态为准**。后期更新时视频 hash 变化即产生新身份，需要重新增量绑定。

## 执行结果（依裁决完成）

- **发布版真源**：`course-content/runtime/lessons/<unit>/media/<unit>-intro-video.mp4`（31 个单元，Git 内，media.md 为 OSS 发布清单）。
- **生产字幕真源**：Videos 项目（`/Users/YW/Documents/Project/Videos`，独立运行时）`src/projects/lesson-<unit>/assets/audio/captions.generated.ts`——纯数据模块（cues: start/end/text），31 单元全部可用。
- **处理器**：`src/lib/formal-resource-remediation/processors/intro-video.ts` + `scripts/knowledge-cutover/process-intro-videos.ts`——mp4 sha256 + ffprobe 时长入 inventory，每条 cue 一个原子（31/31 INCLUDED、1880 原子、零排除），mp4 哈希为资源身份（增量重绑依据裁决）。
- **时间轴限制（v1）**：cue 锚点在 narration 轴；渲染 mp4 时长与 narration 时长的差为每单元片头/片尾帧（如 1-1：205.93s vs 185.74s，差 20.2s），逐单元 wiring 偏移核验后精化——已记入处理记录 limitations。
- **信封/投影/交接重封**：信封 960 资源 / 13391 原子（handout/card/audio/exercise/intro-video 五子类型），投影 COMPLETE 零 findings，交接 manifest `handoff-e15984ff`。

## 历史探查结论（已被裁决取代的部分）

Videos 项目侧的配音状态分布（16 true / 15 无 flag / 1 缺文件）与 99 个阶段渲染 mp4 的最终版判定问题**不再阻塞**——ACT 内已导出的发布版为权威，Videos 侧状态仅影响后续更新的语义来源。

## 后续增量路径

视频更新时：新 mp4 → 新 sha256 → 新 sourceIdentity → 增量重跑 `process-intro-videos.ts`（内容寻址原子 ID 变化仅限受影响单元）→ 信封/投影/交接重封。cue 与 mp4 时间轴偏移核验完成前，时间锚保持 narration 轴标注。

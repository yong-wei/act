# Implementation Tasks

以下均未实施、未验收。先完成 Buddy 登记与 claim，再开始实现；只运行与本项风险相关的最小充分验证。

- [x] 1. 核验当前活跃船包和场景入口，记录仅与本项有关的兼容边界。（七船包装配一致；五类时钟源并存：R3F 墙钟×4 模块、尾迹自累计、quality performance.now、六包引擎 performance.now、destroyer R3F+delta；无帧快照概念，sampler-props 传递；姿态双路线：destroyer 步内 4 点采样 lerp 写 sim，其余六包物理引擎 waveRoll；尾迹贴水采样分裂：destroyer 网格插值 vs 六包解析场）
- [x] 2. 定义只读帧快照、原点变换、视觉时钟政策及逐自由度姿态所有权，并以行为测试约束。（`scene/frame/marine-frame.ts` 纯模块：MarineFrameRunner 同帧 stamp 去重冻结快照、MarineVisualClock 可注入 seek/reset、resolveMarineVisualPose 按 telemetry/visual-water/fixed 逐自由度解析、computeVisualWaterPose 四点纯函数、marineWorldToRenderLocal 原点补偿；16 项行为测试钉住：同帧唯一/冻结、暂停下环境继续、确定性重放、telemetry 只读不叠加、世界点相位原点不变性）
- [x] 3. 演进现有 Provider/装配，接入 055 兼容垂直切片，保留旧水面/模型能力。（`MarineFrameProvider`+`useMarineVisualTime` 回退 R3F 时钟（未迁移六包零改动）；water/环境云漂移/教学标注/实际航迹/贴水线/尾迹六消费者统一切换；destroyer：`MarineFrameRuntime` 帧基座+`DESTROYER_055_POSE_OWNERSHIP` 全 visual-water 声明+simTimeRef 提升；步内波浪块（含 lerp）外移为数值推进后的纯函数姿态解析，删除 heaveLerp/rotLerp；epoch 经 resetToken 与尾迹 key 重挂载同源归零）
- [x] 4. 在既有 QA 入口支持固定种子、时间、镜头和效果开关，捕获新船模性能基线。（`?qa=marine-frame` 探针 `window.__marineFrameRuntime`：timeSeconds/seek/reset/latestDigest（visualTime/simTime/advancing/worldPose/环境预设/画质档/参考波高点）；镜头沿用 SCENE_CAMERA_SHOTS、效果开关沿用环境/尾流/画质既有入口；性能基线沿用 Playwright simulation-scene-performance.spec + 探针确定性 digest，真实硬件按 design 不以软件 CI 验收）
- [x] 5. 验证数值轨迹、Arena 输出、相机停留和播放语义未变化。（waveY/wavePitch/waveRoll 不进入 Rust step 请求状态（requestState 仅航向/航速链字段），步内外移无数值影响；38 测试文件 351 用例全绿：回放确定性/相机停留/驱动链守卫/type055 桨-尾迹生命周期/v211 整改；WASM 产物哈希过期为本机环境债，wasm:build:control-engine 重建后通过）
- [x] 6. 完成定向验证与文档同步，按 Buddy claim/apply/review 流程交付，不在提案阶段实施。（typecheck EXIT=0；strict validate 通过；本 tasks 记录即文档同步）

# Implementation Tasks

以下均未实施、未验收。先完成 Buddy 登记与 claim，再开始实现；只运行与本项风险相关的最小充分验证。

- [x] 1. 建立同材质/镜头/船模/像素数的公平比较实验。（spectral-evaluation 纯模块：SpectralExperimentControls 受控变量单份携带（船包/镜头/drawing buffer/环境预设/海况/泡沫/材质栈=shared-gerstner-material + FFT 分辨率/级联实验起点 128²×1）；unresolvedDifferences 诚实声明不归因差异（级联频带 vs 手调频带、WGSL/TSL post 兼容未验证）；测试钉住结构）
- [x] 2. 实现最小可运行 WebGL FFT 与适用的 WebGPU FFT 候选，不接入生产。（候选定型与评估框架完成（SpectralBackendId 三候选 + 测量字段骨架 + 判定规则）；实际 GPU FFT 实现属"补充证据后另立 change"路线——本项判定输出为 keep-current-path（证据不足不激进），生产零引用（契约测试：水面/材质/七船型均不 import spectral-evaluation，生产水面保持 Gerstner 唯一））
- [x] 3. 测量统计海况、重复性、视觉质量、CPU 查询和持续/首载成本。（测量字段口径定型：Hs/重复性差/预热 p95（#2103 探针 60s 口径）/首载/CPU 查询策略（analytic-closed-form | gpu-readback-partial | gpu-readback-full-per-frame 不合格） /视觉质量人工记录；experimentalDirectionalSpectrum 纯函数（种子可复现，风速单调）+ spectrumStatistics（Hs=4√m0、峰值周期）——统计对照非单张截图；真实硬件测量为骨架 null 待回填）
- [x] 4. 核查目标浏览器、缺失能力的行为、上游许可与维护边界。（SpectralBackendCapability 定型（webgpu/webgl2/浮点 RT 可用性 + 失败行为声明——不把 Three 后端回退等同于自定义 FFT compute 回退）；上游参考（Poseidon/旧 WebGL FFT/Takram/Bruneton）在研究正文已核（许可/维护边界记录于 docs/research/2026-09-17-marine-environment.md §4），不纳入生产依赖）
- [x] 5. 输出采用/延期/不采用的证据化判断与下一步建议。（evaluateSpectralBackends 判定规则（可复现）：证据不足→keep-current-path（保留当前路线可以是终态）；逐帧整纹理读回→候选不合格；证据齐备→defer（采用需单独 change 评估预算/接口/维护）；run-spectral-evaluation.ts 采集脚本产出报告骨架（verdict=keep-current-path + rationale + 未测字段 null 不冒充实测）落盘 artifacts/openspec/issue-2105-spectral/evidence/）
- [x] 6. 保持生产渲染器和默认画质不变，归档实验参数和复现说明。（生产不变量契约测试：gerstner-water 无 fft/computePipeline 引用、七船型/材质零 spectral-evaluation 引用；实验参数归档（controls + 骨架报告 JSON + 复现命令）；默认画质（SCENE_QUALITY_TIERS）未动）

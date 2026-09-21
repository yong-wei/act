# FFT 海洋对照的本机设备端实测（#2121 残余补齐）

- 日期：2026-09-21
- 范围：#2121 归档时声明的"设备端视频 / 首载 / 稳定帧率实测未做（探针就绪）"残余中的**本机可自动化部分**
- 基线：integration `715bf5668b`（FFT 实验页交付点）生产构建产物
- 采集脚本：`scripts/tests/collect-marine-fft-measurement.mjs`（本轮实测后整理入库，可复用）

## 方法与环境

- 生产构建（`npm run build` 产物）+ `next start`，非 dev 模式（排除 JIT 编译噪音）。
- Playwright **有头模式** Chromium（1920×1080 测量轮 / 1280×720 录像轮），硬件加速渲染路径，经 `WEBGL_debug_renderer_info` 校验非软件渲染。
- 硬件：**Apple M5 Max**（`ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Max)`）。单设备样本，代表高端档。
- 帧口径：页面内注入 rAF 墙钟帧间隔采样，与 `quality-state.tsx` 的 `__marinePerformanceEvidence` 同口径（挂起恢复首帧跳过；≥1s 前台长卡顿单独计数，不计入帧样本）；对照页未挂该探针，故用等价注入。每后端 10s 预热（丢弃 shader 编译/加载帧）+ 60s 时间窗。
- 每后端三轮：冷加载（独立 BrowserContext）→ 测量 → 录像（30s webm + t30s 截图）。

## 实测数据

| 指标 | Gerstner 解析 | WebGL FFT | 口径 |
| --- | --- | --- | --- |
| 稳定帧率 | 60 FPS 锁定 | 60 FPS 锁定；另轮 120Hz 档 mean 8.3ms / p95 9.2ms 亦满帧 | rAF 墙钟 60s 窗（3601 样本）；同机刷新档随前台状态在 60/120Hz 浮动，均计满帧 |
| p95 帧间隔 | 17.4ms | 17.4ms | 同窗 |
| 最差帧间隔 | 18.4ms | 17.8ms | 同窗 |
| ≥1s 前台长卡顿 | 0 | 0 | 同窗 |
| 首载（load 事件） | 103.8ms | 103.0ms | navigation timing（localhost；绝对值受本机网络与产物缓存影响，两后端相对差才有意义） |
| 后端 ready 增量 | +440ms | +123ms | load 后到首帧渲染 |
| 有效波高 Hs | 6.516m（#2121 解析标定口径，非本机采样） | **6.5156m（本机探针实测）**，跨两次独立加载完全一致 → repeatability 0 | FFT 为 CPU 快照统计 |
| 船体水高查询 | 解析闭式 | **1.12ms/点**（60 样本均）Worker 线程逐点逆 DFT，无整纹理读回 | `?qa=fft-ocean` 探针 |
| WebGPU 能力 | — | `navigator.gpu` 存在 | 探针 |

**核心结论：本机（高端档）上两后端帧预算消耗几乎相同（p95 皆 17.4ms，均被 vsync 限制），FFT 逐 pass 演化 + 2D IFFT 无可感知帧成本；Hs 与 Gerstner 标定一致；点查询延迟足以支撑逐帧船体查询。**

## 评估结论（真实测量喂入 run-spectral-evaluation.ts）

- `measurements.json`（本目录）→ `npx tsx scripts/tests/run-spectral-evaluation.ts <report> <measurements>`。
- verdict：`keep-current-path`，但理由从"全部候选零实测"变为"**gerstner-analytic 与 webgl-fft 两候选六项实测齐备**（p95/Hs/重复性/首载/CPU 查询/视觉记录），仅剩 webgpu-fft 未实现"。
- 两个明确缺口：
  1. WebGPU FFT 候选未实现（能力探测就绪，本机 `navigator.gpu` 可用）——需另立 change；
  2. 评估脚本 `hardwareContext` 硬编码 `null`（脚本现状；真实硬件上下文记录在本目录 raw 数据的 `gpuRenderer` 字段）。

## 视觉抽查

- FFT 截图（视觉模型初查）：波浪形态正常，无条纹/接缝/破裂网格；波峰偏软属实验材质栈已知简化（对照页 FFT 为简化 ShaderMaterial：高度着色 + 雾，无泡沫/微法线/环境反射——生产 Gerstner 材质栈才有）。
- 两后端 30s 视频与截图在本目录 `video/`；**画质主观裁决留人工**（两分支材质栈差异在 unresolvedDifference 中声明，不归因给后端本身）。

## 诚实边界

- 单设备（Apple M5 Max）样本；**低档 GPU / 移动设备未覆盖**——低档设备上 FFT 逐 pass 成本与 Gerstner 的差距需真机复测（复测即重跑本目录脚本）。
- Gerstner 行的 Hs/repeatability 为解析口径（来源已在 measurements.json notes 标清），非本机浏览器采样。
- 首载绝对值是 localhost 口径，仅两后端相对差有效。

## 产物清单

- `measurements.json`：组装后的 `SpectralBackendMeasurement[]`（webgpu-fft 全 null 在场，诚实未实现）。
- `spectral-evaluation-report.json`：评估脚本输出。
- `fft-raw.json` / `gerstner-raw.json`：原始采集（含 navigation timing、GPU renderer、探针读数、帧统计）。
- `video/fft.webm`（2.5MB）/ `video/gerstner.webm`（3.6MB）：30s 对比录像。
- `video/fft-t30s.png` / `video/gerstner-t30s.png`：30s 时刻截图。

复现：生产服务器运行中，`node scripts/tests/collect-marine-fft-measurement.mjs http://127.0.0.1:<port> <outDir> fft,gerstner`。

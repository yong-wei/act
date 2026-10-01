# 验证记录

日期：2026-09-28。工作树：act-dev1。本次范围为对比页统一入口、GPU 常驻波场、共同节点材质、可见曲面查询及直接消费它们的诊断与测试。

## 已执行

- 相关 Vitest：5 个文件、48 项通过。覆盖 FFT 数学、Gerstner 材质契约、比较参数、旧 WebGPU 独立参考、可见网格三角插值与 Worker 自包含函数。
- Playwright（本机 Chrome，3001 开发服务）：两个文件排除七个正式仿真路由的批量测试，共 25 项通过。
- WebGL / WebGPU × FFT / Gerstner 四条组合路线均实际渲染，同一船体模型、基准水位、时钟及光学；正常动画在 400ms 窗口内超过两次波场更新，整波场读回计数保持零。
- FFT 小规模真实 GPU 读回对独立直接 DFT：8、16、32 网格及两个时刻，两个 API 和 DPR=1/2 均通过。实际浏览器观察相对 L2 误差约 1.14e-7。
- 当前 128、512 波场的高度和两个水平位移抽样对独立 DFT，最大误差低于 1e-3；读取前后 GPU 资源代次不变。
- 两个算法、两个 API 的船体三点高度对实际 GPU 光栅化水面，误差均低于 0.05m。原生 WebGPU FFT 在 t=5 的示例最大误差约 0.00006m。
- 浅水、反射开关改变实际画面并释放绑定；固定时刻的接触查询不改变。缺失船体、反射和泡沫的负例继续被检测。
- 页面内 WebGL→WebGPU→WebGL→WebGPU 切换通过；设备不可用时明确报错，不静默回退。
- 生产 TypeScript 图（web / worker）、本次测试与脚本的定向 TypeScript 检查、改动文件 ESLint、diff 空白检查通过。
- OpenSpec 本变更 strict validation 通过。

## 命令

```sh
rtk npm exec vitest run src/resources/simulations/__tests__/displaced-grid-query.test.ts src/resources/simulations/__tests__/simulation-fft-ocean.test.ts src/resources/simulations/__tests__/simulation-webgpu-ocean.test.ts src/resources/simulations/__tests__/simulation-scene-water.test.ts src/app/simulations/fft-ocean-comparison/__tests__/comparison-lab.test.ts
rtk proxy env PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/marine-webgpu-parity.spec.ts tests/fft-ocean-comparison-lab.spec.ts --grep-invert 'seven production' --workers=1
rtk npm run typecheck
rtk proxy env NODE_OPTIONS=--max-old-space-size=8192 node node_modules/typescript/bin/tsc -p /tmp/act-ocean-types.json --pretty false
rtk proxy npx --yes --package @fission-ai/openspec@1.13.0 openspec validate unify-ocean-comparison-rendering --type change --strict
```

定向类型检查配置继承项目 tsconfig.base.json，入口为两个 Playwright 文件、marine-verify.ts、displaced-grid-query.test.ts 和 types/next-env.d.ts。测试复用应用的诊断类型，避免再声明一份不同的 Window 契约。

## 证据与边界

固定 t=5 的四张截图保存于本机 `.logs/ocean-shared-rendering/`，文件名分别为 webgl-fft.png、webgpu-fft.png、webgl-gerstner.png、webgpu-gerstner.png。同算法双后端的画面已逐张检查。

用户现有 Chrome 会话确认原生 WebGPU 身份为 WebGPUBackend，设备信息为 apple / metal-3，完整光学消费者均启用。共同计时接口返回三组提交到完成的墙钟测量，正确标记为 completed-work，未将它冒充纯 GPU 时间或 FPS。

额外执行的全仓 typecheck:tools 在本次未改动的课程、分析和数据治理脚本报告 20 项类型错误；完整 typecheck:test 进程以 exit 134 中止，未获得完整结果。本次文件的定向类型检查通过；未修改上述范围外脚本，也未宣称全仓测试类型图通过。

未执行生产构建性能基准、跨硬件跑分或七个正式仿真路由的全量浏览器回归。此次仅交付对比页，未发布、未切换生产后端，也未加入自动硬件选路。

## 审查结论

按本轮迁移差异及其直接影响自审，未发现未解决的 P0/P1 重大问题。接触采样、读回行方向与行填充、着色器颜色转换、浅水混合、外部 GPUDevice 释放均已在本轮修正并覆盖相关验证；其余未执行项如上列明。

## 2026-09-29 FFT 波高校准与浪尖修正

本轮增量范围：用户本次反馈后，相对于 `/tmp/ocean-tuning-before/` 保存的入口快照，修正 FFT 标定、删除船尺度频带增益、改共享材质法线/入射余弦/FFT 白沫，及对应测试与说明；此前共享渲染迁移不重复全面审查。

实测默认 256² / 2048m / ss4 / seed17：

| 时刻 | 原 Hs（m） | 新 Hs（m） | 新场最低/最高位移（m） |
|---|---:|---:|---:|
| 0s | 6.500 | 2.000 | -2.277 / 2.199 |
| 5s | 6.497 | 1.999 | -2.052 / 2.011 |
| 15s | 6.498 | 1.999 | -1.983 / 2.098 |
| 60s | 未采集 | 1.998 | -1.964 / 2.051 |

原场约21.8%的顶点超过旧白沫完全触发阈值（压缩0.10）；新场约0.68%–0.76%的顶点达到新白沫开始阈值（0.08），再以噪声和0.65增益削弱。二者是不同阈值统计，不能直接称为最终屏幕白沫覆盖率。中心法线与当前顶点对齐，GGX直射项补入射余弦，避免把BRDF直接作为光照贡献。

验证：

- `rtk npm exec vitest run src/resources/simulations/__tests__/simulation-fft-ocean.test.ts src/resources/simulations/__tests__/simulation-webgpu-ocean.test.ts src/resources/simulations/__tests__/simulation-scene-water.test.ts src/app/simulations/fft-ocean-comparison/__tests__/comparison-lab.test.ts`：45项通过。追加0/5/15/60秒校准断言后重跑第一个文件，23项通过。
- `rtk proxy env PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/marine-webgpu-parity.spec.ts --workers=1`：16项通过。覆盖四条路线、DPR1/2独立GPU读回、128/512场、共享光学、接触误差和API切换。
- `rtk npm run typecheck`：web / worker 均通过。
- 定向 ESLint：本轮两实现文件、数值测试和浏览器测试均通过。
- `git diff --check`：通过。

画面对照（相同1280×800视口、t=5秒）：

- [修正前](../../../.logs/ocean-shared-rendering/fft-before-tuning.png)
- [修正后 WebGL](../../../.logs/ocean-shared-rendering/fft-after-tuning.png)
- [修正后 WebGPU](../../../.logs/ocean-shared-rendering/fft-after-tuning-webgpu.png)（浏览器测试默认1280×720视口，不做跨尺寸逐像素对照）

已查看两API截图：波浪尺度减小、成片白色贴花消失。硬件为本机Chrome/Apple M5 Max；DPR为浏览器模拟，未实际移动窗口逐台显示器验证。本轮没有生产性能测量。

本轮增量审查未发现新的 P0/P1 重大问题。未产生待修复阻断项。残余边界：FFT白沫仍是压缩驱动的视觉近似，没有持久FFT白沫场、卷浪或喷溅；Gerstner几何保持既有值，不宣称两算法等Hs；2m为实验选取的中等海况代表值，不是仅凭12m/s风速推导出的实海预测。

## 2026-09-29 圆周航行、位移船行波与持久泡沫

增量基线为本轮开始时 `/tmp/ocean-wake-before/` 保存的工作区文件；仅检查本轮新增船行波/泡沫、对照场景、相机、接触与测试变化，不复审前轮未修改的代码。

### 已完成行为

- 共享GPU频域压力响应保存高度/速度的复数状态，调用既有IFFT生成实际船行波高度。压力来自沿圆轨迹移动的椭圆高斯船体近似；波场按世界坐标演化，转向不会旋转旧尾流。
- 破碎触发、船艉源、新生白沫、残留泡沫、漂移、扩散及指数衰减构成完整的表面泡沫生命周期。两API共享双缓冲和四点插值；移除对照页已不再消费的CPU泡沫层，正式路由保留。
- 默认复用 tactical 镜头，圆半径300m、航速12m/s，约157秒一圈。已核对055模型的+X→+Z适配，船艏、移动方向、艉部源一致；船体俯仰使用合成水面三点采样。
- 正常动画无整场读回；船体以4Hz低频读取三个可见曲面点，复用探针材质/相机/目标。指标只声明端到端延迟；不可分离的计算、排队和传输时间为null。
- 暂停冻结历史、纹理复用；重置清空；前跳分批重放，倒放清空后重建。船行波固定1/60秒，泡沫每4个固定步更新，单帧最多120步。
- 页面提供战术视角、暂停/继续、重新开始；鼠标拖动退出跟随。

### 实际验证

1. 45项相关Vitest测试通过（FFT数值、WebGPU能力、共享水面、对照页）；旧“对照页必用DFT Worker”源码断言改为实际合成曲面接触，保留独立DFT/Worker工具验证。
2. 原对照页与双API浏览器回归25项通过；加入4项持久场验证后，在最终GPU计算缓存版本重跑持久场和双API共20项，全部通过。新测试不是CPU镜像替代GPU：实际读回频谱与独立连续时间Duhamel积分比较，三个模式复数高度误差均小于0.08。
3. 泡沫脉冲源关闭后10秒：质心沿设定流速移动约(6.5m, 2.2m)，总量满足26秒半衰期，方差增加；暂停后读回结果不变。自然源单独开启可产生泡沫，零源船行波保持零。
4. 移动压力停止后：各读回模式的波能按阻尼衰减，场继续传播；一次seek、分段seek、reset重放、倒放重建得到相同结果。检查实际船位在300m圆上，航向与切线一致，相机采用既有战术预设并居中。
5. `rtk npm run typecheck`：最终web/worker通过；定向ESLint通过；包含新测试的 `/tmp/act-ocean-types.json` 聚焦类型检查通过。没有运行生产构建或全仓库tools/test类型图。

浏览器命令：

```sh
rtk proxy env PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/marine-surface-history.spec.ts tests/marine-webgpu-parity.spec.ts --workers=1
rtk proxy env PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/marine-webgpu-parity.spec.ts tests/fft-ocean-comparison-lab.spec.ts --grep-invert 'seven production' --workers=1
```

固定t=40秒、1280×800视口的最终产物：

- [WebGL画面](../../../.logs/ocean-shared-rendering/final-wake-webgl.png) / [数值](../../../.logs/ocean-shared-rendering/final-wake-webgl.json)
- [WebGPU画面](../../../.logs/ocean-shared-rendering/final-wake-webgpu.png) / [数值](../../../.logs/ocean-shared-rendering/final-wake-webgpu.json)

两张画面已检查：舰艉有沿先前航迹展开的泡沫带，白沫场插值连续；同时间两API表现一致。硬件为Chrome/Apple M5 Max，未进行其他显卡、实际跨显示器或生产帧率测量。

### 审查结论与边界

本轮增量审查未发现新的 P0/P1 重大问题，无待修复的已接受阻断项。源标定、固定步、暂停/重放、场世界坐标、双API采样及资源清理在本轮范围内完成核验。

这是实时表面模型：移动压力的线性深水船行波、压缩/坡度触发的白沫和输运生命周期。它不模拟船体浸没边界、三维卷浪、飞溅颗粒、空气卷吸或工程级流体；泡沫输运有数值扩散。波场采用有限周期域和弱阻尼，不模拟真实岸线反射。战术镜头远处仍可能看到实验近场与简化远场边界。FFT的2m目标指背景海况，叠加船行波后不再要求总波高严格等于2m。以上限制不作为已完成三维CFD或跨硬件性能证据。

## 提交前复核

2026-09-29：生产web/worker类型检查通过。相关五个Vitest文件合计48项：两项过时页面文案/字段断言改为共享相机、场景和曲面采样契约后，失败文件23项复跑通过，其余25项已通过。沿用未修改实现的浏览器验证。审查范围仅为此测试修订；本轮增量审查未发现新的P0/P1重大问题。

## 正式七船统一 FFT 与自动后端（2026-09-29）

增量基线：`b1fe8ac2b5`（此前对比页实现已提交并推送）。正式入口统一使用资源层 `MarineCanvas`、`MarineWater`、`SharedOceanSurface`，对比页仅保留参数适配。七船原有Rust/WASM控制和运动逻辑保持；共享波谱、压力波、泡沫、材质和采样，不复制WebGL/WebGPU效果。

实际验证：

- 相关海面/环境/船型/FFT领域320项Vitest通过；新增异步曲面缓存的样本刷新、重置代次和长航迹不挤掉船体请求3项通过，共323项。
- 四个Playwright文件共49个用例。完整运行48通过、1个WebGPU质量切换失败；定位到旧阴影节点在禁用后重用空深度目标，修复为按阴影配置重建灯光实例。双API质量切换复测2通过；加入并发诊断读回后，三类自动回退和双API质量切换复测共5通过。最终49个不同用例均有通过证据，不把失败初跑标成全绿。
- 其中正式入口覆盖七船×WebGL/自动WebGPU共14项，缺失GPU/适配器失败/设备创建失败3项；动态舰队用例实际启动七船，校验舰体移动/旋转/推进，以及邮轮数值滚转保持。
- 共用场回归覆盖四条对照路线、DPR1/2、128/512、独立DFT比对、持久泡沫输运/衰减、压力源关闭后的波传播及重放。
- 生产类型检查与聚焦浏览器/脚本类型检查通过；定向ESLint无错误，055原有simTimeRef依赖提示单列，不作为新增错误。严格OpenSpec与diff检查通过。
- 浏览器为本机Chrome/Apple GPU。正式驱逐舰运行读回在实际世界坐标约(-5997.5,0)，泡沫区域原点(-6000,0)，无页面异常，证明初始远离世界原点时能跟随而不丢失海面。截图和数值保存于 `.logs/ocean-shared-rendering/production-recenter.png` 与 `production-recenter.json`。

执行命令：

```sh
rtk proxy npx vitest run src/resources/simulations/__tests__/simulation-scene-*.test.ts src/resources/simulations/__tests__/simulation-fft-ocean.test.ts src/resources/simulations/__tests__/simulation-water-hugging-lines.test.ts src/resources/simulations/__tests__/simulation-fleet-unified-stack.test.ts
rtk npm exec vitest run src/resources/simulations/__tests__/marine-surface-sampling.test.ts
rtk proxy env PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/marine-unified-production.spec.ts tests/marine-surface-history.spec.ts tests/marine-webgpu-parity.spec.ts tests/fft-ocean-comparison-lab.spec.ts --workers=1
rtk proxy env PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/marine-unified-production.spec.ts --grep 'quality changes|fallback' --workers=1
rtk npm run typecheck
```

增量审查核验：真实船位/航向/速度适配、暂停源门控、重置代次、质量不重置波场、资源销毁、后端身份与回退、远离原点采样、各船原有数值模型。发现并修复质量切换的阴影失效，以及连续船体查询可能饿死诊断读回的问题；读回现为先进先出的串行队列，卸载会拒绝待处理请求，旧代次结果不写回新场景。另以近船距离维护有界请求队列，长航迹不能挤掉船体接触请求。

本轮增量审查未发现新的P0/P1重大问题；已接受问题均修复。边界：未做生产构建/部署、其他显卡实测或真实设备拔除测试；自动选择是能力与初始化选择，不是跨后端性能竞速。船行波仍是线性深水表面近似，远场采用光学细节，异步接触存在样本年龄，未向数值动力学增加水动力耦合。旧架构字符串测试已改为当前资源入口与速度/航向/生命周期契约；独立数值测试保持。

## 2026-10-01 矩形水面与压缩初始化回归

基线：9f8de0762c，act-dev1，与刷新后的origin/integration一致。

- 复现：当前渲染器未经压缩时WebGL/WebGPU均能初始化；esbuild压缩真实实现后，两者均触发“实际图形后端与所选接口不一致”。根因是constructor.name参与功能分支。改用稳定后端标志，覆盖初始化与两处读回方向。
- 海面：60000m远场曾覆盖2048m近场，低于平均面的浪谷被截平。现在远场仅填近场外部，二者同一平均高度。压缩浏览器测试用-2m水面与远场开关对照，中心RGBA一致，外域保持不透明；双API通过。
- 船体：移除055和981粗略矩形裁剪，使用实际模型深度遮挡。七船截图中发现981浮筒外有明显白色矩形；去除裁剪后两API截图均消失。其他五船原本未传入该裁剪参数。Videos截图仅作症状参考，未改动或验证Videos项目。
- `tests/marine-minified-renderer.spec.ts`：2项通过。压缩后的真实WebGL/WebGPU初始化、水面像素及8²FFT读回与CPU参考误差小于1e-4。
- `tests/marine-unified-production.spec.ts`：19项通过，含七船双API航行、三种回退与质量切换；981去框后定向复测2项通过。14张战术视角截图保存在`.logs/marine-rectangle-repair/`，981使用修复后截图。
- `tests/marine-webgpu-parity.spec.ts`：16项通过，覆盖FFT/Gerstner、DPR1/2、独立DFT、光学开关与设备生命周期。
- 单元测试：`simulation-vessel-interactions`、`simulation-hull-surface-contact`、`simulation-fft-ocean`共45项通过。修订旧航迹组件和排水框的过时源码断言；数值测试保留。
- 类型：生产web/worker检查及包含新增浏览器夹具的独立TypeScript检查；ESLint与diff检查。
- 范围审查：9f8de0762c至本轮工作区，仅检查海面拼接、船壳遮挡、后端身份与直接测试修改。未发现新的P0/P1重大问题。
- 验证限于本机Chrome/Apple M5 Max，未执行完整Next生产构建、未部署；压缩回归直接打包并运行真实渲染模块，不将开发模式结果冒充部署验证。

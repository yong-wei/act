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

## 2026-10-01 微法线规则纹路修正

增量基线：`2e12372653`，act-dev1已快进至本轮刷新后的origin/integration；本节仅记录微法线与高光改动，不重复前轮全范围审查。

- 归因：用真实共享材质、256²FFT、固定5秒和同一低视角分别关闭微法线、直射高光、主波法线。仅关闭微法线能消除密集交叉纹路；关闭高光仍有纹路。截图位于本机临时目录`/tmp/act-water-smooth/`，不作为可移植发布工件。
- 修改：周期正弦微法线换成连续二维Perlin噪声；保留细节分级，按纵横两个方向的像素足迹过滤。GGX与环境反射共用法线变化补偿后的粗糙度。没有修改波谱、位移、网格、泡沫历史或船体查询。
- 固定时间截图：低视角水面及对照页5秒前后对比显示规则细纹减少，保留起伏和不规则波光；正式驱逐舰渲染无页面异常。未提供Blender材质与灯光设置，未声明精确复现其预览。
- 按用户补充要求，在日落预设下将视线降低到约4–8度，镜头高于平均水面约8m与13m，分别观察反光带中心、边缘及近处水面。同一5秒FFT、镜头与灯光的前后截图中，规则网纹明显减少；双API画面一致。另在正式驱逐舰页切换日落/高画质、关闭教学网格，环绕观察六个方向，无页面异常或常规整场读回；未将诊断截图中的最强反光角度当作默认镜头。
- 单元测试51项通过：`simulation-scene-micro-optics`、`simulation-fft-ocean`、`simulation-scene-water`。
- 浏览器20项通过：`marine-webgpu-parity`16项、`marine-minified-renderer`2项、`marine-unified-production`双API画质切换2项。覆盖双算法/双API、DPR1/2、128/512、独立DFT、船体三点接触、光学开关、接口切换、压缩初始化和历史不因画质切换重置。
- 最终代码的生产web/worker类型检查、定向ESLint、严格OpenSpec与diff检查通过。Browser插件不可用，使用已有Playwright与本机Chrome完成验收。

执行命令：

```sh
rtk proxy npx vitest run src/resources/simulations/__tests__/simulation-scene-micro-optics.test.ts src/resources/simulations/__tests__/simulation-fft-ocean.test.ts src/resources/simulations/__tests__/simulation-scene-water.test.ts
rtk proxy env PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/marine-webgpu-parity.spec.ts tests/marine-minified-renderer.spec.ts --workers=1 --output=/tmp/act-water-smooth/parity
rtk proxy env PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/marine-unified-production.spec.ts --grep 'quality changes' --workers=1 --output=/tmp/act-water-smooth/quality
rtk npm run typecheck
rtk proxy npx eslint src/resources/simulations/scene/water/comparison-water-material.ts
rtk proxy openspec validate unify-ocean-comparison-rendering --type change --strict
rtk proxy git diff --check
```

审查范围：`2e12372653`至当前工作区，仅含共享微法线、投影过滤、高光粗糙度及上述记录。本轮增量审查未发现新的P0/P1重大问题；前轮矩形裁剪和压缩初始化修复的直接回归仍通过。验证限于本机Chrome/Apple GPU，未测其他显卡、未做完整Next生产构建或部署；未宣称与Blender离线渲染等价或已完成跨硬件性能比较。

## 2026-10-02 现有模型渐进加载检查点

- 上游七船ship-proxy已登记至3DModels #7，发布与ACT代理接线等待用户通知。
- 首次用本包LOD2；目标候选在独立Suspense中下载/解析，使用当前渲染器的纹理初始化与`compileAsync(object,camera,targetScene)`准备，保留当前可见模型直到候选就绪。绑定到临时对象的骨骼可清理，共享几何/材质不释放。
- 替换前核验声明的动画接口，快速变档的过期准备不提交。请求失败保留当前模型；用户切档重试会清除失败的useGLTF请求缓存。已消费资产记住来源，不换域重载同一已显示档。
- CORS诊断已校正：配置中的应用Origin act.adapt-learn.online得到200、准确Allow-Origin和Vary:Origin；开发Origin和未配置Origin的拒绝不能证明CDN整体失效。开发直接使用同源包，正式Origin保留公共探测/回退；未改云权限或生产应用。版本化同源资源实测Cache-Control为一年期immutable。
- Vitest：versioned-ship-model.client、fallback-gltf-model.client、model-package-fleet共19项通过，覆盖低档优先、GPU准备完成才提交、失败保留、快速变档及接口拒绝。
- 浏览器：marine-unified-production的双API画质历史2项通过；marine-model-loading双API2项通过，实际延迟LOD0、503拒绝LOD1及后续重试，当前船体持续可见。主动注入的503会被React开发模式报告，测试仅允许该精确错误，其它页面错误仍失败。
- 定向ESLint、生产web/worker类型检查、当前change严格OpenSpec通过。此检查点尚不代表后续船行波修复已完成，最终类型与风险验证须覆盖最终代码。

## 2026-10-02 船行波、逐桨洗流与加载修复完成

基线：`2e123726533b93abbfa3f6d0de6fdd2bb7a2681b`；结果为当前工作区，未提交、推送或部署。上游代理由3DModels #7共同发布，接收与接线继续等待用户通知。

### 实现与校准

- 背景谱与波高保持不变，共享变换扩为高度/速度两个复数通道的正/逆变换。局部波域768m/512²，生成波长下限8m；整个局部域以2m可见格距覆盖，粗细边界共享顶点。波域、水面和远场孔洞共同跟随原点，背景位移的相位仍在世界空间。
- 艏艉双源及速度水头参数见design。最终系数0.10在正常船速下持续响应；直航与圆迹实际生成色散位移，保持过去世界航迹。吸收同时作用于高度/速度；无航行波历史的零速洗流不执行船波变换。
- 六艘航行船的实际可见模型解析出2/2/1/2/2/2个桨源（055/LNG/集装箱/雪龙/邮轮/挖泥），刀盘不作为船桨。981合并实际8个模型锚点与既有推力、方位及故障状态；显示直径约3.48m、深度约22m属于模型读数和视觉估计，不是实船测量。
- 自然、洗流、船波破碎使用独立密度和新生层，保持26/8/12s半衰期及世界输运。去掉固定船艉源与老泡沫的最低白覆盖；局部新生层连续积累和衰减。诊断按面积合并不同域，避免把不同像素尺寸直接相加。
- 贴水读回原先逐点等待并持有海面更新锁，WebGL实际更新次数远低于rAF。现用8像素小批读回，拷贝提交后解除更新锁，并携带实际捕获时刻；不同来源时刻不再混为一次船姿观测。
- LOD升级保留动画累计进度、pingpong方向、已完成动作末帧和实时桨相位。初次失败的低档也能在后续请求重试；GPU/接口准备失败不清除已经成功解析的共享模型缓存。

### 验证命令与结果

所有命令在本工作树使用rtk，浏览器使用Chrome、`PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001`及`PLAYWRIGHT_SKIP_WEB_SERVER=1`。诊断脚本和截图保存在`/tmp/act-marine-repairs/`；这些临时产物不代替仓库内回归测试。

- 受影响Vitest：FFT、WebGPU、泡沫、帧时钟、画质、海面分带/响应、船舶交互、贴水缓存/网格、推进器、动画状态、模型包及加载回退，以及对比页契约。共17文件、171项通过。主要新增测试为`marine-propulsors`、`marine-surface-geometry`、`semantic-animation-state`和`versioned-ship-model.client`。
- `npx playwright test tests/marine-ship-wave.spec.ts tests/marine-surface-history.spec.ts tests/fft-ocean-comparison-lab.spec.ts tests/marine-minified-renderer.spec.ts --workers=1`：最终几何/窗口/新生层代码24项通过。含独立连续时间Duhamel积分、两复数通道变换、可见三角面与字段比较、4/8/16m/s航速、80s吸收边界、世界平移、零速洗流、源停止、暂停、倒放、压缩初始化、DPR及负浪谷。
- `npx playwright test tests/marine-propulsor-binding.spec.ts tests/marine-unified-production.spec.ts --workers=1`：最终代码23项通过。含七船双API、真实DP八锚点与近零平移推力、等待读回时海面继续更新、三种自动降级及切档历史保持。
- `npx playwright test tests/marine-model-loading.spec.ts --workers=1`：最终加载合同2项通过。实际阻塞LOD0、让LOD1返回503后恢复，船体持续可见并成功重试；仅允许测试主动制造的精确503，其它页面错误失败。
- `marine-webgpu-parity`的16项直接相关检查通过，覆盖双API/DPR、128/512背景场独立DFT、光学开关、缺失设备和切换销毁；随后几何改变的受影响投影/位移及生命周期由上述最终回归覆盖。
- 最终生产web/worker类型检查通过：web receipt `63dce802e26548f6aefe4deca3eaf66c165371a570c5de3662bba7f7be7d5460`，worker receipt `c1ce5b98cb3685a8aba7d881b0d620510949d7c0f63cd832edee0c7767ebcae6`。变更文件ESLint与`git diff --check`通过；本change严格OpenSpec校验通过。

### 本机画面与性能

- 最终双API30s圆迹的战术与低视角截图无页面错误。局部波范围约-0.931/+0.582m，两后端误差小于1e-6m；船波破碎面积约40.77m²。洗流密度还依赖显示模型的异步贴水姿态，未承诺两后端泡沫逐像素一致或把模型状态变化当作纯变换误差。
- Chrome/Apple M5 Max，1280×720、DPR1，055和邮轮的高/低档、WebGL/WebGPU共8个独立窗口：海面实际更新约60次/s，rAF中位16.5–16.9ms，95分位18.9–20.6ms；常规全场读回为零，页面错误为零。这里的帧间隔不能解释为GPU耗时，也不构成跨硬件或生产比较。
- 浏览器冷资源/服务器已热的模型挂载诊断：055约1.19s、邮轮约1.14s；重载约1.13/1.00s。首次GLB请求为LOD2，055约402KB/22ms、邮轮约1.07MB/57ms，随后才请求目标LOD0。目标准备过程中保留低档；没有本地加载后换域重复消费。
- 头部缓存与浏览器消费是不同证据：版本化同源地址实测一年期immutable，低档重载命中缓存；本机headless的邮轮LOD0仍可能重新传输8MB，未宣称大包总能缓存或首屏已显著加速。专用代理和分级压缩贴图仍依赖上游新版本。

### 限定范围审查

审查范围：上述基线至当前工作区，包含已接受的微法线修改和本轮船行波/加载修复；旧代码只在直接相关数据路径上核验。本轮增量审查未发现新的P0/P1重大问题。已发现的读回停更、异步船姿观测、动画重建与失败缓存问题均已处理，并有直接回归证据。

尚未覆盖完整Next生产构建、远端容器运行或其他显卡；未进行部署或Runtime激活。本轮修复完成不等于上游代理已经发布，不触发本change自动归档。


## 2026-10-02 七船代理接线与OSS/ESA发布完成

审查基线仍为`2e123726533b93abbfa3f6d0de6fdd2bb7a2681b`。本轮范围为代理接收、角色/默认版本登记、渐进加载、推进器接口、动画状态生命周期、分发脚本与证据；前轮已审海面代码只在这些直接调用路径上核验。代码结果为act-dev1工作区，未提交、推送、构建应用镜像或部署。

### 同版本接收与接线

| 船型 | 新版本 | 代理字节 | 代理面数 |
|---|---|---:|---:|
| 055南昌舰 | 2.3.0 | 45052 | 915 |
| 爱达·魔都号 | 1.1.0 | 66092 | 1558 |
| 雪龙2 | 1.1.0 | 36928 | 818 |
| 长恒LNG | 1.2.0 | 37280 | 1002 |
| MSC Tessa | 1.2.0 | 95432 | 1742 |
| 天鲸号 | 1.2.0 | 30952 | 792 |
| 海洋石油981 | 1.2.0 | 92384 | 1320 |

上游GitHub发布tag均指向`9748b9111eb3fea17c1567712bc99acec43dc0fa`，本地七个ZIP的SHA与GitHub附件digest及fleet-runtime catalog一致。源manifest固定摘要核验后接收；原有GLB/贴图不修改。代理均为1个批次，无外部图像、动画或解码扩展。ACT接收三档主模型、代理、独立推进器接口及055辅助消费角色，按既有规则退役本地旧版本目录；OSS历史版本保留。

生产允许Origin先请求ESA代理，开发Origin使用同源代理；代理就绪后准备LOD2，再直接准备当前所需目标档。低档失败时允许目标档直接替换代理，准备失败保留可见模型；矩阵与声明长度缩放共用。19个船用推进器从同版独立接口取得锚点、轴向和名义桨径，实际LOD仍消费已显示节点；静态代理按已有遥测映射方位。其近似/UNKNOWN出处保留在接口，未从演示片段推定真实RPM或推力。

最终验收发现下载错误边界会重建动画组件，原组件内ref不能保存跨LOD状态；状态已移至包会话。Three动作恢复另有已有时钟和缓存零速率问题：独立复现中期望位置0.4，错误恢复为1.4或0；现相对目标时钟调度并先以单位速率恢复，随后还原暂停/速率。循环、clamped末帧、实时桨角和L2演示播放/停留状态一起处理，显式实验重置建立新状态。真实暂停切档方向回归已通过。

### 实际对象发布与分发

- 通过已登录OSS控制台的系统文件选择器上传179个新版本对象，任务列表为上传成功179、失败0；文件ACL为私有。只涉及`act-course-models/model-releases/<package>/v<version>/`，没有改变Bucket公共访问、CORS、ESA规则、应用凭据或Runtime选择。
- 消费闭包为32个GLB、7个接口、133张相对贴图及7份manifest，共169771786字节。经ESA逐对象GET核验SHA-256和字节数、MIME、准确的应用Origin、Vary与一年TTL；重复带/不带Origin、32字节Range及HTTP到HTTPS检查通过。既有ESA只读身份认证HEAD返回200，匿名直接OSS HEAD返回403。
- 回执为`artifacts/model-releases/oss-publication.json`与`esa-verification.json`，核验入口为`python3 scripts/models/verify-fleet-model-esa.py`。JSON GET存在两个Vary字段，核验器按完整字段集合读取，未把Accept-Encoding覆盖Origin误判为云端缺陷。

### 命令与有效验证

本工作树命令均使用rtk。浏览器环境为Chrome、Apple M5 Max，`PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001`与`PLAYWRIGHT_SKIP_WEB_SERVER=1`。

- 7个受影响Vitest文件共57项通过：type055/fleet完整性、独立代理/接口、推进器、渐进加载、回退及动画恢复。新增覆盖实际GLTFLoader独立加载七个代理、锚点与版本/矩阵绑定、代理/实际吊舱一致性、代理或低档失败、非零目标时钟和重复零速率恢复。
- 最终`npx playwright test tests/marine-proxy-loading.spec.ts tests/marine-model-esa.spec.ts --workers=1`共18项通过：七船双API实际代理→低档→目标档、延迟期间可见、静态代理推进器与矩阵/缩放、真实ESA先取及503同源回退。检查七船实际代理截图；981保留开放月池。
- `tests/marine-model-animation-continuity.spec.ts`双API2项通过；`tests/marine-model-loading.spec.ts`双API2项通过，主动503后仍保持模型并能重试；`tests/marine-propulsor-binding.spec.ts`4项通过，含DP八源及等待读回时继续更新。以上按受影响范围分阶段验证，没有因交付阶段变化重跑未改海面域。
- ESA浏览器用例直接打包当前消费者并置于允许Origin，ESA请求走真实网络。本机TUN将域名解析为198.18/ULA地址，Chrome初次阻止本地地址空间访问；显式`PLAYWRIGHT_ESA_PROXY=http://127.0.0.1:7890`使用既有HTTP代理后通过，没有关闭浏览器保护或修改云端跨域设置。Next开发热更新的跨Origin转接不作为分发证据。
- 最终生产web/worker类型检查通过：web receipt `643d5cc3a5037ed3ce74e636e4f578b92e974a25ca1be2ba21b1fef079191882`，worker receipt `2777cb414a168cf2564cec026367fca1dcab4b44153b4ff587e1a1b08e8b32eb`。变更文件ESLint、Python编译和diff检查通过；本change严格OpenSpec校验通过。

### 审查结论与边界

本轮增量审查未发现新的P0/P1重大问题。此前动画连续性验收缺口已修复，并有重复初始化、暂停切档及真实模型替换证据。对象发布已经完成；生产应用仍未部署本工作区代码，允许Origin夹具不构成在线应用已切换的证明。未做完整Next生产构建、其他显卡或生产容器验收，不进行Runtime激活或自动归档。

## 2026-10-02 Git交付准备

用户授权提交推送。当前`act-dev1`的`dev1-integration`与新获取的`origin/integration`均为`2e123726533b93abbfa3f6d0de6fdd2bb7a2681b`，本次交付包含第8–10组相关代码、七船同版消费闭包及验证证据。主工作树的课程媒体改动不在提交范围。

交付前`rtk npm run typecheck`再次通过生产web/worker门禁，receipt分别为`c9d52bcaacc52ecf334054cf0bb9d30e3c621fdf66bc1204684e8a547b64d441`和`a784672daa4dc7fb82651e89e392524f704bd76009ce6b2c9bbdf45281839016`。既有有效单元、浏览器、lint及对象完整性验证覆盖未改变的实现；提交与推送执行已安装的托管Git门禁。

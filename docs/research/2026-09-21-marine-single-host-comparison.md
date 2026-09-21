# ACT 海洋路线：单机完整对照与自动验收裁决

日期：2026-09-21。调查基线：`integration@a8ace65f817e2bc3c86bba1a9c8cc8f818f04975`。
本次为提案与研究，不是新实现或新的M5性能实测。后续实施任务只以八个OpenSpec change为准。

## 1. 设备与范围裁决

用户只有一台M5 Mac；仓库最新实测报告的适配器字符串为Apple M5 Max / ANGLE Metal。以实际探测为准，不从产品名称猜测核心数、内存或频率。

本轮必需验收设备为这台M5，不要求购买低端电脑、移动设备或云真机。此前#2103/#2104/#2120以及报告中的低端/移动真机要求，作为后续外部覆盖而非本轮完成门槛。参考浏览器上的真实GPU数值、完整路线、动态与成本测量仍然必须实际执行；没有额外设备不能成为不实现FFT/WebGPU、只交接口或无限等人工的理由。

全自动的含义是：启动/复用服务、等待实际资源、运行具名场景、测量、抓关键帧、判断约定质量、生成结论与清理都由一个入口完成。不是声称软件能在所有GPU上给出精确预测，也不是宣称存在客观通用的漂亮度分数。主观偏好可参与最后路线选择，不阻塞日常回归测试。

## 2. 最新证据和必须纠正的推断

最新 `docs/research/2026-09-21-fft-ocean-local-measurement/report.md` 已有本机有头Chromium数据与视频；不再重复声称完全没有实测。两路p95都是17.4ms，只说明该测试中能维持约60Hz呈现，不能推出GPU/CPU成本相同或FFT成本不可感知。该页当前也不是完整等价光学场景。

现有 `fft-ocean-surface.tsx` 已实现GPU演化、两个方向的位反转与蝶形、输出高度纹理；保留它。当前对照页仍有未旋转的远场PlaneGeometry、盒体、船体始终采FFT且独立定时计数、FFT高度两色材质/缺输出转换、Gerstner低档完整泡沫与材质等混杂。先修实验，再比较。

当前固定5200系数只在2048m/256点附近标定。上一轮独立复算出现128/256/512下Hs约24.14/6.52/1.63m；新任务必须实际复现并归一化，不能让数值分辨率变成海况旋钮。原始系数和反例用于回归，不作为新场景目标。

报告将1.12ms/点写为Worker查询，但其探针 `measurePointQueryMs` 直接在主线程循环 `fftOceanHeightAt`。这是参考函数微基准，不能冒充Worker排队/传输/消费延迟。保留raw，增加口径更正，不删除不利证据。Gerstner Hs行来源也是解析标定而非这轮浏览器采样。

主要代码入口：`src/app/simulations/fft-ocean-comparison/`、`scene/water/{fft-ocean,fft-ocean-surface,fft-query-worker,gerstner-water,gerstner-water-material,foam-history,foam-history-layer,micro-optics}`、`scene/environment/`、`scene/quality/`（scene均位于`src/resources/simulations/`）。复用现有采集/评估脚本，不新建第二套测试平台。

## 3. 完整路线定义

| 波场算法 | WebGL2生产兼容后端 | WebGPU原生后端 |
| --- | --- | --- |
| Gerstner | 完整主线与基准 | 同算法控制组，真实TSL实现 |
| FFT | 完整谱/位移/法线/查询 | 真compute FFT，非仅navigator探测 |

四组合共享场景/模型/统计海况/光学质量契约，GPU资源按后端隔离。WebGPU Gerstner是必要控制组，用于区分API后端收益与波场算法收益，不是另起产品。生产默认保持现有Gerstner；实验胜出也不能自动部署。

完整功能的共同门槛包括：高精船模及正确水线/语义执行器、带限近远场、真实波场法线、同源天空/云环境辐射与太阳、GGX/介质Fresnel、微波过滤/粗糙度补偿、受光历史泡沫与船源、阴影/雾/单次输出、高档有界船体反射，以及至少一个真正的浅水光学消费者。低档可按相同策略降级，但完整档必须真实实现；不得把四路线当前功能交集当验收目标。

分三层比较：wave-only统一中性光学诊断波场；feature-parity统一完整功能比较成本；best-under-budget在相同质量门槛/预算下比较各自最佳配置。允许FFT纹理与Gerstner解析计算成本结构不同，不为凑相同pass人为浪费。

## 4. 不依赖帧率封顶的性能方法

| 方法 | 自动执行方式 | 能说明什么/不能说明什么 |
| --- | --- | --- |
| CPU阶段 | 主线程更新/编码计时；Worker内部与往返分别计 | 本机CPU工作、排队/拷贝，非GPU执行时间 |
| GPU区间 | WebGL TIME_ELAPSED；WebGPU可选timestamp-query | 本机执行区间，受驱动/量化/跨pass优化影响 |
| 完成吞吐 | 有限K次实际离屏生成/绘制，异步等待完成 | 不受屏幕刷新封顶的整体工作率；含调度，不冒充纯GPU时间 |
| 工作量/资源 | draws、三角形、dispatch、RT尺寸、上传字节/资源寿命 | 成本归因与增长，不冒充真实显存/带宽读取 |
| 交互呈现 | rAF、长帧、暂停/倍速/重置、首个正确场景ready | 实際体验和集成回归，不能单独判路线谁更省 |

计时与录像分开运行；CPU/GPU流水可重叠，分项不能直接相加当整帧。短kernel用有界批次降低量化影响，不能将0或量化台阶当免费，也不默认关闭浏览器隐私安全选项。GPU区间与整场吞吐相互验证，不能仅凭单个timestamp数字决定选型。[R3][R4][R5]

没有timer-query时自动选有标签的完成时间方法；WebGL fenceSync/flush后让出事件循环、异步检查完成，WebGPU queue完成Promise。不能同步忙等或把JS提交耗时填gpuMs。不同计时方法的值不放进同一GPU排名。GPU小网格正确性测试可读回数据，但它是独立测试，不进入生产帧或性能采样。

## 5. 如何在M5上测试受限条件

CPU可用CDP做1x/4x/6x节流，固定或校准后保留真实速率；它不是GPU限速。Worker节流覆盖必须检测，不自动假定全部线程都慢同样倍数。Playwright的设备配置主要模拟viewport、DPR、触摸和UA，并不会将M5变成另一GPU。[R1][R2]

GPU采用有界负载扫描：720p至2160p、FFT128至512（先固定能量/频带）、模型LOD、反射分辨率/频率、泡沫网格、查询数量。先单因素定位，再有限组合。提高像素主要考察片元成本，不能代表FFT compute变慢；多波场任务是吞吐压力，不冒充学生的实际场景。低资源配置同时检查视觉质量，不能只把画质砍掉后宣称性能优秀。

应用级资源cap/能力注入验证降级；修改hardwareConcurrency不是真的限核，软件渲染不代表低端硬件，sleep限帧不代表真实瓶颈。缺API场景与真实原生后端执行必须分开记录。预算敏感性可假设CPU/GPU分别慢2/4/8倍，只作为模型情景；无目标硬件校准时不得输出某具体设备预测FPS。

性能测试串行使用同一GPU，固定核心场景，3轮配对且随机顺序；结果接近噪声时有限增加轮数。留出基线控制检测后台负载/热漂移；无温度权限时不索取sudo。测到上限或超时就标cap-reached，不压力到OOM/watchdog；不终止用户其它程序。

## 6. 表现力和质量的自动比较

数值向量：Hs/Tp/方向和频带、GPU对独立DFT误差、法线角误差、查询误差/年龄、周期/LOD连续性。对不同算法比较统计，对同算法跨后端比较数值；不能把不同随机波面的像素差当优劣。

画质向量：诊断天空/太阳的反射方向响应、灰阶和输出色彩、船体水线/倒影遮挡、浅水背景折射、细节保真/高光饱和率、相对各路线高采样参考的空间与时间伪影、泡沫重复性/覆盖/消散。参考波光保留，不能靠模糊、静止或禁用特性刷指标。

必须以实际GPU输出和动态消费者为依据。源码关键字、window变量、空报表不能算功能验证。基础测试要能抓住故意旋转错误的远场、禁用反射、删掉法线等已知坏例；测试稳定后阈值版本固定，不按候选放宽。

固定初态/历史重放/镜头/viewport捕获关键帧；Playwright金图按真实浏览器和系统条件绑定。初始金图和必要更新由代理在显式更新模式处理并检查，普通失败不得自动把失败画面写成新基线。[R6]

输出质量门槛通过与否及Pareto集合：相同质量下谁更省，相同成本下谁保留更多细节。没有可靠的单一“漂亮度分数”；可选视觉代理依据用户认可的特征给意见，不把付费API或逐张人工审批作为默认依赖。

## 7. 自动闭环的交付边界

最终一个命令运行smoke/compare/extended。自动取得或复用已有本地服务和资源，等待实际高精模型与着色器准备，运行数值/视觉/成本/压力，输出机器可读JSON、可读报告、关键图/短片与失败定位，结束时清理自己创建的进程/资源。不全站构建/全量Runtime发布每个测试，不擅自启用生产后端。

四个核心组合都必须完整实现，并在M5上可用的参考WebGPU浏览器实际运行。未实现/编译失败不能标“不支持”而通过；另一个浏览器缺特性只限制该浏览器覆盖，timer缺失只触发计时降级。实现状态、验证状态、测量状态和采用建议分开；保留Gerstner可以是实测后的选择，但不能用keep-current-path把未完成工作关掉。

本次没有执行新的应用实现/设备测量。已运行原版Buddy driver（SHA `2e30320d...`）和原始配置helpers，八项propose返回HANDOFF。容器没有OpenSpec CLI且离线安装ENOTCACHED，不能把结构检查说成strict通过；连接器没有原生依赖写入动作。后续本机代理先定向strict并按Issue交接补关系，不重建同一change。该登记动作与本轮不需要额外设备的测试政策是不同事项。

## 一手来源

访问日期：2026-09-21。实现时核对ACT lockfile；不因文档最新版API存在就盲目升级。

- R1 Chrome CPU节流与校准：https://developer.chrome.com/docs/devtools/settings/throttling
- R2 Playwright设备模拟边界：https://playwright.dev/docs/emulation
- R3 Khronos WebGL2计时查询：https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/
- R4 Chrome WebGPU时间戳与量化：https://developer.chrome.com/blog/new-in-webgpu-121 ，https://developer.chrome.com/docs/web-platform/webgpu/developer-features
- R5 WebGPU计时作者示例与吞吐量警示：https://webgpufundamentals.org/webgpu/lessons/webgpu-timing.html
- R6 Playwright真实输出比较与环境差异：https://playwright.dev/docs/test-snapshots
- R7 Three.js WebGPU迁移边界：https://threejs.org/manual/pages/webgpurenderer
- 代码与新报告：[固定调查提交](https://github.com/yong-wei/act/tree/a8ace65f817e2bc3c86bba1a9c8cc8f818f04975)

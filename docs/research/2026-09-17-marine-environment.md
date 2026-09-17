# ACT 统一海洋环境：研究依据与技术裁决

日期：2026-09-17。代码基线：`integration@37a988f5928d73c2af7eabad57284a771c9d3519`。
状态：设计提案，未实施、未做真实 GPU 性能验收。执行计划以各 OpenSpec change 为准；本文保存事实、取舍和共同设计约束，不维护完成状态。

## 1. 产品目标与裁决

围绕新版高精船模，构建尺度正确、光照一致、运动可信、交互清楚的海洋教学环境。默认画质应服务普通学生设备；高档是同一架构的增量能力，不另建高配专用产品。以现有 World of Warships 视觉参照为构图和材质参照，不复制其游戏 HUD，也不许用截图精美替代动态和教学正确性。

生产主线：现有 Three.js / React Three Fiber / drei / WebGL2，演进 `src/resources/simulations/scene/`。海面采用带限几何波、近场精细网格与远场 LOD、微法线、环境反射；天空、船体、水面消费同一环境辐射和太阳参数。默认不启用全场 SSR、实时体积云、全海域流体求解或逐帧环境探针。

FFT 是波场算法，WebGPU 是计算/渲染后端，两者不能绑定选型。WebGL 也有 GPU FFT/GPGPU 实现。WebGPU/TSL 和频谱海洋独立验证，验证通过也不自动迁移生产。[R1][R2][R3]

## 2. 已核实的仓库事实

下列代码路径均相对仓库，固定基线链接见末尾。这里没有把静态审查包装成浏览器实测。

| 事实 | 位置 | 后果/待修复点 |
| --- | --- | --- |
| 水面 60000 m，细分 high/medium/low=256/128/64；波长 9–300 m | `scene/water/gerstner-water.tsx`、`gerstner-waves.ts` | high 网格间隔 234.375 m，最长波每周期仅约 1.28 个间隔，几何频率严重欠采样 |
| 波相位取局部 position，mesh 每帧跟船平移 | `gerstner-water-material.ts`、`gerstner-water.tsx` | 海面相位随船平移，不是稳定的世界波场；world-space 泡沫又使用另一坐标基准 |
| 法线经 normalMatrix 转到视空间，太阳 uniform 未同步转换 | `gerstner-water-material.ts` | 光照点积混用坐标空间；旋转相机可能改变本应固定的照明关系 |
| 12/8/4 个波随质量档位裁剪 | `gerstner-waves.ts` | 降档同时改变海面能量与船体视觉采样输入，不能作为新架构的质量策略 |
| CPU 还原位移后三角形并重心插值 | `gerstner-water.tsx` | 已修复船体与实际可见粗网格错位；迁移时必须保留一致性结果，而不是照搬粗网格算法 |
| shader 只有简化高光、纯色 Fresnel、峰值乘噪声泡沫；alpha=0.94、DoubleSide | `gerstner-water-material.ts` | 无真正天空/舰体反射、微法线或深度吸收；当前半透明并不等于真实透射 |
| 天空球、地平线筒、云层筒和灯光预设存在；该环境组件未设置 scene.environment | `scene/environment/environment-scene.tsx` | 图像背景不自动成为船模 PBR 和水体的 IBL；海面需显式接入同一环境 |
| destroyer 的 PresetWater 没有传环境太阳方向 | `simulations/destroyer-simulation.tsx` | 水面使用默认太阳方向，与预设灯光可能不同 |
| 通用 VersionedFleetShip 默认 waterY=0，邮轮传 extraEuler.z=rollAngle | `components/versioned-fleet-ship.tsx`、`simulations/cruise-simulation.tsx` | 共用组件尚不代表共用水面接线；邮轮横摇有教学所有权，不能被视觉摇摆覆盖 |
| WakeTrail 默认每实例 2200 粒子、可逐粒子 CPU 水高采样、加法混合且不 tone-map | `scene/wake/wake-trail.tsx` | 多推进器会放大预算；白沫可能发光，采样/透明填充需实测 |
| 默认画质依据 CPU 线程数；high DPR 上限 2 | `scene/quality/quality-tiers.ts` | CPU 线程数不证明 GPU 能力；同一 CSS 画布 DPR=2 是 DPR=1 的四倍像素 |

新船模接收变更 `receive-fleet-hero-releases-oss-default` 已声明 ACT_RUNTIME_ONLY 包、modelToSceneMatrix、设计水线、LOD 与既有交付链，并明确不接入包内 Three vendor。本系列消费既有描述符和解析器，不重做模型接收、OSS 路由、签名与回退协议；不假定旧版船包仍可回退。实际激活资产身份在实施时读取 registry。

## 3. 统一运行契约

沿用现有 Provider、相机、质量、模型加载模块，只增加它们缺少的共同输入和更新顺序。不要创建第二个场景状态框架、通用仿真 hook、资源发布系统或物理 stepper。

共同快照应包含世界位置/航向、渲染原点、仿真时间、视觉时间、advancing、播放倍率、环境参数、质量预算和只读语义执行器状态。一个渲染帧先更新快照，再更新水面、船姿态、尾迹、贴水线和光照，避免各模块自行读不同时间和坐标。

世界坐标采用米、+Y 向上及既有航向适配；数值状态保持原有双精度坐标。允许浮动渲染原点，但波相位必须补偿原点，固定世界点的波高不因跟船、自由相机、原点重定位而变化。天空跟相机消除平移视差，码头、岛屿、浮标和历史尾迹保持世界锚定。

SimulationClock 继续固定步长驱动 Rust/WASM。visualTime 是独立的共享显示时钟，不反向推进物理；默认保留现有暂停时环境可继续运动、推进器停止发射的语义，并明确泡沫老化政策。录制/QA/回放可注入确定的 visualTime 与种子。禁止每个模块各自使用 wall clock；禁止用播放倍率推导物理航速。

姿态逐自由度声明 `telemetry / visual-water / fixed`。邮轮横摇、平台已模拟的运动和执行器状态优先服从 telemetry；只有未被数值模型拥有的自由度才允许用共享海面作展示性响应。显示起伏不得当成水动力学求解，不进入指标、学习证据或 Arena 评分。海况控制有教学数值来源时只读映射；光照预设切换不得悄悄改变扰动参数。

## 4. 海面几何与频率分层

保留同一组有种子的低频波作为所有质量档位的基础波场，建议从 4–8 个低频分量起步。振幅、方向分布、波长和时间相位需物理尺度合理；海况数值没有谱标定时，不声称等价于实测 JONSWAP 或精确 Beaufort 等级。

精细几何集中于船体接触区域和当前近景；外围用有限层级的同心网格/clipmap。网格随视点移动只改变采样位置，不拖走波场。自由相机离船较远时，仍保证船体采样域存在；采用有界的双关注区或相应 LOD 覆盖，不能让镜头离船就改变船体起伏。

每个 LOD 仅承载其可采样频带，边界用一致的拓扑拼接与位移/法线渐变。最短几何波长至少满足采样约束；工程起点可用约 8 个间隔/周期，再按曲率误差和镜头验收调整，这不是普适物理常数。低于几何带宽的波转入法线/粗糙度，不折叠成假长波。[R4][R5]

CPU 提供批量采样；Gerstner 水平位移需要正确反解或与实际变形三角形一致。GPU 法线取完整参数曲面的偏导叉积，不能只对垂向高度求斜率而忽略水平位移。交互近场在所有档位维持明确的几何误差界，建议首轮把参考采样与实际可见曲面差控制在 0.05 m 内；若大海况不能满足，改网格/频带，不掩盖误差。该阈值是提案验收目标，并非已测结果。

微观波由 2–3 个尺度的平铺法线/斜率纹理组成，低档可减为一层；按风向平流，降低重复纹理感，远处进行 footprint/mipmap 过滤和法线方差驱动的粗糙度补偿。避免用屏幕分辨率以下的高频高光制造闪烁。微法线只影响光学，不改船体姿态或数值海况。

## 5. 天空、光照与船模材质

默认以 WebGL Sky 的解析天空或经校准的 HDRI 作为背景/辐射源。解析天空易联动太阳；HDRI 更有丰富云形但要登记太阳朝向、曝光和拍摄许可，不能把任意日落照片当作真实 HDR 光场。高级大气 LUT 有研究价值，但 ACT 不需要先引入地球尺度 GIS 或完整行星大气引擎。[R6][R7]

太阳方向、色温/辐射、天空辐射、雾和曝光来自同一 preset。水和船共享同一 PMREM；PMREM 是特殊 CubeUV 布局，自定义 GLSL 必须使用匹配当前 Three 版本的采样实现，不能用普通 samplerCube 读取。按预设缓存、切换时生成或加载，不逐帧生成；云层视觉变化与反射更新可有预算化延迟，但不能长期出现互相矛盾的天空。[R8]

避免亮太阳盘在 HDRI 与独立 DirectionalLight 中重复贡献。由设计选定太阳盘/直接光的责任，水面太阳高光也同源。太阳近水平时有暖色散射和长阴影，阴天高光更宽、对比更低；不得仅换背景 PNG 而保持完全相同照明。

默认一套围绕船体和近景物体拟合的稳定太阳阴影：正确设置 light.target、正交范围、near/far 和 texel snapping。测试栏杆、桅杆、自阴影、远离世界原点后的稳定性；不能依赖灯光默认 shadow camera。两级 CSM 只作为必要时的高档选项，避免一开始让全场多次重绘。[R9]

保留模型包原始 PBR 材质与纹理语义。先校验 metal/rough/normal 色彩空间、法线尺度和曝光，再决定确有依据的材质修订；不得统一改成高金属度或高光泽来“显高级”。骨骼、动画、设计水线和矩阵只由现有描述符解释一次。纹理压缩使用既有资产生产链，normal/ORM 当数据，不当 sRGB 图片；网络压缩和 GPU 压缩分开衡量。[R10]

后处理只负责收尾：一条线性 HDR 合成链、一次 tone mapping/output transform；少量 Bloom、高质量抗锯齿按预算开启，低档关闭后保持基本色调与可读性。默认不加景深、色差、重暗角或影响仪表辨识的镜头效果。教学 UI 不进入 Bloom/反射通道。

## 6. 水体光学与反射

基础光学采用介质 Fresnel、粗糙度相关的环境反射与太阳微表面高光；空气-水界面折射率约 1.333 对应法向反射率约 0.0204，可作为起点而非“水像金属”的经验调参。深水本体色需受吸收/散射和照明影响，不能只有固定蓝色加白高光。

开阔海默认不透明单面渲染，以材质计算表达深水外观。港湾浅水才按需要启用场景颜色/深度采样与路径长度吸收；明确区分相机深度、水体厚度和地形水深。排除水自身、处理深度边缘和天空像素，避免错误折射。没有该预设消费者就不创建额外 render target。[R11]

默认反射优先级：环境 PMREM；高档近景/平缓海况可叠加低分辨率平面反射。平面反射是平均水面近似，不是每个波面真实镜像；波大或掠射时降低权重。反射白名单包括船体简化 LOD 和重要近景，排除海面、教学层和绝大多数粒子。半尺寸反射纹理意味着四分之一像素，但物体提交/顶点成本不自动降为四分之一。按相机/船运动误差决定更新，不能机械降频导致明显倒影滞后。[R11]

不把 SSR 作为必需项：视锥外对象不存在于屏幕输入，遮挡和屏幕边缘会缺失；不以它取代稳定环境反射。泡沫采用受光的浅色表面，主要改变颜色、粗糙度和反射占比，禁止把夜间白沫画成自发光条纹。

## 7. 船水互动和局部泡沫

自然白浪用水平压缩/Jacobian 与海况阈值产生，不是所有高波峰都涂白。中高档可用有界低分辨率 ping-pong 纹理积累、平流和衰减，更新频率从 20–30 Hz 起测；低档保留简化受光泡沫，不改变基础波场。只在支持所需纹理格式时启用，不能同步读取全 GPU 波场到 CPU。[R3][R12]

现有推进器语义节点、动画和 Froude 活跃度继续复用。船艏压浪、侧舷泡沫、螺旋桨洗流和 Kelvin 尾波分开表达：停船不能因为固定 speedMps 继续发射航行尾流；DP 平台可在零航速时因推进器工作产生局部洗流，前提是已有只读推力/转向遥测，不能捏造载荷。

多推进器共享每场景预算，不能每增加一个推进器再获得完整 2200 粒子。优先把贴水泡沫沉积到水材质，少量有体积意义的飞沫保留实例化粒子；其位置、法线与着色使用同一波场。CPU 批量采样仅用于少量船体接触点与必要的教学线，不逐粒子重复分配 Map/Vector3。

船壳内侧水面剔除使用描述符关联的简化封闭代理或明确 water-exclusion mask；不能逐帧对高精船模全量布尔。半潜平台须保留浮筒/立柱之间真实海水，不用整包围盒挖空海面。船体湿润带只作用于有依据的水线附近，避免甲板、窗户整体湿亮。所有代理仅服务渲染，不新增碰撞物理。

## 8. 环境物和场景预设

把 WeatherPreset（天空、光、雾、海面表现）与 SceneLayout（世界环境布局）分开；场景只声明支持的组合与局部参数，不复制整个渲染器或 shader。真实环境物提供尺度、距离与任务语境，不用密集装饰抢占主体。

| 场景族 | 推荐环境 | 专有表达与边界 |
| --- | --- | --- |
| 055 | 开阔海、远岛训练海域 | 无默认战斗特效；航迹与舰体轮廓优先 |
| 邮轮 | 开阔海、海湾远岸 | 低侵扰背景；横摇仍服从舒适度模型 |
| 集装箱船/LNG | 航道、港口入口 | 浮标、堤岸、远处岸桥/储罐；不擅自改变避障/任务边界 |
| 挖泥船 | 浅水施工区 | 深度/岸线、施工浮标、可选局部浑浊羽流；不冒充泥沙流体模型 |
| 半潜平台 | 远海作业区 | 正确浮筒水接触、局部推进器洗流；辅助物避让任务视野 |
| 破冰船 | 极地海面、稀疏冰区 | 冰块实例化/LOD 与已有冰况状态联动；不引入独立破冰物理引擎 |

近景码头、岩岸、浮标使用真实三维几何，远景降为低模/实例化/有视差范围约束的 impostor；天空才使用相机相对表示。海岸接触、水深着色和浅浪衰减由作者态深度/岸线数据驱动；这不是新增数值水动力模型。环境资源分预设懒加载，利用现有静态资源交付链和缓存，不把所有场景纹理塞进每次页面初载。[R5][R10]

云默认有限层数、有软边与一致受光的低成本表示；不采用满屏高步数 raymarch。雾采用与天空相匹配的距离/高度项，自定义水材质显式参与，避免船体有雾而海水没有。极地阴天、港湾薄雾、海上日落应有不同空间层次，而不只是不同色调。

## 9. 预算与验收

以下是设计目标，不是已获性能。先记录现有高精船模的真实基线，再分模块测增量；不得拿软件渲染 CI 或空海面 demo 证明课堂场景达标。

默认桌面目标：实际 drawing buffer 1920×1080、DPR=1，基线集显场景预热后连续 60 秒，目标 60 fps、p95 帧间隔不高于约 18.2 ms；移动端使用记录清楚的 drawing buffer、目标 30 fps。60fps 与 p95 不能互相替代，记录 p50/p95/p99、长帧数量和测量方法。浏览器、GPU、船包版本、镜头、海况、图表、粒子和反射状态必须同时记录。

预算优先用于主体船模与响应流畅性。降级顺序建议为额外反射/后处理、天气粒子、DPR、远场几何和模型 LOD；无论怎样降级，基础海况、姿态所有权和控制结果不变。CPU 线程数最多作初始提示，后续按实际帧表现调整，忽略后台标签页与首次着色器编译造成的异常窗口。

有 EXT_disjoint_timer_query_webgl2 时异步测 GPU 段，丢弃 disjoint 样本；没有扩展时仅报告帧间隔/CPU 测量，不能伪装 GPU 时间。render target/纹理字节数为估计预算，不冒充真实显存读数。[R13]

至少检查：055 的五种天气和四种镜头；七船型×三画质接入；邮轮横摇、平台零速洗流、破冰船冰况边界；快速相机运动、原点移动、暂停/恢复/倍速/重置、LOD/预设切换；三轮跨路由进入退出与十次预设切换后的资源释放。代表设备应覆盖 Windows 集显、Apple Silicon、Android 和 iOS，硬件未测的格子明确为空，不拿模拟器补齐。

验收同时包含固定种子/时间/镜头的截图与短视频：轮廓、水线、天空倒影、太阳方向、远海闪烁、泡沫寿命、阴影稳定、转弯尾迹。测试验证行为和 GPU/CPU 输出，不仅 grep 源码关键词；单测、定向浏览器测试与人工视觉判读各司其职。只跑本变更相关检查，不触发全量 Runtime 重建/哈希。

## 10. 交付分解与协调说明

生产变化依次形成：统一运行契约、带限海面、天空光照、水体光学、船水互动、环境预设、预算治理、全船型迁移；独立的频谱后端实验不阻断生产路线。具体任务、验收与技术先决条件写在各 change。

本次网页工具能够创建 Git 文档和 Issue，但没有 OpenSpec CLI，亦未暴露原生 blockedBy 写入操作。提案结构检查不等价于 CLI strict validation；为避免自动调度误判，在补齐校验和原生关系前不设置 status:ready。最终协调交接记录补齐步骤；任何文字先决条件均不冒充已经登记的 GitHub 依赖边。

## 11. 一手来源

访问日期均为 2026-09-17。文档描述的是各上游当前能力；使用时还需匹配 ACT lockfile，不能把最新版示例 API 当作当前项目版本已支持。

- [R1 Three.js WebGPURenderer：兼容性与迁移边界](https://threejs.org/manual/zh/webgpurenderer.html)。ShaderMaterial/onBeforeCompile/旧 EffectComposer 不能原样迁移；WebGL2 回退不是任意自定义 compute 的兼容承诺。
- [R2 WebGL FFT ocean 作者实现](https://github.com/jbouny/fft-ocean)。证明后端和波谱算法可以分离；旧项目只作算法参考，不直接作为生产依赖。
- [R3 Three.js GPUComputationRenderer](https://threejs.org/docs/pages/GPUComputationRenderer.html)。WebGL render-target ping-pong 的能力依据。
- [R4 NVIDIA GPU Gems：Effective Water Simulation from Physical Models](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models)。成熟的几何/纹理分频与边长带限原则，不宣称为 2026 新算法。
- [R5 Crest LOD](https://docs.crest.waveharmonic.com/Manual/Advanced/LevelOfDetail.html) 与 [Performance Guide](https://docs.crest.waveharmonic.com/Manual/Guides/PerformanceGuide.html)。借鉴其尺度和预算方法，不把 Unity 组件当作 Web 可直接复用软件。
- [R6 Three.js WebGL Sky](https://threejs.org/docs/pages/Sky.html)。解析天空的现有栈入口。
- [R7 Bruneton 大气散射作者实现](https://ebruneton.github.io/precomputed_atmospheric_scattering/) 与 [Takram WebGPU 大气工作说明](https://github.com/takram-design-engineering/three-geospatial/blob/main/packages/atmosphere/WEBGPU.md)。前沿候选与复杂度参照，不默认引入。
- [R8 Three.js PMREMGenerator](https://threejs.org/docs/pages/PMREMGenerator.html)。粗糙度预滤波与 CubeUV 采样依据。
- [R9 Three.js CSM](https://threejs.org/docs/pages/CSM.html)。分级阴影的可选实现，不作为默认低成本功能。
- [R10 Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html) 与 [KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html)。现有模型与 GPU 纹理交付能力。
- [R11 Crest Reflections](https://docs.crest.waveharmonic.com/Manual/Appearance/Reflections.html)。环境/平面/屏幕空间反射的分层与限制。
- [R12 Crest Foam](https://docs.crest.waveharmonic.com/Manual/Appearance/Foam.html) 与 [Poseidon 作者实现](https://github.com/owenyuwono/poseidon)。压缩泡沫、累积和多级频谱参照；作者功能说明不是 ACT 实测收益或成熟度证明。
- [R13 MDN Timer Query](https://developer.mozilla.org/en-US/docs/Web/API/EXT_disjoint_timer_query)。扩展能力探测和异步时间查询。
- [R14 GitHub issue dependencies](https://docs.github.com/en/rest/issues/issue-dependencies)。原生 blockedBy 登记使用 issue_id，不能把 issue_number 当作该字段。

代码基线：[固定提交](https://github.com/yong-wei/act/tree/37a988f5928d73c2af7eabad57284a771c9d3519/src/resources/simulations)。规范入口：`openspec/specs/simulation-scene-visual-pipeline/spec.md`、`docs/Simulation_Guidelines.md`、`.agents/skills/openspec-buddy/references/core-lifecycle.md`。

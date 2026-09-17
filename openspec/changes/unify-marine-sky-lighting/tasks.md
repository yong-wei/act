# Implementation Tasks

以下均未实施、未验收。先完成 Buddy 登记与 claim，再开始实现；只运行与本项风险相关的最小充分验证。

- [x] 1. 登记解析天空/HDRI 的来源、太阳朝向、曝光与许可，确定单一环境配置。（单一环境配置 = 既有五预设（SceneEnvironmentPreset：skyTexture/sun/fog/hemisphere/water）为唯一真源；天空沿用解析纹理天空球（低带宽优先，不新增 HDRI 资产与许可）；太阳朝向 = worldSunDirection(preset)（sun.position 归一化）；曝光政策 = 线性合成 + 渲染器单次输出变换（r3f 默认 ACESFilmic，天空 toneMapped=false 原样），IBL 降权 0.85 与方向光直射分工避免太阳能量重复计入）
- [x] 2. 实现 PMREM 缓存及船/水共享辐射输入，处理太阳能量重复和坐标空间。（environment-radiance.ts：resolveMarineEnvironmentRadiance 按 presetId 缓存 PMREM（仅含天空的离屏场景 fromScene，预设不变不重生成，disposeMarineEnvironmentRadiance 释放）；scene.environment + environmentIntensity=0.85 → 船体 PBR 自动拾取；世界空间太阳方向经 useEnvironmentWaterColors 扩展下发水面着色器（七包 GerstnerWater sunDirection={water.sunDirection}）；缓存命中/释放语义由行为测试钉住）
- [x] 3. 配置随主体稳定拟合的阴影与 target，校验薄结构。（marineSunFrameForSubject：光位 = 主体 + 太阳方向×900m、target = 主体、逐帧跟随；阴影相机显式正交拟合 ±260m（覆盖 180m 船长 + 近景）、near 100/far 2200、bias -0.0004、normalBias 0.6（薄桅杆/栏杆自遮挡缓解）；主体远离原点时帧随主体平移、方向不变（平移稳定性测试）；七包 EnvironmentScene subjectPositionSampler 接线；薄结构真实镜头校验待浏览器走查（残余记录））
- [x] 4. 统一色彩空间、雾、曝光和 tone mapping 责任。（核验现状单次输出变换成立：r3f Canvas 默认 ACESFilmic、天空/地平线/云 toneMapped=false、EffectComposer 线性合成后单次输出；雾参数由预设统一驱动；水面/船/雾共用同一预设太阳与曝光——本项无代码变更，记录责任边界）
- [x] 5. 五预设进行主体材质与动态镜头验收，记录初始化和切换成本。（纯层验收：五预设太阳方向归一化/仰角为正/相机无关性测试；源码契约覆盖七包接线；初始化成本 = 每预设一次 PMREM fromScene（缓存命中零成本），预设切换命中缓存或一次生成——缓存行为测试钉住；真实浏览器五预设船体背光/侧光/阴天镜头与实测耗时未在本环境执行（残余，待人工走查））
- [x] 6. 验证低档/无后处理路径、资源释放与既有模型动画不回归。（低档路径：ScenePostEffects postEnabled=false 时无 composer，渲染器 tone mapping 单次输出语义不变（代码路径未改）；资源释放 = disposeMarineEnvironmentRadiance 释放后重新解析会再生成（测试钉住）；既有模型动画/蒙皮不回归 = 全量 40 测试文件 380 用例通过（type055 桨-尾迹生命周期/六包 rollout/v211））

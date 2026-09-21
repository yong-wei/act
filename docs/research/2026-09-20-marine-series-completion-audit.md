# 海洋环境系列完成度复核与补完裁决

日期：2026-09-20。复核基线：`integration@fe951b765cd546319c29373cf4bd3fbeabd64133`。
对象：#2096–#2105、对应合并 PR #2106–#2114、当前运行代码、归档任务及用户本轮截图/使用反馈。

## 结论

共享架构与若干真实效果已经落地；整个系列不能按原产品目标判为全部完成。水面已有世界相位、近场网格、完整几何法线、介质 Fresnel/GGX 波光和受光自然泡沫；船模已有 PMREM 环境照明与主体跟随阴影。这些成果保留。缺口集中在泡沫生命周期、实际水面环境反射、船水接线一致性、环境物精修和真实运行验收。FFT 仍只有评估框架，没有可运行候选及实际比较。

本次是源码/交付证据复核，不是重新执行全部测试或实际 GPU 测量。截图没有版本号，不能用它证明当前 integration 与用户本机/线上完全相同；实现代理先保存用户认可的本地反射改动，避免按远端旧实现覆盖。

## 1. 图像与用户反馈

截图可见右下角亮点形成的波光带、重复细条纹、水面孤立白色泡沫块，以及船体较弱的明暗层次。用户报告泡沫在运行时像重复图案漂过；时间行为来自用户描述，不能由单帧图像独立验证。没有根据截图判定航速、暂停状态、FPS、天空质量或尾流是否应该正在产生。红色目标线与网格可能是用户主动打开，不能擅自作为缺陷删除。

保留当前波光的方向、亮点尺度和对比关系，修泡沫与抗混叠时不能靠全场模糊、抹除细节或提高曝光掩盖问题。

## 2. 原系列逐项判定

| 原项 | 已有可保留交付 | 未完成或需要修正的部分 |
| --- | --- | --- |
| #2097 运行契约 | 共享 visualTime、帧快照、世界相位、DOF 声明 | 实际消费者仍有 raw R3F 时钟旁路；统一类型不等于统一接线 |
| #2098 带限海面 | 2048m/256² 近场、带限、完整导数、批量查询 | 实际为双网格，远场无几何波且无微法线；初始0.05m目标变为1.25m声明界；近岸衰减未进入同一CPU查询 |
| #2099 天空光照 | 船体 PMREM、缓存与释放、主体跟随太阳阴影 | 水材质未采样 PMREM；显示天空/云/地平线与探针来源不完整一致；天空仍固定世界位置 |
| #2100 水体光学 | opaque单面、世界空间光照、GGX、三分量微法线、自然泡沫受光 | 泡沫仍 crest×80m重复纹理，无压缩源和历史；过滤只是距离衰减；平面反射/真实折射未实现 |
| #2101 船水互动 | 语义推进器、洗流输入、排水框、发射份额 | 船艏/舷侧/推进器泡沫未统一沉积；尾迹仍 unlit additive；份额仅影响发射，未形成硬性总容量；通用船体水高接入不齐 |
| #2102 场景预设 | 五类布局、世界锚定、岸线衰减、浅水/羽流着色 | 多数环境物是几何占位（岛=锥体、岸桥=立柱）；未见真实按距LOD/实例批处理；浅水为颜色近似 |
| #2103 性能治理 | rAF采集入口、上下文、资源台账、现有分档 | 未实际GPU计时；探针按首个canvas取对象；长帧过滤与实际governor仍有缺口；真实硬件证据待采集 |
| #2104 七船迁移 | 七入口共用主要模块、六船尾迹查询迁移、旧Ocean死代码清理 | 静态引用检查不是七船视觉验收；船体接触、不同任务姿态及实际三档矩阵尚欠 |
| #2105 FFT实验 | 参数/测量结构、谱统计与报告模板 | GPU FFT候选、浏览器比较、实测和许可矩阵均未完成；空数据的keep-current-path不是比较结论 |

表中1.25m是当前代码声明的近似容差，不是本轮测得船体偏离1.25m。几何带宽近似、CPU查询与实际可见曲面的误差、刚体水线接触误差必须分别报告，不能用一个宽容差覆盖全部。

父项关闭评论明确承认实际浏览器走查/硬件测量待做，以及FFT任务2/3/4未完成。保留归档作为历史实现记录，在新补完变更中承担剩余结果；不因新增Issue而重做已交付框架。

## 3. 关键源码证据

以下路径均相对 `src/resources/simulations/`，以文末固定提交为准。

### A. 泡沫模板被波峰遮罩反复显露

`scene/water/gerstner-water-material.ts`：

```glsl
float foamNoise = texture2D(uFoamTex, vWorldPos.xz / 80.0).a;
float foam = smoothstep(0.72, 0.95, vCrest)
           * smoothstep(0.35, 0.7, foamNoise);
```

纹理由 `gerstner-water.tsx` 设置 RepeatWrapping。UV不是直接按时间整体平移，而是固定世界平铺图案被移动的波峰遮罩反复显露。当前没有泡沫密度历史、输运、寿命或舰体源输入。单纯换成另一张高清图无法补上这些缺失行为。

`scene/wake/wake-trail.tsx` 仍使用 MeshBasicMaterial、AdditiveBlending、toneMapped:false；自然泡沫受光不代表船舶泡沫也受光。budgetShare传给发射率，但每个实例依然分配整档2200×scale容量。

### B. 波光是直接光高光，尚非完整天空倒影

水shader实际合成为 `mix(color,uHorizonColor,viewFresnel*0.45)` 加 GGX 直接光；没有环境贴图/反射目标/场景深度输入。`EnvironmentScene`设置scene.environment只会被相应PBR材质消费，不能自动给自定义ShaderMaterial增加采样。

### C. 条纹和过滤

`micro-optics.ts` 的high档是三个固定方向和频率的cos分量，low无微法线；shader用相机距离315–900m衰减，没有屏幕导数/FOV/实际像素尺寸和法线方差补偿。截图规则条纹与这一实现相容，但是否同时存在网格/压缩/缩放因素需通过分层开关定位；本次未把单帧条纹认定为已测时间闪烁。

### D. 接触、时钟与海面近似

`simulations/destroyer-simulation.tsx::WakeTrailRig` 将水高采样时间设置为 `state.clock.getElapsedTime()`，而水与尾迹老化可消费共享visualTime。seek/reset等场景可因此使用不同相位。

`components/versioned-fleet-ship.tsx` 默认waterY=0；邮轮的实际CruiseShipModel未传waterY，但传数值rollAngle。补完要统一水线参考和允许的展示性自由度，不能覆盖邮轮数值横摇。

GPU近岸按shoreSegments衰减波幅；`createNearFieldSurfaceQuery`未接收相同岸线输入。需要同时覆盖近场包络、水平位移、岸线与坐标变换的端到端一致性。

### E. 光照、环境物与测量

`environment-scene.tsx` 的PMREM仅捕获skyTexture球；可见云与地平线另画。可见天空球位置仍[0,900,0]，水shader未参与scene.fog。`scene-layout-objects.tsx::geometryFor`将岸桥生成为6×scale×6立柱；detail只控制材质和阴影，没有距离LOD/实例化。

`quality-state.tsx`探针使用document.querySelector('canvas')，在含图表的页面可能抓错画布；gpuTimerAvailable恒false；rAF采样排除delta>=1000ms，不能据此证明无严重前台卡顿。实际SceneQualityDriver仍整档调governor，后台/预热保护在探针中，不等于governor已具备。

055模型每帧在所有浏览器访问中执行Box3.setFromObject、包围盒投影及skinnedBindingsIntact并写QA全局变量，应将此观测工作真正门控到QA，先测量该热点再堆新效果。

## 4. 补完方向

### 泡沫优先：从图案升级为受约束的显示状态

采用有限范围、有限分辨率的历史密度场。每步先输运上一帧密度，再按时间衰减，最后注入自然破碎浪、船艏/舷侧和推进器源；着色时叠加细尺度多尺度/随机采样纹理。历史负责“哪里有泡沫”，纹理只负责“泡沫长什么样”。Crest的一手文档明确区分生成/逐步消散、外部源写入和多尺度/随机纹理采样，适合作为方法参考，不引入Unity依赖。[R1]

建议256²/512²、20–30Hz作为实验起点，格式按真实WebGL能力选择；使用空间双层时必须计入同一场景总预算。局部场移动要重投影已有世界位置，不能拖着历史尾迹走，也不能环回复制旧泡沫。船速决定源强，不决定所有泡沫以波相速刚性平移；展示性流速和真实教学海流分开标识。无新增水动力积分器。

### 其余六项

以实际像素脚印过滤和非相干微波保留自然波光；以共享表面/时钟修船体接触；将真实环境辐射接入水材质并统一天空与雾；将环境几何占位升级为可辨识、可按距简化的资源；将现有探针用于真实运行并修正采集对象/长帧/QA热点；补齐真正GPU FFT候选和A/B实验。

不默认引入SSR、体积云或全海域流体求解。平面反射只在声明高档场景实际启用并比较，不把“没实现、没分配render target”当作完成反射验收。PMREM特殊CubeUV布局必须按当前锁定Three版本采样。[R2] 几何与纹理分频是成熟手段，而非必须换FFT的理由。[R3]

## 5. 交付与验收原则

每项先交付可见的端到端切片，再完成实现和针对性验证。当前055镜头的波光是保留项；自然白浪、船体源、微法线、IBL、平面反射应可在QA中分别开关归因，不暴露成学生端复杂面板。

每项的动态行为用固定输入的短视频和实际输出验证。状态场需同一初态与源历史才谈复现，不能只设置时间后假定历史自动一致。数值控制和评分结果不变；实验用探针/统计不能替代运行实现。没有做的实际任务保持未完成，不能以“证据不足所以保持现状”完成实验。

七个新change均可从本次已有基线独立开展，没有强制新建的相互blockedBy边。推荐先泡沫/接触/微波，再环境辐射/布局；性能采集从第一项即开始，FFT独立推进。共享文件存在编辑冲突时协调合并，不因此建立虚假的技术依赖。最终验收在最新集成版本补跑受影响项，避免重复全仓审查和Runtime全量哈希。

## 6. 一手依据与固定代码

- [R1 Crest Foam](https://docs.crest.waveharmonic.com/Manual/Appearance/Foam.html)：生成、持续衰减、外部写入、多尺度和随机采样。访问2026-09-20；不将其Unity性能当作ACT性能。
- [R2 Three PMREMGenerator](https://threejs.org/docs/pages/PMREMGenerator.html)：按粗糙度预滤波与CubeUV布局。访问2026-09-20；代码仍须匹配ACT lockfile。
- [R3 NVIDIA GPU Gems Chapter 1](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models)：几何/纹理波分频及采样约束，历史基础资料。
- [当前源码固定基线](https://github.com/yong-wei/act/tree/fe951b765cd546319c29373cf4bd3fbeabd64133/src/resources/simulations)
- [原始研究与设计](2026-09-17-marine-environment.md)
- [原系列收尾记录](https://github.com/yong-wei/act/issues/2096)
- [水体光学交付声明](https://github.com/yong-wei/act/pull/2109)
- [船水互动交付声明](https://github.com/yong-wei/act/pull/2110)
- [全舰迁移交付声明](https://github.com/yong-wei/act/pull/2113)
- [FFT归档残余](https://github.com/yong-wei/act/blob/fe951b765cd546319c29373cf4bd3fbeabd64133/openspec/changes/archive/2026-09-18-evaluate-marine-spectral-backends/tasks.md)

## 7. 本次登记边界

原版Buddy driver已对七项propose返回HANDOFF；不认领、不实施、不部署。此环境OpenSpec1.13.0不可用，离线安装ENOTCACHED，因此不得声称已执行CLI strict。提案按结构审读后入库；本机代理仅需对七项运行定向strict，补齐必要原生父子链接并回读，再加status:ready。Issue正文是目标摘要，任务以各OpenSpec工件为准，不另建计划或证据框架。

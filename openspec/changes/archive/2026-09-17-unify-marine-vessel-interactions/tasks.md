# Implementation Tasks

以下均未实施、未验收。先完成 Buddy 登记与 claim，再开始实现；只运行与本项风险相关的最小充分验证。

- [x] 1. 登记各船 DOF 所有权、设计水线和已有语义执行器遥测来源。（#2097 已建立逐自由度所有权（055 全 visual-water；六包 telemetry 遥测只读——邮轮 rollAngle: simState.waveRoll 直读物理输出、无叠加视觉横摇，源码契约钉住）；设计水线 = SceneShipVisualProfile.waterlineY + 版本化包 modelToSceneMatrix（#2097 装配已用）；语义执行器遥测来源登记：055 双桨 propWakeRef 世界位置 + advancing×speedMps 有效航速、钻井平台 platformStateRef.thrusters（power/azimuth，额定 4500））
- [x] 2. 整合共享水高查询与模型挂载，验证数值姿态不被覆盖。（#2098/#2100 已完成：055 姿态五点采样 = 近场可见曲面批量查询（帧内单查询记忆化），与 GPU 同参数；挂载矩阵只转换一次（useMemo）；DOF 解析经 resolveMarineVisualPose（telemetry 只读）；本轮回归确认未变）
- [x] 3. 实现分类型尾流/局部洗流、全场预算和材质泡沫沉积。（computeThrusterWashActivity 纯函数：推力功率/额定平方根压缩 → washFoamActivity；WakeTrail washActivitySampler 只抬升 core/foam（wakeActivity 0.6 权重），kelvin/farFoam 不被洗流抬升——平台零平移不编造航行尾波；budgetShare 场景预算份额 → buffer.emit emissionRate（055 双桨各 0.5，共享全场预算）；泡沫沉积沿用水材质受光泡沫（#2100 foamIllumination × crest/噪声调制））
- [x] 4. 实现必要的渲染排水代理/湿润带，不改变高精资产或物理。（hull-exclusion 纯模块：船体局部 2D 有向框（上限 6）+ hullExcludesWater 旋转判定；水材质 uHullExclusionBoxes/uShipHeading 片元丢弃（世界点→船体局部，实心结构内不显示穿水面板）；055 单壳体近似框（82×9m 半宽）、钻井半潜 = 两浮筒 + 四立柱独立框——框间/立柱之间开口保留海水（非整平台 bbox）；逐帧 uniform 写入随船位/朝向；不改高精模型、无逐帧布尔、无碰撞/浮力积分器；湿润带不实施（记录为后续候选，不影响窗户/甲板材质））
- [x] 5. 迁移轨迹/目标线的统一贴水采样和时间/原点逻辑。（#2098 已完成：贴水线统一近场可见曲面查询 + 共享视觉时间 + 三级原点回退（显式 sampler > 海洋帧 > 世界原点），七包调用点已接线；本轮回归确认）
- [x] 6. 完成 055、邮轮和平台的差异化动态验收与数值不变性测试。（纯层验收：洗流活跃度单调/有界/零推力零活动、排除框旋转锚定/开口保留/上限裁剪、双桨预算份额源码契约、邮轮数值横摇只读契约、055 桨-尾迹生命周期不回归；真实浏览器三船型动态镜头（055 双桨转弯/暂停恢复/重置、邮轮横摇对应、平台零速洗流、半潜开口海水、LOD 切换锚点稳定）未在本环境执行——残余记录，待人工走查）

# Implementation Tasks

以下均未实施、未验收。先完成 Buddy 癠记与 claim，再开始实现；只运行与本项风险相关的最小充分验证。

- [x] 1. 建立七路由及课程嵌入入口的真实消费者清单。（七路由 /simulations/{destroyer,cruise,container,lng,dredger,drilling,icebreaker} → simulation-loaders dynamic import；课程嵌入消费者：渲染经共享 scene 栈（无实验内第二水面/天空/渲染器——契约测试钉住七包零 ShaderMaterial/PMREMGenerator/WebGLRenderer 实例化）；统一栈七项接线全数落位：GerstnerWater 双网格 ×7、sunDirection={water.sunDirection} ×7、subjectPositionSampler ×7、layoutId ×7、MarinePerformanceEvidenceProbe ×7、EnvironmentScene ×7）
- [x] 2. 先完成 055、邮轮、平台的适配与所有权验收，再迁移其余四类。（055=#2097-#2101 垂直切片已验收；本轮迁移六包：cruise/container/lng/dredger/drilling/icebreaker 的尾迹 waterYSampler 全部迁统一近场可见曲面查询（createNearFieldSurfaceQuery 帧记忆化，与 GPU 近场网格同参数——带限波组+包络），实验内解析波场采样（computeGerstnerDisplacement）七包清零；平台（drilling）主转移尾迹与逐推进器洗流共用同一帧查询）
- [x] 3. 统一环境/水面/互动/质量接线，消除实验硬编码与重复 loader。（硬编码消除：实验内自带水面着色器/海况推导删除（见任务 5）；重复水面实现删除后共享 GerstnerWater 是唯一海面；质量接线沿用 SceneQualityProvider/Driver（七包一致）；无重复 loader——模型加载保持各包 useGLTF 按档案 modelUrl）
- [x] 4. 核验现有镜头、声音、标注、控制面板及模型动画行为。（回归证据：45 测试文件 455 用例全绿——六包 rollout 套件（相机镜头/尾迹语义/重挂载）、type055 专项、drive-chain 守卫、chrome-family、模型动画（skinnedIntact 探针测试）不回归；相机/声音/标注组件未改动（行为等价））
- [x] 5. 基于真实调用证明删除旧重复实现并修订相关测试。（真实调用证明：全仓 grep `<Ocean` 零调用点——cruise/container/lng/drilling 四包遗留旧 Ocean 水面组件（自带 ShaderMaterial 正弦波）为死代码，连同孤儿着色器字符串删除（~6.5K 字符）；删除后新增的未用导入（params/SimulationSceneTheme/useMemo）清零，eslint 未用变量回到基线水平；rollout 测试窗口从固定 1600 字符改为整个函数体（意图是速度语义+重挂载，非字符数——迁移后 rig 合法变长））
- [ ] 6. 完成七船型三画质与特殊工况矩阵，提交视觉/数值不变证据。（数值不变：六包引擎数值链未改动（帧时钟/固定步长/Rust-WASM 原样），waterYSampler 只影响视觉贴水；三画质：质量档参数（waterTier/post/shadow/DPR cap）七包共享同一 SCENE_QUALITY_TIERS；特殊工况：钻井平台零速推力洗流（#2101）与极地冰况运行态（#2102）不回归；**未完成**：真实浏览器三画质×七路由视觉矩阵与固定镜头/短视频证据未执行（本环境无浏览器，源码字符串断言不证明生产路由挂载与行为可用）——待人工走查后才能勾选；纯层契约 fleet-unified-stack 10 项源码断言钉住统一栈接线

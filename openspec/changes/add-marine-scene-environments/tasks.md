# Implementation Tasks

以下均未实施、未验收。先完成 Buddy 登记与 claim，再开始实现；只运行与本项风险相关的最小充分验证。

- [x] 1. 定义 WeatherPreset/SceneLayout 的允许覆盖及资源清单，登记来源许可和尺度。（scene-layouts 纯模块：WeatherPreset 沿用既有五环境预设（suggestedEnvironmentPreset 只覆盖环境预设键，不触碰海况数值/任务参数）；SceneLayout 声明环境物（8 类程序化几何：buoy/breakwater/pier/rock/island/tank/crane/ice-floe，世界坐标+尺度+近远 LOD）+ 岸线段（作者态岸边水深渲染输入）+ 视觉扩展槽（iceCoverage 冰况密度/sedimentPlume 羽流参数）；零外部资产依赖——程序化 three 内置几何，无新增许可）
- [x] 2. 制作五类代表布局并注册现有静态交付链，按需加载。（五布局：开阔海·远岛/港口入口·航道/浅水施工区/远海作业区/极地冰区；MarineSceneLayoutObjects 按声明渲染，layoutId 缺省不渲染（纯海面语义）；七包装配层挂载各自布局（映射在实验侧，共享模块不硬编码实验 id——pipeline 守卫钉住））
- [x] 3. 实现近远环境物 LOD/实例化、世界锚定和任务视野保护。（近景（buoy/rock/breakwater/ice）三维几何+阴影接收；远景（island/tank/crane/pier）简化几何粗材质；世界锚定：position 为世界坐标静态放置、无相机/船位采样器（视差正确、不随船滑动，源码契约钉住）；布局物置于作业区外围（≥400m 量级），不遮挡教学轨迹、不在航路中添加障碍（坐标声明远离原点作业区））
- [x] 4. 接入岸线/作者态深度、极地冰/施工羽流的纯视觉扩展槽。（shorelineAmplitudeAttenuation 纯函数：距岸线平滑波幅衰减 [0.15,1]（浅水耗散视觉近似，渲染输入非水动力网格）；iceCoverage/sedimentPlume 声明字段就绪（消费方接线随 #2104 全船型迁移统一落位，本项为纯视觉数据槽——无数值力/碰撞/任务障碍，字段契约测试钉住））
- [x] 5. 校准天空/雾/水/环境物照明一致性与低档表示。（环境物 MeshStandardMaterial 自动拾取 #2099 scene.environment IBL 与方向光——同一天空/光/雾栈一致照明；近远材质共享实例（模块级常量，无逐物分配）；低档：无外部大资源首载（程序化几何按声明懒挂载），quality 档继续只影响水面/阴影/后处理）
- [x] 6. 执行动态镜头、原点移动、预设切换及任务状态不变验收。（纯层验收：五布局声明完整性/世界坐标有限性/映射唯一、岸线衰减单调与开阔海不变、装配层七包挂载源码契约、视觉扩展槽无数值语义字段、共享渲染栈无实验硬编码（pipeline 守卫通过）；真实浏览器动态镜头（港口视差/岸水接触/雾层/预设组合/原点移动）未在本环境执行——残余记录，待人工走查）

# 将全部七类海洋仿真迁入统一环境架构 — 设计

基线：`37a988f5928d73c2af7eabad57284a771c9d3519`。共同依据与上游来源：[研究报告](../../../docs/research/2026-09-17-marine-environment.md)。所有性能/误差数值为待验证目标。

## 技术先决条件

在船水互动、环境预设和预算治理完成后进行全量接入：`unify-marine-vessel-interactions`、`add-marine-scene-environments`、`govern-marine-render-performance`。谱后端实验不是本项前提。

## 决策

审计 `src/resources/simulations/simulations/` 中 destroyer、cruise、container、lng、dredger、drilling、icebreaker 七个实际组件、路由、注册表以及课程嵌入入口。旧根目录 destroyer 单体和局部 Ocean 定义不能仅因文件存在就认定在运行；先证明调用链再移除。

所有入口使用同一 scene runtime、water、sky/lighting、interaction 和 quality。差异限于 ship profile、DOF 所有权、任务适配、环境布局/预设。共享模块不得 import 某实验 ID、路由或私有模型。

保留七船型的目标/控制/指标、数值模型、相机停留、右键自由视角、重新选择视角才复位、声音默认关闭、最小教学标注和面板布局。不要把本项扩展为全站 UI 重设计。

消费实际激活模型包和现有交付/回退链，确认矩阵仅应用一次、设计水线正确、语义节点存在或有已声明回退。不要因模型格式不同复制 loader/retry 逻辑。

先以 055 与邮轮/平台验证不同姿态责任，然后其余船型按共享适配迁入；每次覆盖生产路径而非只增加 QA 页面。删除已证实无用的重复海面/天空/时钟/尾迹代码和失效测试，不把新旧两套栈永久并存。

## 验证

七船型×三档质量基本接入矩阵；055 五天气×四镜头；邮轮数值横摇、平台零速洗流、极地冰状态、挖泥浅水、商船港湾世界锚定分别有动态案例。实际数值输出与基线比较；固定截图加短视频共同验收。部署、模型激活与 Runtime 发布不由本提案自动执行。

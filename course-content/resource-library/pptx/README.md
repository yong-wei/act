# PPTX 提取总索引

本目录保存 `course-content/slides-ref/*.pptx` 的正式提取产物。后续新的 `pptx` 提取包也统一放在这里。

## 质量基线

每个 `pptx` 的提取产物都应遵循当前 `3方框图_控制系统结构` 的完成标准：

- 有独立目录 `pptx/<课件名>/`
- 有 `README.md`
- 有按页和按主题整理的 `extracted.md`
- 关键线框图重建为 `TikZ`
- `TikZ` 编译生成 `pdf` 和 `png`
- `extracted.md` 中直接嵌入对应图片
- 对缺失信息显式标注，不虚构补写

## 当前状态

| 课件 | 状态 | 产物目录 |
| --- | --- | --- |
| 1反馈_控制原理的核心思想 | done | [1反馈_控制原理的核心思想](/Users/YW/Documents/Site/act.just.edu.cn/course-content/resource-library/pptx/1反馈_控制原理的核心思想) |
| 2.1微分方程_控制系统基础模型 | done | [2.1微分方程_控制系统基础模型](/Users/YW/Documents/Site/act.just.edu.cn/course-content/resource-library/pptx/2.1微分方程_控制系统基础模型) |
| 2.2传递函数_控制系统数学模型 | done | [2.2传递函数_控制系统数学模型](/Users/YW/Documents/Site/act.just.edu.cn/course-content/resource-library/pptx/2.2传递函数_控制系统数学模型) |
| 3方框图_控制系统结构 | done | [3方框图_控制系统结构](/Users/YW/Documents/Site/act.just.edu.cn/course-content/resource-library/pptx/3方框图_控制系统结构) |
| 4信号流图_控制系统拓扑结构 | done | [4信号流图_控制系统拓扑结构](/Users/YW/Documents/Site/act.just.edu.cn/course-content/resource-library/pptx/4信号流图_控制系统拓扑结构) |
| 5.1梅森公式_数圈圈与消消乐 | done | [5.1梅森公式_数圈圈与消消乐](/Users/YW/Documents/Site/act.just.edu.cn/course-content/resource-library/pptx/5.1梅森公式_数圈圈与消消乐) |
| 5.2系统建模综合 | done | [5.2系统建模综合](/Users/YW/Documents/Site/act.just.edu.cn/course-content/resource-library/pptx/5.2系统建模综合) |
| 6性能指标_控制效果评价 | done | [6性能指标_控制效果评价](/Users/YW/Documents/Site/act.just.edu.cn/course-content/resource-library/pptx/6性能指标_控制效果评价) |
| 7控制系统建模习题2025 | done | [7控制系统建模习题2025](/Users/YW/Documents/Site/act.just.edu.cn/course-content/resource-library/pptx/7控制系统建模习题2025) |
| 7.1衰减振荡_欠阻尼二阶系统 | done | [7.1衰减振荡_欠阻尼二阶系统](/Users/YW/Documents/Site/act.just.edu.cn/course-content/resource-library/pptx/7.1衰减振荡_欠阻尼二阶系统) |
| 7.2拉氏变换_工程直觉的数学实现 | done | [7.2拉氏变换_工程直觉的数学实现](/Users/YW/Documents/Site/act.just.edu.cn/course-content/resource-library/pptx/7.2拉氏变换_工程直觉的数学实现) |
| 8稳定_控制系统首要任务 | done | [8稳定_控制系统首要任务](/Users/YW/Documents/Site/act.just.edu.cn/course-content/resource-library/pptx/8稳定_控制系统首要任务) |
| 9稳态误差_准确性的度量 | done | [9稳态误差_准确性的度量](/Users/YW/Documents/Site/act.just.edu.cn/course-content/resource-library/pptx/9稳态误差_准确性的度量) |
| 10.1校正_实现控制的手段 | pending | - |
| 10.2时域分析综合 | pending | - |
| 11放眼大局_根轨迹法 | pending | - |
| 12根轨迹_基本形态 | pending | - |
| 13根轨迹_细节修正 | pending | - |
| 13时域分析习题2025 | pending | - |
| 14参数根轨迹_广义定义 | pending | - |
| 15.1根轨迹法_图形化思考 | pending | - |
| 15.2根轨迹分析综合 | pending | - |
| 16频率特性_换个角度看控制 | done | [16频率特性_换个角度看控制](/Users/YW/Documents/Site/act.just.edu.cn/course-content/resource-library/pptx/16频率特性_换个角度看控制) |
| 17近似叠加_绘制伯德图 | done | [17近似叠加_绘制伯德图](/Users/YW/Documents/Site/act.just.edu.cn/course-content/resource-library/pptx/17近似叠加_绘制伯德图) |
| 18幅相特性_换个角度看频域 | done | [18幅相特性_换个角度看频域](/Users/YW/Documents/Site/act.just.edu.cn/course-content/resource-library/pptx/18幅相特性_换个角度看频域) |
| 19稳定判据_频域的启示 | pending | - |
| 20宽备窄用_稳定裕度 | pending | - |
| 21三频段_各司其职 | pending | - |
| 22串联校正 | pending | - |
| 23滞后超前 | pending | - |

## 推荐批次

1. 结构与拓扑核心：
   `4信号流图_控制系统拓扑结构`、`5.1梅森公式_数圈圈与消消乐`、`2.1微分方程_控制系统基础模型`、`2.2传递函数_控制系统数学模型`
2. 建模与时域：
   `6性能指标_控制效果评价`、`7.1衰减振荡_欠阻尼二阶系统`、`7.2拉氏变换_工程直觉的数学实现`
3. 根轨迹与频域：
   按编号继续推进

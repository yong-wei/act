# 单元 5-1 多模态资源设计与采用清单

> **当前阶段目标**：围绕“线性主干边界识别”组织正式媒体，优先支撑边界现象观察、典型非线性环节对照、局部线性化判断和线性预测失真对比。
> **命名前缀**：全部统一使用 `5-1-...`

## 1. 资源融入评审单

| 候选资源路径 | 资源类型 | 计划落点 | 采用方式 | 采用级别 | 边界说明 |
| --- | --- | --- | --- | --- | --- |
| `course-content/resource-library/ship-control-cases/sections/7.1-船舶航向控制系统非线性分析.md` | `ship-case` | 饱和、死区和船舶航向控制边界例子 | 改写吸收 | 必融入 | 只吸收“船舶航向控制中执行器非线性会破坏线性预测”的证据，不展开完整描述函数推导 |
| `course-content/resource-library/ship-control-cases/sections/7.2-船舶摇减摇鳍控制系统非线性分析.md` | `ship-case` | 速率限制、执行器边界和工程类比 | 仅作灵感 | 可选融入 | 不把本课改写成减摇鳍专题 |
| `course-content/resource-library/ship-control-cases/sections/7.3-船载稳定平台控制系统非线性分析.md` | `ship-case` | 模型失配与多对象边界提醒 | 仅作灵感 | 可选融入 | 只保留“对象条件变化会改变模型有效性”的启发 |
| `course-content/resource-library/civics-cases/cases/08-非线性辩证场.md` | `civics` | 总结与边界意识收束 | 改写吸收 | 可选融入 | 只服务“局部有效、全局未必有效”的系统思维，不脱离专业对象空讲哲学 |

## 2. 本课正式媒体总表

| 编号 | 文件名 | 类型 | 状态 | 用途 |
| :---: | --- | --- | --- | --- |
| 1 | `5-1-cover-comic.png` | AI 位图 | 已就位 | 学生讲义封面漫画 |
| 2 | `5-1-info.png` | AI 信息图 | 已就位 | 学生讲义封底信息图 |
| 3 | `5-1非线性边界总览插图.png` | AI 位图 | 已就位 | 第一章导入，展示多类边界现象 |
| 4 | `5-1-boundary-static-characteristics.png` | 代码直出图 | 已生成 | 典型非线性环节两行对照 |
| 5 | `5-1-local-linearization-smooth-compare.png` | 代码直出图 | 已生成 | 合理局部线性化时域/频域对比 |
| 6 | `5-1-local-linearization-relay-bad-compare.png` | 代码直出图 | 已生成 | 不合理继电器线性化时域/频域对比 |
| 7 | `5-1-saturation-response-compare.png` | 代码直出图 | 已生成 | 饱和执行器小/大信号响应对比 |
| 8 | `5-1-deadzone-feedback-compare.png` | 代码直出图 | 已生成 | 死区执行机构忽略预测与实际响应对比 |
| 9 | `5-1-relay-hysteresis-feedback-compare.png` | 代码直出图 | 已生成 | 滞环继电器忽略预测与实际响应对比 |
| 10 | `5-1-rate-limit-feedback-compare.png` | 代码直出图 | 已生成 | 速率限制舵机忽略预测与实际响应对比 |
| 11 | `5-1-intro-video-prompts.md` | 导入视频提示词 | 已有 | 15 秒课程导入视频 |
| 12 | `5-1-media.md` | 媒体链接文档 | 待登记 | 课程级媒体登记入口 |

## 3. 原始脚本与生成入口

### 3.1 边界数据生成

- **Octave 脚本**：`media/raw/generate_5_1_boundary_data.m`
- **输出数据目录**：`media/processed/5-1-boundary-data/`
- **用途**：
  - 生成典型非线性静态特性数据；
  - 生成局部线性化、饱和、死区、滞环继电器和速率限制的响应对比数据。

### 3.2 最终排版出图

- **Python 脚本**：`media/raw/render_5_1_boundary_figures.py`
- **用途**：
  - 将 Octave 导出的数据排版为讲义图；
  - 统一中文标题、坐标轴、图例和多子图布局；
  - 生成 `media/processed/5-1-boundary-static-characteristics.png`、`media/processed/5-1-local-linearization-smooth-compare.png`、`media/processed/5-1-local-linearization-relay-bad-compare.png`、`media/processed/5-1-saturation-response-compare.png`、`media/processed/5-1-deadzone-feedback-compare.png`、`media/processed/5-1-relay-hysteresis-feedback-compare.png`、`media/processed/5-1-rate-limit-feedback-compare.png`。

## 4. 媒体设计约束

1. 所有响应图必须同时展示输出和控制量，避免只看最终输出值。
2. 局部线性化图必须采用“左侧时域对比、右侧频域 Bode 对比”的二连图结构。
3. 典型非线性静态图必须保持 2 行布局，覆盖饱和、死区、继电器、滞回、间隙、摩擦、速率限制、量化、平滑非线性和分段增益。
4. `5-1-cover-comic.png` 与 `5-1-info.png` 属于保留资产，不由代码直出脚本覆盖。
5. 课程级 `slides.pdf`、`course.mp4`、`audio.m4a` 只在媒体链接文档登记，后续由人工或外部制作流程回写。

## 5. 后续外部制作说明

- `5-1-intro-video-prompts.md` 已作为导入视频提示词入口，建议围绕“线性预测在工程边界中失真”的工业/工程隐喻展开。
- `5-1-slides.pdf` 建议按学生讲义顺序组织：边界现象、默认条件、典型非线性、局部线性化、预测失真、五步判断。
- `5-1-course.mp4` 建议突出“先识别边界，再谈方法迁移”的判断链，不把非线性包装成算法名词展示。

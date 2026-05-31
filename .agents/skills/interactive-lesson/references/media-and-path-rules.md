# 媒体与路径规则

## 目标

当课程设计文档要求视频、图片、图表或动画，而仓库中还没有对应资源时，必须给出可直接落地的占位实现方案，让用户后续只需把文件放到指定位置即可被页面读取。

本文件主要约束"外部提供或占位资源"的路径规则；如果资源本身可由代码直出或页面 SVG 绘制，请优先参考：

- [runtime-code-generated-media.md](runtime-code-generated-media.md)

## 统一目录

默认外部媒体放在：

`public/course-media/<lesson>/`

示例：
- `public/course-media/L-2a/step-02-ship-turn.mp4`
- `public/course-media/L-2a/step-02-ship-response.png`
- `public/course-media/L-2a/step-07-four-families.png`

## 命名规则

- 文件名前缀使用步骤编号：`step-02`
- 中间使用语义短名，不要使用 `image1`、`final`、`new`
- 扩展名与真实资源类型匹配

推荐模式：
- 视频：`step-02-ship-turn.mp4`
- 静态图：`step-02-ship-response.png`
- 对比图：`step-07-four-families.png`
- 参数曲线：`step-13-zeta-family.png`
- 动画占位：`step-13-zeta-family.webm`

## 缺失媒体时必须输出的清单

每发现一个缺失媒体，至少输出：
- 步骤编号与标题
- 资源用途
- 建议文件名
- `public` 相对路径
- 建议格式
- 页面中将读取的相对 URL

示例：

```text
步骤 02｜导入：情境展示
- 用途：船舶转向引入视频
- 建议文件：step-02-ship-turn.mp4
- 存放路径：public/course-media/L-2a/step-02-ship-turn.mp4
- 页面读取：/course-media/L-2a/step-02-ship-turn.mp4
```

## 占位策略

- 视频缺失：用带说明文字的占位卡片，保留播放器区域尺寸
- 图片缺失：用占位框 + 标题 + 预期内容说明
- 图表缺失：优先尝试用现有代码生成；做不到时再用占位框

如果图表、示意图、结构图可以代码生成：
- 不要先写 `public/` 占位路径
- 先判断是否应放到 `course-content/runtime/lessons/<lesson>/media`
- 生成与验证规则见 `runtime-code-generated-media.md`

不要只写"待补充"。占位组件上应显示：
- 资源标题
- 设计文档中的用途
- 预期文件路径

## 优先级

优先补齐这些媒体：
1. Bridge-in 引入视频或场景图
2. 核心对比图或参数图
3. 课堂总结或知识图谱图

## 例外

如果某资源能被现有互动工作区完全替代，允许不单独落地静态图，但必须在差异笔记里说明：
- 原设计稿的资源是什么
- 为什么改为动态工作区更合适
- 是否影响教师讲授节奏

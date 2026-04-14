# 媒体与路径规则

## 目标

当课程设计文档要求图片、视频、图表、结构示意或 AI 生成图，而当前课程产物还未齐备时，必须给出能落到新体系中的真实路径方案。

当前默认原则不是把资源直接丢进 `public/course-media/...`，而是：

1. 先补作者态 `course-content/authoring/lessons/.../<lesson>/media/processed/`
2. 再通过 `bash course-content/scripts/export-runtime.sh <lesson>` 导出到 runtime
3. 页面最终统一通过 `/course-runtime/...` 或 runtime 资源映射读取

不要把旧的 `public/course-media/<lesson>/` 当成当前默认正式路径。

## 统一目录

### 作者态处理后资源

默认放在：

`course-content/authoring/lessons/<lesson>/media/processed/`

或 legacy 课次对应：

`course-content/authoring/lessons/legacy/<lesson>/media/processed/`

### runtime 产物

导出后位于：

`course-content/runtime/lessons/<lesson>/media/`

或：

`course-content/runtime/lessons/legacy/<lesson>/media/`

### 页面读取

默认读取形式：

- `/course-runtime/lessons/<lesson>/media/<file>`
- `/course-runtime/lessons/legacy/<lesson>/media/<file>`

如课程已有 `get<Lesson>MediaSrc()` 之类的统一映射函数，优先复用该封装。

## 命名规则

- 文件名前缀使用步骤编号：`step-02`、`sh-03`、`td-04`
- 中间使用语义短名，不要用 `image1`、`final`、`new`
- 扩展名与真实类型匹配

推荐模式：

- 视频：`step-02-ship-turn.mp4`
- 静态图：`step-02-ship-response.png`
- AI 图：`step-07-four-families-ai.png`
- 代码直出图：`td-04-time-domain-indices-annotated.svg`
- 线框图：`h-05-rc-circuit.svg`

## 缺失媒体时必须输出的清单

每发现一个缺失媒体，至少写清：

- 步骤编号与标题
- 资源用途
- 建议文件名
- 作者态处理后路径
- runtime 导出路径
- 页面最终读取 URL
- 资源来源方式：代码直出 / 前端绘制 / AI 生成 / 外部视频图片

示例：

```text
步骤 02｜导入：情境展示
- 用途：船舶转向引入视频
- 建议文件：step-02-ship-turn.mp4
- 作者态：course-content/authoring/lessons/legacy/L-2a/media/processed/step-02-ship-turn.mp4
- runtime：course-content/runtime/lessons/legacy/L-2a/media/step-02-ship-turn.mp4
- 页面读取：/course-runtime/lessons/legacy/L-2a/media/step-02-ship-turn.mp4
- 来源方式：外部视频
```

## 占位策略

- 视频缺失：用带说明文字的播放器占位卡，但同时给出正式文件路径
- 图片缺失：用占位框 + 标题 + 用途 + 目标路径
- 图表缺失：优先判断是否能改为代码直出或前端绘制；做不到时再临时占位

不要只写“待补充”。页面或笔记上至少应显示：

- 资源标题
- 设计文档中的用途
- 预期文件名
- 最终路径

## 资源优先级

优先补齐这些媒体：

1. Bridge-in 引入视频或场景图
2. 核心讲授图、响应图、结构图、关系图
3. 课堂总结和知识主线图

## 代码直出优先规则

如果某资源本质上是控制图、结构图或机械/电路线框图：

- 不要先写图片占位路径
- 先判断该资源属于“运行时 Rust/WASM 曲线工作区”“作者态 `python3 + control` / `Octave` 静态图”还是 `tikz-control-draw`
- 运行时曲线工作区不是传统文件型媒体，不要求落成单张 `media/processed/*` 图片；它属于页面运行时能力，应走共享引擎、共享工作区与实现契约
- 只有文件型静态图资源，才执行“真实生成后进入 `media/processed/`，再导出 runtime”；运行时曲线工作区不走这条文件产物流转

## AI 图与外部媒体

如果使用 AI 生成图或外部提供图片：

- 仍然按正式资源管理，不要把临时下载文件直接塞进页面目录
- 先进入 `media/processed/`
- 审查后再导出 runtime

## ASCII 图禁令

- 所有正式产物禁止使用 ASCII 图、字符框图、字符波形作为最终媒体
- 即使暂时缺资源，也只能使用规范化占位说明，不得把 ASCII 图当正式内容交付

## 例外

如果某个原设计媒体已被更好的互动工作区替代，可以不单独制作静态图，但必须在课程笔记里写明：

- 原设计稿想表达的媒体是什么
- 为什么改成工作区更合适
- 是否影响教师讲授节奏

# Runtime 媒体索引契约

## 目标

为互动课程入口页提供统一的 runtime 媒体文档格式，使页面可以稳定读取：

- 媒体文件名
- 用户可见标题/说明
- 实际链接
- `handout.md` 摘要

默认文件路径：

`course-content/runtime/lessons/<lesson>/media/<lesson>-media.md`

## 文档结构

默认采用“按资源分节”的 Markdown 结构：

```md
# 2-1-intro-video.mp4

- 自动送餐车突然偏离白线，带出“先把真实对象翻译成统一分析对象”
- 用导入情境引出“建模与变换语言，就是把复杂真实系统变成可分析、可连接、可运算的对象”这一主题。

https://example.com/intro-preview

# 2-1-audio.m4a

- 梅森公式与传函

https://example.com/audio-preview

# 2-1-slides.pdf

- Control Theory Speedrun

https://example.com/slides-preview

# 2-1-course.mp4

- 工程师升级攻略：用传递函数驯服控制系统

https://example.com/course-preview

# <lesson>-handout.md

这里写讲义摘要，可为多行 Markdown。
```

## 解析规则

### 媒体节

每个媒体节按以下顺序解析：

1. `# <filename>` 作为资源文件名
2. 第一条 `- ` 行作为用户可见标题 `title`
3. 第一条 `http/https` 行作为资源链接 `url`

约束：

- 媒体节中的原有人工标题、备注和链接必须保留
- `intro-video.mp4` 可在原有人工标题后追加一条自动生成的主题文案
- 如果某条媒体没有说明行，可回退为文件名
- URL 行必须是真实链接，不能把标题误解析成 URL
- `handout.md` 不是媒体资源，不应进入 `mediaResources`

### 讲义节

`# <lesson>-handout.md` 当前主要作为固定预留节：

- 审查导出必须保留已有讲义摘要
- 若后续人工补写摘要，解析层仍可把非空行合并为 `handoutSummary`
- 若原文件没有摘要，可只保留空节

## 文案要求

- 导入视频追加主题句必须是课程内容导向文案，不是技术路径描述
- 不写“对象存储地址”“预览链接”“在线播放页”“运行态文件”等工程词
- 如果导入视频文案最初来自作者态提示词，也必须先回写到 runtime 媒体文档，再由页面消费

## 前端装配要求

- 页面必须只消费解析后的 runtime 数据，不自行猜测资源说明
- 视频/音频/课件正文说明优先显示 `resource.title`
- 音频播客壳文案可固定，但节目主题部分仍使用 `resource.title`
- 讲义摘要显示 `lessonRuntime.handoutSummary`，不用 `handoutPreview`

## 与作者态的关系

作者态可以继续保留：

- 视频提示词
- 媒体设计说明
- 审查备注

但这些内容不能直接成为页面真值。页面真值必须是 runtime `media/<lesson>-media.md`。

## 导出与维护

当新增或修改课程入口媒体时，维护顺序应是：

1. 在作者态准备或确认媒体
2. 保留 runtime 中已有标题、摘要与链接；仅对导入视频追加主题句，必要时补齐缺失的 `# <lesson>-handout.md`
3. 前端只读取 runtime 媒体文档

如果页面需要新文案，不要先改页面常量，先改 runtime 媒体文档。

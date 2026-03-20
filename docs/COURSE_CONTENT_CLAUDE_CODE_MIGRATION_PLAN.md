# course-content 目录规范与迁移计划

## 1. 目标

本方案用于把课程制作相关资产统一迁移到项目根目录下的 `course-content/`，并让后续的 Claude Code 主要在该目录内完成：

- 课程设计文档整理
- 子目录新建与内容迁移
- 多媒体文件归档
- 知识图谱节点与关系增量维护
- 知识卡片制作与编排
- 运行时资源发布

同时保留“系统代码构建”和“课程资源同步”两条独立链路：

- 镜像只构建系统代码
- 课程内容作为外部资源目录挂载或同步到服务器
- 系统运行时从 `course-content/runtime/` 读取课程资源

---

## 2. 设计原则

### 2.1 作者态与运行态分离

`course-content/` 必须拆成两层：

- `authoring/`
  - 给课程制作使用
  - 保留原始讲义、互动设计稿、媒体原件、图谱增量、卡片源文件
- `runtime/`
  - 给平台运行使用
  - 只放系统真正读取的发布产物

系统不要直接读取 `authoring/`，避免把“制作中内容”和“线上运行内容”耦合在一起。

### 2.2 课次为第一组织维度

课程相关资产优先按课次目录组织，而不是按文件类型平铺全局。  
原因：

- Claude Code 在单课制作时可把工作范围收敛到单一子目录
- 便于整课迁移、复制、归档、审核
- 设计稿、媒体、图谱增量、卡片编排天然属于同一课次语义单元

### 2.3 图谱底座与课次增量分离

当前全局图谱也迁移到 `course-content/`，但仍保持“基线底座 + 课次增量”的结构：

- 基线底座：平台全局知识图谱
- 课次增量：某节课新建节点、关系、卡片编排

这样 Claude Code 在制作某节课时，既能在项目范围内参考全局图谱，又不会把每节课的增量直接写乱到全局底座里。

### 2.4 Manifest 驱动

每节课必须有自己的 `manifest.json`。  
Claude Code 在 `course-content` 下工作时，优先围绕 `manifest.json` 判断：

- 这一课有哪些设计文档
- 这一课有哪些媒体
- 这一课有哪些图谱增量
- 这一课有哪些卡片编排
- 这一课当前是否已经发布到 `runtime`

---

## 3. 推荐目录结构

```text
course-content/
├─ README.md
├─ authoring/
│  ├─ lessons/
│  │  ├─ L-2a/
│  │  │  ├─ manifest.json
│  │  │  ├─ design/
│  │  │  │  ├─ interactive-page.md
│  │  │  │  ├─ boppps.md
│  │  │  │  ├─ handout.md
│  │  │  │  └─ multimedia.md
│  │  │  ├─ media/
│  │  │  │  ├─ raw/
│  │  │  │  ├─ processed/
│  │  │  │  └─ manifest.json
│  │  │  ├─ graph/
│  │  │  │  ├─ nodes.jsonl
│  │  │  │  ├─ relations.jsonl
│  │  │  │  └─ card-refs.json
│  │  │  ├─ cards/
│  │  │  │  ├─ sequence.json
│  │  │  │  └─ overrides/
│  │  │  └─ notes/
│  │  │     └─ implementation-notes.md
│  │  └─ ...
│  ├─ knowledge/
│  │  ├─ base/
│  │  │  ├─ knowledge_graph.json
│  │  │  ├─ node-index.json
│  │  │  └─ relation-index.json
│  │  ├─ overlays/
│  │  │  ├─ L-2a/
│  │  │  │  ├─ nodes.jsonl
│  │  │  │  └─ relations.jsonl
│  │  │  └─ ...
│  │  └─ cards/
│  │     ├─ nodes/
│  │     │  ├─ <node_id>.md
│  │     │  └─ ...
│  │     └─ lessons/
│  │        ├─ L-2a/
│  │        │  ├─ sequence.json
│  │        │  └─ overrides.json
│  │        └─ ...
│  └─ shared/
│     ├─ media-placeholders/
│     ├─ templates/
│     └─ schema/
├─ runtime/
│  ├─ lessons/
│  │  ├─ L-2a/
│  │  │  ├─ lesson.json
│  │  │  ├─ media/
│  │  │  ├─ cards/
│  │  │  └─ graph-overlay.json
│  │  └─ ...
│  ├─ knowledge/
│  │  ├─ knowledge_graph.json
│  │  ├─ lesson-overlays/
│  │  └─ cards/
│  └─ indexes/
│     ├─ lessons.json
│     └─ cards.json
└─ scripts/
   ├─ export-runtime.sh
   ├─ sync-runtime.sh
   └─ validate-content.py
```

---

## 4. 各目录职责

### 4.1 `course-content/authoring/lessons/<lesson>/`

单课制作主目录。Claude Code 后续在制作某节课时，应优先在这里活动。

建议最少包含：

- `manifest.json`
- `design/`
- `media/`
- `graph/`
- `cards/`

#### `design/`

放课程设计原稿，不再散落在项目外部目录。

建议文件名固定：

- `interactive-page.md`
- `boppps.md`
- `handout.md`
- `multimedia.md`

#### `media/raw/`

放原始资源，不要求可直接上线，例如：

- 原始视频
- PPT 导出图
- 拍摄图片
- 录音原件

#### `media/processed/`

放处理后的可发布资源，例如：

- 压缩后的 mp4
- 裁剪后的 png/webp
- 尺寸统一的封面图

#### `graph/`

放当前课次的图谱增量，不直接改全局底座。

建议：

- `nodes.jsonl`
- `relations.jsonl`
- `card-refs.json`

#### `cards/`

放这一课的知识卡片编排，而不是全局节点卡正文。

建议：

- `sequence.json`
  - 本课卡片出场顺序
- `overrides/`
  - 本课对某些全局卡片的局部补充

### 4.2 `course-content/authoring/knowledge/base/`

放当前平台的全局知识图谱基线。  
这里就是把当前仓库内 `data/knowledge_graph.json` 迁入后的归宿。

建议至少包含：

- `knowledge_graph.json`
- `node-index.json`
- `relation-index.json`

其中：

- `knowledge_graph.json` 为主文件
- 另外两个索引文件是可选增强，方便 Claude Code 做局部检索与校验

### 4.3 `course-content/authoring/knowledge/overlays/<lesson>/`

放某节课的图谱增量镜像，和单课目录中的 `graph/` 保持一致或由脚本生成。  
这个目录的作用是从“知识图谱视角”总览所有课次增量，便于后续统一合并与质量检查。

### 4.4 `course-content/authoring/knowledge/cards/nodes/`

放全局节点卡正文，建议采用：

```text
course-content/authoring/knowledge/cards/nodes/<node_id>.md
```

不要继续使用仅靠中文标题命名的平铺方式。  
文件名应以 `node_id` 为准，标题放在 frontmatter 或正文中。

建议每张卡片使用 frontmatter：

```yaml
---
node_id: time_domain_overshoot
name: 超调量
lesson_units:
  - L-2a
category: TIME_DOMAIN
knowledge_type: concept
chapter: 时域分析
tags:
  - 二阶系统
  - 时域指标
asset_refs: []
---
```

### 4.5 `course-content/runtime/`

系统运行时读取目录。  
最终部署到服务器时，应同步这个目录，而不是同步整个 `authoring/`。

系统读取建议：

- 课次清单：`runtime/indexes/lessons.json`
- 单课入口：`runtime/lessons/<lesson>/lesson.json`
- 单课媒体：`runtime/lessons/<lesson>/media/`
- 单课图谱增量：`runtime/lessons/<lesson>/graph-overlay.json`

---

## 5. 面向 Claude Code 的工作约束

后续当整个设计项目迁入 `course-content/` 后，Claude Code 的默认工作边界建议如下：

### 5.1 主要工作范围

Claude Code 默认在以下目录内工作：

- `course-content/authoring/lessons/`
- `course-content/authoring/knowledge/`
- `course-content/runtime/`
- `course-content/scripts/`

### 5.2 默认禁止越界修改

如无明确任务，不应直接修改：

- `src/`
- `public/`
- `deploy/`
- `prisma/`
- 根目录 `data/`

也就是说，课程制作阶段的 Claude Code 应先把工作收敛在 `course-content` 下，只有在“需要系统接线”时，才回到平台代码目录。

### 5.3 单课任务优先进入单课目录

例如用户说“开始做 L-2a”，Claude Code 应优先进入：

```text
course-content/authoring/lessons/L-2a/
```

从该目录内读取：

- `manifest.json`
- `design/*.md`
- `graph/*.jsonl`
- `cards/*.json`
- `media/*`

### 5.4 图谱制作时的参考路径

制作新节点或新关系时，Claude Code 应优先参考：

- `course-content/authoring/knowledge/base/knowledge_graph.json`
- `course-content/authoring/knowledge/cards/nodes/`
- `course-content/authoring/knowledge/overlays/`

这样图谱制作全程都在项目范围内完成，不需要再引用项目外路径。

### 5.5 发布动作不直接改运行态

Claude Code 在制作内容时：

- 优先修改 `authoring/`
- 由脚本生成或同步到 `runtime/`

不要长期采用“手工同时改 authoring 和 runtime”。

---

## 6. manifest 规范建议

每课 `manifest.json` 建议包含以下字段：

```json
{
  "lessonId": "L-2a",
  "title": "三张面孔，同一系统 · 时域直觉速通",
  "routeSegment": "l2a-time-domain-fasttrack",
  "status": "draft",
  "designDocs": {
    "interactivePage": "design/interactive-page.md",
    "boppps": "design/boppps.md",
    "handout": "design/handout.md",
    "multimedia": "design/multimedia.md"
  },
  "media": {
    "rawDir": "media/raw",
    "processedDir": "media/processed"
  },
  "graph": {
    "nodes": "graph/nodes.jsonl",
    "relations": "graph/relations.jsonl",
    "cardRefs": "graph/card-refs.json"
  },
  "cards": {
    "sequence": "cards/sequence.json",
    "overridesDir": "cards/overrides"
  },
  "runtime": {
    "lessonJson": "../../runtime/lessons/L-2a/lesson.json",
    "mediaDir": "../../runtime/lessons/L-2a/media",
    "graphOverlay": "../../runtime/lessons/L-2a/graph-overlay.json"
  }
}
```

这样 Claude Code 可以直接基于 manifest 判断：

- 该课资料是否完整
- 缺哪些媒体
- 图谱增量在哪里
- 发布产物应该写到哪里

---

## 7. 当前图谱数据迁移建议

你提到希望把当前的图谱数据也迁入 `course-content`，这是合理且必要的。  
推荐迁移方式：

### 7.1 迁移目标

把当前仓库内：

```text
data/knowledge_graph.json
```

迁到：

```text
course-content/authoring/knowledge/base/knowledge_graph.json
```

### 7.2 迁移后的职责划分

- `course-content/authoring/knowledge/base/knowledge_graph.json`
  - 作为内容制作参考基线
- `course-content/runtime/knowledge/knowledge_graph.json`
  - 作为系统运行时读取版本

可先采用“复制一份”的方式过渡，后续再改成脚本导出。

### 7.3 增量节点与关系

原先外部设计项目中的：

- `data/new_nodes.jsonl`
- `data/new_relations.jsonl`

不应继续全局平铺，建议拆为：

```text
course-content/authoring/knowledge/overlays/L-2a/nodes.jsonl
course-content/authoring/knowledge/overlays/L-2a/relations.jsonl
```

或等价地放入：

```text
course-content/authoring/lessons/L-2a/graph/nodes.jsonl
course-content/authoring/lessons/L-2a/graph/relations.jsonl
```

二者可保留一份主源，另一份由脚本生成索引镜像。

### 7.4 知识卡片

当前卡片应逐步迁到：

```text
course-content/authoring/knowledge/cards/nodes/<node_id>.md
```

课次编排则放：

```text
course-content/authoring/knowledge/cards/lessons/<lesson>/sequence.json
course-content/authoring/knowledge/cards/lessons/<lesson>/overrides.json
```

---

## 8. 分阶段迁移计划

建议分四阶段，不要一次性大搬迁后再一起修。

### 阶段 A：建立新目录骨架

目标：先把 `course-content/` 的结构立起来。

步骤：

1. 在项目根目录创建 `course-content/`
2. 创建 `authoring/`、`runtime/`、`scripts/`
3. 创建 `authoring/lessons/`、`authoring/knowledge/` 的标准子目录
4. 添加 `course-content/README.md`
5. 为首个迁移课次创建 `manifest.json`

验收：

- Claude Code 已能在项目范围内看到完整的 `course-content` 骨架

### 阶段 B：迁移设计文档与媒体

目标：先把课程设计资料迁进来。

优先迁移：

- `notes/lessons/<lesson>/` 全套文档
- 对应多媒体资源

建议单课单课迁移，例如先迁：

- `L-2a`
- `L-2b`
- `L-2c`

验收：

- 单课设计稿已经全部进入 `course-content/authoring/lessons/<lesson>/design/`
- 媒体资源已进入 `media/raw/` 或 `media/processed/`

### 阶段 C：迁移全局图谱与卡片

目标：把知识图谱制作所需参考资料收回项目内部。

步骤：

1. 迁移当前 `data/knowledge_graph.json`
2. 迁移现有卡片源文件
3. 建立 `knowledge/cards/nodes/` 的 `node_id` 命名体系
4. 把原来的全局 `new_nodes/new_relations` 拆成课次增量目录

验收：

- Claude Code 可以在项目内完成图谱参考、节点制作、关系制作，不再依赖外部目录

### 阶段 D：接入运行态与部署链路

目标：把系统运行时读取路径切到 `course-content/runtime/`。

步骤：

1. 定义运行时索引文件
2. 增加从 `authoring/` 生成 `runtime/` 的脚本
3. 增加部署时同步 `runtime/` 的脚本
4. 系统代码改为从外部内容目录读取资源

建议通过环境变量统一：

```bash
COURSE_CONTENT_ROOT=/home/projects/act/content
```

开发环境可设为：

```bash
COURSE_CONTENT_ROOT=/Users/YW/Documents/Site/act.just.edu.cn/course-content/runtime
```

验收：

- 镜像构建不再依赖课程原始资源目录
- 服务器可单独更新课程资源而不重建系统镜像

---

## 9. 对 Claude Code 的迁移执行建议

当你完成目录整体搬迁后，可以让 Claude Code 按下面顺序工作：

### 9.1 第一轮：只建结构，不改业务代码

任务示例：

- 创建 `course-content/` 标准目录
- 迁移 `L-2a` 的设计文档
- 迁移现有图谱基线
- 生成每课 manifest

### 9.2 第二轮：整理命名与索引

任务示例：

- 统一媒体文件名
- 统一卡片 frontmatter
- 拆分课次图谱增量
- 生成 lesson index

### 9.3 第三轮：再修改系统读取逻辑

任务示例：

- 把平台的内容读取路径从旧 `data/` / `public/` / 外部目录切到 `course-content/runtime/`
- 构建脚本中排除 `authoring/`
- 部署脚本新增内容同步

---

## 10. 实施建议总结

最推荐的方案是：

1. 在项目根目录新增 `course-content/`
2. 将课程设计项目整体迁入 `course-content/authoring/`
3. 将当前全局图谱也迁入 `course-content/authoring/knowledge/base/`
4. 让 Claude Code 后续主要在 `course-content/` 下工作
5. 系统运行时只读取 `course-content/runtime/`
6. 部署时只同步 `runtime/`，不把全部制作原稿打进镜像

这是兼顾制作效率、平台稳定性、后续扩展性和 Claude Code 工作边界的最稳方案。

---

## 11. 后续可直接执行的下一步

如果按这份方案继续，下一步建议是：

1. 先创建 `course-content/` 标准目录骨架
2. 先迁 `L-2a` 的设计文档和媒体目录
3. 再迁 `data/knowledge_graph.json`
4. 最后再写系统读取与部署改造计划

如果你愿意，下一步我可以直接继续为你写：

- `course-content/README.md`
- `course-content/authoring/lessons/L-2a/manifest.json` 模板
- 面向 Claude Code 的“内容迁移执行清单”

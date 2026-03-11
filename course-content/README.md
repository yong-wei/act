# course-content 目录规范说明

本目录为"自动控制原理"课程内容包的统一管理目录，遵循**作者态（authoring）与运行态（runtime）分离**的原则。

## 目录结构

```
course-content/
├── authoring/               # 作者态：课程设计与创作素材
│   ├── lessons/             # 以课次为第一组织维度
│   │   └── L-2a/
│   │       ├── manifest.json          # 课次元数据与路径索引
│   │       ├── design/                # 设计文档（讲义、教案、互动页、多媒体规划）
│   │       ├── graph/                 # 本课次图谱数据（节点、关系、卡片引用）
│   │       ├── cards/                 # 本课次卡片编排（顺序、覆盖）
│   │       ├── media/                 # 媒体素材（raw/processed）
│   │       └── notes/                 # 实施备注
│   ├── knowledge/           # 知识视角（跨课次）
│   │   ├── base/            # 全局知识图谱基线（knowledge_graph.json, relations.jsonl）
│   │   ├── overlays/        # 各课次图谱增量
│   │   └── cards/           # 知识卡片库（nodes/ 存卡片 .md 文件）
│   └── shared/              # 共享资源
│       ├── SyllabusRefactor.md        # 教学大纲（v3.0）
│       ├── schema/                    # 数据格式规范
│       ├── templates/                 # 模板文件
│       └── media-placeholders/        # 媒体占位说明
├── runtime/                 # 运行态：平台导入用的产出物（本阶段仅建骨架）
│   ├── lessons/             # 各课次 runtime 产出
│   ├── knowledge/           # 运行时知识图谱
│   └── indexes/             # 全局索引
└── scripts/                 # 内容处理脚本（如 export-runtime.sh）
```

## 作者态 vs 运行态

| 维度 | 作者态（authoring/） | 运行态（runtime/） |
|------|---------------------|-------------------|
| 用途 | 课程内容设计与创作 | 平台导入与展示 |
| 格式 | Markdown、JSONL、JSON | 平台专用 JSON |
| 修改 | 频繁（迭代创作） | 由脚本生成，不手动编辑 |
| 版本 | Git 追踪 | 从 authoring/ 导出 |

## 工作约定

1. **新课次目录**：每次创作新课次，在 `authoring/lessons/` 下新建对应目录，并创建 `manifest.json`
2. **图谱数据**：课次新增节点写入 `authoring/lessons/<unit>/graph/nodes.jsonl`，同步镜像到 `authoring/knowledge/overlays/<unit>/`
3. **知识卡片**：卡片 `.md` 文件存放于 `authoring/knowledge/cards/nodes/`
4. **运行态导出**：使用 `scripts/export-runtime.sh` 脚本生成 runtime/ 内容（待实现）

## 相关文档

- 教学大纲：`authoring/shared/SyllabusRefactor.md`
- 图谱格式规范：`authoring/shared/schema/knowledge-graph-schema.md`
- 技能文件：`../skills/control-lesson-creator.md`（项目根级，不在本目录内）

---
name: memory-maintenance
description: Use when this repository produces stable, reusable project knowledge that should be written into `.codex/memory/`, including facts, decisions, incidents, workflows, file splits, archive moves, and index updates.
---

# Memory Maintenance

## Overview

这个 skill 用于维护本仓库的 `.codex/memory/` 长期记忆体系。目标不是“把本轮所有内容都记下来”，而是把真正适合跨会话复用的稳定知识，写入正确层级，并保持索引、交叉引用和归档结构可持续维护。

**核心原则：**

- 只记录稳定、可复用、未来仍可能被读取的内容
- 先分类，再决定写入文件
- 先更新叶子文件，再回补父级索引
- 一条事实只维护一个主位置，其他文件通过链接引用
- 临时现象、原始日志、一次性输出不直接进入 memory
- 初始化读取入口要保持稳定，尤其是根级最近摘要文件

## 什么时候使用

在以下情况应优先调用本 skill：

- 本次会话确认了一个稳定项目事实
- 形成了长期有效的设计决策
- 完成了一次值得保留的事故复盘
- 沉淀出可复用的高频流程
- 发现某个 memory 文件过大、混杂或已经失效，需要拆分或归档

## 不应该记录的内容

以下内容不要直接写入 `.codex/memory/`：

- 临时调试日志
- 尚未确认的猜测
- 仅对当前会话有用的一次性中间结论
- 已经存在于 `AGENTS.md` 的规则细节
- 需要逐日追踪的流水账

## 分类决策

写入前，先判断内容属于哪一类：

- `10-project/`
  - 项目当前状态、长期路线、术语定义
- `20-architecture/`
  - 系统结构、课堂主链路、鉴权会话、资源注册、关键模型
- `30-operations/`
  - 部署拓扑、迁移、环境变量、观测入口、已知线上风险
- `40-domain/`
  - 课程语义、精品课程、互动资源、知识卡
- `50-decisions/`
  - 长期有效的架构或流程决策
- `60-incidents/`
  - 真实故障、排障复盘、经验总结
- `70-workflows/`
  - 会反复执行的流程或检查清单
- `90-archive/`
  - 已失效但仍需保留的历史内容

## 执行流程

### 0. 先判断 recent summary 是否需要更新

- 根级 `02-recent-summary.md` 是智能体初始化时优先读取的最近摘要入口
- 当本次会话改变了“最近应该先知道什么”时，除叶子文件外，还应同步更新 recent summary
- recent summary 只保留最近 3-7 条稳定变化、当前关键风险和建议下一跳，不写流水账

### 1. 先判断是“更新现有文件”还是“新增叶子文件”

- 若已有文件已经覆盖该主题，优先更新现有文件
- 若当前主题会让已有文件变得混杂，新增叶子文件
- 若只是补一个例子，不要轻易新建文件

### 2. 更新或创建叶子文件

每个文件都应保持统一头部：

```md
# 标题

状态: active | draft | archived
最后更新: YYYY-MM-DD
摘要: 3-6 行，说明该文件回答什么问题
上游:
- [父级文件]
下游:
- [子级文件]
相关:
- [相关文件]
```

正文遵循：

- 先写结论
- 再写关键事实
- 最后写证据、风险、后续动作

如需快速起草，优先参考：

- `references/memory-file-template.md`

如果只需要快速生成空骨架，且目录与标题已经明确，优先使用：

```bash
python3 .codex/skills/memory-maintenance/scripts/new_memory_file.py --kind leaf --path 20-architecture/example.md --title "示例叶子文件"
```

推荐场景：

- 已经明确目标目录，只想先起一个符合规范的空文件
- 想减少手工重复填写头部字段

不推荐场景：

- 主题分类还不清楚
- 需要同时设计索引补链和归档迁移
- 需要把一份旧文件拆成多份新文件

### 3. 回补索引

如果新增了叶子文件，检查是否需要同步更新：

- 根级 `00-index.md`
- 根级 `02-recent-summary.md`
- 对应目录下的 `00-index.md`
- 相关读取地图或相邻主题文件

原则：

- 父级索引只做入口与摘要
- 不把叶子内容原文抄回索引
- recent summary 只保留初始化最该先读到的结果，不替代叶子文件

### 4. 判断是否需要归档

出现以下情况时，考虑移入 `90-archive/`：

- 结论已被新文件替代
- 对应流程已不再使用
- 某条事故记录已仅具历史意义，且有新的总结文件替代

归档时：

- 不直接删除
- 在归档文件中保留原用途和替代链接
- 在原入口处加上指向归档或新文件的说明

### 5. 最小校验

完成后至少检查：

- 文件头字段是否完整
- 链接路径是否存在明显错误
- 新增叶子文件是否已被对应索引指向
- 是否把同一事实重复写进了多个文件

如仓库中存在 `.codex/skills/memory-maintenance/scripts/validate_memory.py`，优先运行：

```bash
python3 .codex/skills/memory-maintenance/scripts/validate_memory.py
```

## 推荐维护节奏

- 小型稳定事实：直接更新现有叶子文件
- 一次完整排障后：补 incident
- 一次重大结构调整后：补 architecture 或 decision
- 一个流程重复出现两次以上：补 workflow
- 当最近上下文已经发生明显变化：同步更新 `02-recent-summary.md`

## 与其他文档的分工

- `AGENTS.md`：规则与行为约束
- `docs/ProjectDescription.md`：阶段进展与里程碑
- `.codex/memory/`：跨会话长期记忆

初始化快速建立上下文时，优先顺序应是：

1. `00-index.md`
2. `02-recent-summary.md`
3. `01-reading-map.md`

不要把本 skill 的细节再抄回 `AGENTS.md`。

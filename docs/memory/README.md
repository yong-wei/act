# 项目长期记忆骨架

状态: active
最后更新: 2026-03-19
摘要: 本目录用于保存适合跨会话复用的项目长期记忆，强调分层索引、渐进读取、最近摘要优先、主题隔离，以及兼容 ChatGPT 从 GitHub 连接器递归读取。
上游:
- [AGENTS.md](../../AGENTS.md)
- [docs/ProjectDescription.md](../ProjectDescription.md)
下游:
- [00-index.md](00-index.md)
- [02-recent-summary.md](02-recent-summary.md)
- [01-reading-map.md](01-reading-map.md)
相关:
- `AGENTS.md` 负责规则
- `docs/ProjectDescription.md` 负责阶段进展

## 用途边界

本目录只存放适合被 Codex、Serena 和 ChatGPT 反复读取的项目记忆，不承载以下内容：

- 不存放会频繁变化的临时日志
- 不替代 `AGENTS.md` 中的规则约束
- 不替代 `docs/ProjectDescription.md` 中的阶段性里程碑记录
- 不把 skill 工作流直接抄写为记忆正文

## 维护原则

- 根目录只放总览、最近摘要、读取地图，不放杂项细节
- 初始化时优先通过最近摘要建立最小上下文
- 每个主题目录用 `00-index.md` 做入口
- 每个叶子文件只回答一个问题
- 结论写在前，证据写在后
- 需要废弃的内容移入 `90-archive/`

## README 与 Skill 的分工

- `README.md` 负责静态约定：目录职责、命名规范、文件头格式、读取顺序
- 全局 `memory-maintenance` skill 负责动态维护：分类判断、写入位置选择、索引补链、归档判断、最小校验
- `CHATGPT_CONTEXT.md` 负责给 ChatGPT/GitHub 连接器提供入口，不替代本目录的事实文件

## 何时调用记忆维护 skill

建议在以下场景调用全局 `memory-maintenance` 技能（`${CODEX_HOME:-$HOME/.codex}/skills/memory-maintenance/SKILL.md`）：

- 一次会话形成了稳定且可复用的项目事实
- 新增了长期有效的设计决策
- 完成了一次值得保留的事故复盘
- 形成了未来会重复使用的流程
- 发现现有 memory 文件需要拆分、归档或修补交叉引用

## 建议校验命令

完成 memory 维护后，建议运行：

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/memory-maintenance/scripts/validate_memory.py" docs/memory
```

如果你只是想先创建一个符合约定的新文件骨架，可运行：

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/memory-maintenance/scripts/new_memory_file.py" --kind leaf --path 20-architecture/example.md --title "示例叶子文件"
```

当前该脚本只校验最小结构约束：

- 根目录关键文件是否存在
- 一级主题目录是否具备索引文件
- Markdown 文件是否包含统一头部字段

## 建议读取顺序

### 初始化最短路径

1. ChatGPT 或外部代理先读 [CHATGPT_CONTEXT.md](CHATGPT_CONTEXT.md)
2. 进入本目录后先读 [00-index.md](00-index.md)
3. 再读 [02-recent-summary.md](02-recent-summary.md)
4. 若任务已明确，再读 [01-reading-map.md](01-reading-map.md) 并进入对应主题

### 深入读取路径

1. 从对应主题目录的 `00-index.md` 进入
2. 仅在需要具体事实时继续读取叶子文件
3. 只在需要历史原因时读取决策记录或事故复盘

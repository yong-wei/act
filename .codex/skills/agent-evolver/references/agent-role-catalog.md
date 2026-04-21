# Agent Role Catalog

## starter
- 模型：`gpt-5.4`
- 默认推理：`medium`
- 主要职责：多数起步任务、任务分流、初步判断
- 不做：复杂 debug 终局判断、关键 review、最终验收

## deep-debugger
- 模型：`gpt-5.4`
- 默认推理：`high`
- 主要职责：复杂分析、跨文件排障、根因定位
- 不做：终审裁决、轻量读扫、大批量支持文档整理

## critical-reviewer
- 模型：`gpt-5.4`
- 默认推理：`xhigh`
- 主要职责：关键审查、复杂 review、疑难终审
- 不做：普通起步分流、简单修补实现

## explorer-librarian
- 模型：`gpt-5.4-mini`
- 默认推理：`medium`
- 主要职责：探索、读扫、大文件审阅、支持性文档处理
- 不做：最终验收、复杂架构判断、复杂修复设计

## spark-coder
- 模型：`gpt-5.3-codex-spark`
- 默认推理：`medium`
- 主要职责：极低延迟简单编码、小范围修补
- 不做：复杂 debug、复杂 review、跨文件重构

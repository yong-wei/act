## Context

Arena V2 PR #5 已完成 MVP 级深度接入：Arena 任务可进入多表征工作台，工作台可识别 `arenaTask`，白箱对象可加载传递函数 plant，challenge mode 下对象编辑被锁定，工作台可构造 `ControllerArtifact` 并提交到 `/api/arena/evaluate`。但协议的"官方评测可信性"和"学习证据价值"尚未真正打通——评测仍用启发式估算，黑箱适配器绕过已有实验服务，模型选择面板仅限于挑战模式，barrel 边界不干净。

本设计的目标是在当前代码基础上完成深度整合的剩余工作，使 Arena 达到实用地步。设计中所有改动不需要推倒现有架构，而是补齐缺失的连接点和修正语义不一致。

## Goals / Non-Goals

**Goals:**
- 协议版本按评测方法族拆分，消除 `whitebox-v2` 名义升级与实际口径不一致的问题
- metric provider 体系接入官方评测主链路，`evaluateWhiteBoxSubmission` 通过 provider 获取指标
- 自由探索模式下模型选择面板可用，工作台模型可切换
- 黑箱适配器接入已有实验服务（预算、持久化、datasetHash、归属校验）
- Arena 事件 → LearningFact 物化，学生画像和教师洞察可消费 Arena 证据
- barrel 拆分为 domain/client/server，禁止跨边界导入
- 移除 `.claude/settings.json` 从业务 PR

**Non-Goals:**
- 不在本 PR 内实现 Rust/WASM 服务端控制分析链接入（protocol 设计预留 analysis-whitebox-v1，但当前仍用 heuristic provider，通过 template-whitebox-v1 区分）
- 不在本 PR 内实现教师发布、作业闭环、奥德赛提交（归入舞台 G，作为后续 PR）
- 不改动多表征工作台内部图表渲染逻辑

## Decisions

### D1: 协议版本按方法族拆分

**选型**: `taskId + method → protocolVersion`，而非仅 `taskId → protocolVersion`

**分区**:
- `analysis-whitebox-v1`: 未来 pid/serial-compensator 真实接入 ControlAnalysisResult 后启用
- `template-whitebox-v1`: 当前所有白箱方法（pid/serial-compensator/composite/optimized-pid/mpc），使用启发式或模板化评测
- `blackbox-v1`: 黑箱对象

**理由**: 避免统一白箱协议版本掩盖方法间的评测口径差异，确保缓存隔离正确。

### D2: metric provider 接入方式

**选型**: 在 `evaluateWhiteBoxSubmission` 内部编排，而非新建平行入口

```
evaluateWhiteBoxSubmission(input)
  → validateConfig
  → summarizeController
  → evaluateHardConstraints
  → selectProvider(method) → provider.evaluate()
  → evaluateMetricProfile
```

**理由**: 保持 `evaluateArenaSubmission` 为唯一入口，provider 作为内部可替换组件。

### D3: 自由探索模式架构

`ArenaModelSelectorPanel` 接收 `onSelectObject(objectId)` 回调。`useMultiRepresentationLinkageModel` 新增 `selectArenaObjectForExploration(objectId)` 方法，读取 object 的 model + workbenchSeed 并设置 poles/zeros/gain。无 arenaTask 时面板显示"自由探索"标注，提交按钮隐藏。

### D4: 黑箱适配器回归已有服务

`createCruiseRollBlackBoxAdapter` 移除随机实现，改为调用 `createArenaBlackBoxExperiment` 或标记为 `createMockCruiseRollBlackBoxAdapterForTests`。

### D5: barrel 拆分

**新文件**: `src/features/arena/{domain,client,server}.ts`

**导入规则**:
- `model.ts` (client hook) → `import from '@/features/arena/domain'`
- server routes → `import from '@/features/arena/server'`
- Arena 页面 → `import from '@/features/arena'` (主入口保持向后兼容，内部 re-export 但标记方向)

## Risks / Trade-offs

- [Risk] barrel 拆分可能破坏已有导入 → 保持主 index.ts 存在，逐步引导到新入口
- [Risk] protocolVersion 粒度变细后旧缓存全部失效 → 接受，因为旧白箱缓存本就不应与启发式评测混用
- [Risk] 自由探索模式需要多表征工作台解析新对象 → 已有 workbenchSeed/polesFromObject 基础设施

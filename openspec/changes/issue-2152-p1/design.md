# Design: issue-2152-p1（阶段 1）

## 1. 版本链语义

- `lineageKey` 标识「同一实验同一通道/工作点」的模型演化链（学生或调用方
  提供，如 `heading@cruise15`）。重新辨识 → 同 lineageKey 的 version+1
  新行；旧行不更新不删除（保留较差尝试与冻结历史）。
- `frozenAt` 为服务端写入时刻；验证与预测引用工件 id+contentHash，
  重拟合后旧验证仍指向旧行。
- 训练/验证窗口：`{runRef, startS, endS}` 数组；同一 runRef 上训练与验证
  窗口不得重叠（跨 run 天然不重叠）。

## 2. contentHash（服务端权威）

- 规范序：对象键字典序、数组保持序、数字统一 f64 文本（与 Rust
  model_pack 的规范化哈希同一思路）。
- 输入 `structure + ioContract + operatingPoint + identification +
  trainingRuns + validationRuns + sampleDt`；哈希算法 sha256 hex。
- 客户端不传哈希；服务端计算后入库，返回给调用方供后续绑定校验。

## 3. zod 契约与 Rust 对齐

Rust `ModelStructure` serde（`rename_all="snake_case", tag="kind"`）样例：

```json
{"kind":"nomoto1","k":0.08,"t_s":25.0}
{"kind":"nomoto2","k":0.05,"t1_s":8.0,"t2_s":1.5}
{"kind":"fopdt","k":0.5,"t_s":10.0,"delay_s":3.0}
{"kind":"roll_oscillator","natural_freq_rad_s":0.6,"damping":0.12,"control_gain":0.02}
{"kind":"dp_low_freq3","a":[9 个有限数],"b":[9 个有限数]}
```

zod 判别联合逐字对齐；数值一律 `.refine(Number.isFinite)`。契约模块
零 node 依赖（不引 crypto/Prisma），哈希入 `server-hash.ts`（仅服务端
路由 import）。

## 4. API 形状

- `POST /api/ilab/student-model-artifacts`
  `{experimentKey, lineageKey, structure, ioContract, operatingPoint,
    identification, trainingRuns, validationRuns, sampleDt}` →
  `{id, version, contentHash, frozenAt}`（401 未登录；400 契约失败）。
- `GET /api/ilab/student-model-artifacts?experimentKey=...` → 本人列表
  （轻量：id/lineage/version/kind/frozenAt/residual 摘要）。
- `GET /api/ilab/student-model-artifacts/[id]` → 本人完整工件。
- `POST /api/ilab/comparison-artifacts`
  `{experimentKey, stepKey, mode, studentModelId, physicalRunRef,
    inputSource, alignmentWindow, factorFlags, metrics, curveRefs}`；
  校验 studentModelId 属本人，否则 404（不泄露他人工件存在性）。
- `GET /api/ilib...` 列表同前。错误信息为通用中文短句。

## 5. 风险与边界

- 迁移仅新增表，无数据回填。
- 并发保存同 lineage：version 取 `max+1`（事务内），竞态下唯一约束兜底
  重试一次。
- 不在本阶段暴露教师/班级维度读取（Non-goal，避免越权面扩大）。

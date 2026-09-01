# Tasks

- [x] 1. provider 工具投影：风险标志聚合携带显式 `flaggedStudentCount` / `diagnosedStudentCount` 命中语义字段，不与 coverage 词汇混用
- [x] 2. system prompt 声明风险标志稀疏命中集合语义，禁止按记录数推断覆盖人数
- [x] 3. 确定性生成校验：拦截把风险命中数量表述为覆盖缺失的 limitations/summary，按模型行为缺陷拒绝重试
- [x] 4. 教师报告投影：新增"证据冲突"结构化置信原因，覆盖完整时状态卡片如实表述冲突与教师复核动作，通用回退仅在无任何已知原因时使用
- [x] 5. 诊断 benchmark 新增"完整数据 + 稀疏风险标志 + 跨来源冲突"场景类（fixture + live ground truth）
- [x] 6. 回归测试：生成端校验、输入投影、教师报告投影、benchmark fixture；`openspec validate fix-risk-flag-coverage-misinterpretation --strict` 通过

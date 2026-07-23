# 知识节点提取实验

本目录用于离线验证教材知识节点提取协议，不写入旧图谱、数据库、runtime、学习事实或资源绑定。

## 缓存合同

请求消息顺序固定为：

1. 版本化 system prompt；
2. 一次性导入的权威教材上下文包；
3. 当前实验任务后缀。

前两条消息构成缓存前缀。已冻结的 prompt 文件和上下文包不得为单次实验随意调整；需要改变协议时必须创建新版本。仅调整末尾任务约束时，保持前两条消息字节不变。

运行器会记录：

- `prompt_prefix_sha256`
- `cache_prefix_sha256`
- `request_sha256`
- 每个来源片段的 SHA-256
- 每次响应的 token、缓存命中、耗时和 SiliconFlow trace ID

重复请求前会再次验证请求 SHA-256，不包含时间戳、运行编号或 API key。

## 使用

密钥只能通过环境变量提供：

```bash
export SILICONFLOW_API_KEY='...'
```

探测当前可用模型：

```bash
python3 scripts/knowledge-extraction/deepseek_extraction_experiment.py probe-models
```

只生成完整请求，不访问 API：

```bash
python3 scripts/knowledge-extraction/deepseek_extraction_experiment.py run --prepare-only
```

执行三次完全相同的真实请求：

```bash
python3 scripts/knowledge-extraction/deepseek_extraction_experiment.py run --repeat 3
```

执行 span-ID 协议实验：

```bash
python3 scripts/knowledge-extraction/deepseek_extraction_experiment.py run \
  --config scripts/knowledge-extraction/pilot-transfer-function-v3-span.json \
  --repeat 3
```

原始结果写入被 Git 忽略的 `.logs/knowledge-extraction-experiments/`。API key 不进入请求工件、响应工件或摘要。

## 验证

```bash
python3 scripts/tests/test_deepseek_extraction_experiment.py
python3 -m py_compile \
  scripts/knowledge-extraction/deepseek_extraction_experiment.py \
  scripts/tests/test_deepseek_extraction_experiment.py
```

结构化结果只有在以下条件全部满足时才会生成 `run-*-candidates.json`：

- 供应商返回完整 usage、缓存计费字段和 trace ID；
- `finish_reason` 为 `stop`；
- `pack_id` 与请求一致；
- 候选、别名、置信度、拒绝项符合封闭合同；
- 每条证据使用已声明 source ID；
- v1 quote 模式下，每个 quote 都是对应教材片段中的连续逐字子串；
- v2-span 模式下，span ID 必须存在且属于声明来源，模型不得提交 quote；程序回填 quote 与来源内容 SHA-256。

合同失败会保留原始响应并返回非零状态，但不会中止后续重复调用，以便测量输出漂移和缓存命中。

## 最小节点召回实验

`minimal_recall_experiment.py` 复用同一 transfer-function span 上下文包，但把首轮输出限制为候选名称、单条身份区别提示和 span 证据。本阶段不要求模型同时稳定生成定义、别名、类型、领域、章节或语义边界。

只准备固定请求，不访问 API：

```bash
python3 scripts/knowledge-extraction/minimal_recall_experiment.py run --prepare-only
```

使用 DeepSeek V4 Flash 执行三次字节完全相同的请求：

```bash
python3 scripts/knowledge-extraction/minimal_recall_experiment.py run --repeat 3
```

工件写入 `.logs/knowledge-minimal-recall-experiments/`。每轮保存原始供应商响应、经过 span 校验并回填 quote/hash 的候选、usage/cache/trace 摘要。三轮完成后生成 `comparison-report.json`，包含：

- 每轮候选数、冻结 gold 的 exact/known-alias 召回率和初步误报数；
- 三轮身份并集、交集和两两 Jaccard；
- 未命中冻结名称或已知合并名称的 `unresolved_mapping_queue`，供后续盲审身份裁决。

该比较只用于测量召回稳定性。未命中 frozen gold 的名称在完成语义映射前计为“初步误报”，不能据此直接拒绝候选。

`experiment-metadata.json`、`summary.json` 和 `comparison-report.json` 均固定标记 `classification: experimental-provisional` 与 `runtime_eligible: false`；这些工件不得进入课程 runtime、正式知识图谱或学习事实。

聚焦验证：

```bash
python3 scripts/tests/test_minimal_recall_experiment.py
python3 -m py_compile \
  scripts/knowledge-extraction/minimal_recall_experiment.py \
  scripts/tests/test_minimal_recall_experiment.py
```

## 二次裁决实验

`knowledge_adjudication_experiment.py` 从同一 V3 正式三轮工件重建 31 项精确并集、15 项精确交集和 16 项争议集。交集还需通过共同 span、来源哈希、同名拒绝和名称冲突门禁，才写入批量审批候选。争议集固定为四个语义邻域，并分别组成 4、8、16 项批次。

只准备当前全部协议 × 4/8/16 完整请求矩阵，不访问 API：

```bash
python3 scripts/knowledge-extraction/knowledge_adjudication_experiment.py prepare
```

探测唯一允许的模型 `deepseek-ai/DeepSeek-V4-Pro`：

```bash
python3 scripts/knowledge-extraction/knowledge_adjudication_experiment.py probe
```

每个矩阵单元执行一次真实请求，不自动重试：

```bash
python3 scripts/knowledge-extraction/knowledge_adjudication_experiment.py matrix
```

真实实验优先用选择器限域运行，并设置明确超时：

```bash
python3 scripts/knowledge-extraction/knowledge_adjudication_experiment.py matrix \
  --protocol p4 --batch-size 4 --batch-index 1 --timeout-seconds 240
```

运行器会在每个单元开始和结束时立即输出进度。P1 为最小协议，P2 增加附属信息硬规则，P3 增加工程现象边界，P4 进一步明确主权威只用于来源冲突、次级权威直接证据可以支持未被主权威覆盖的节点。

裁决工件写入 `.logs/knowledge-adjudication-experiments/`。请求保存两套提示词前缀、完整 span 教材上下文和末尾动态批次；动态批次不包含召回轮次、出现频率、旧拒绝项或冻结 gold。响应验证会拒绝遗漏/重复/新增 ID、越界证据、非法合并目标、合并环和重命名冲突，并由程序回填 quote 与来源 SHA-256。低置信或风险标记只进入人工复核队列。

冻结 gold 仅用于响应后的离线评分。元数据记录 gold、前缀、缓存前缀、请求和来源内容哈希，以及真实调用的 usage、cache、trace ID 与耗时。

```bash
python3 scripts/tests/test_knowledge_adjudication_experiment.py
python3 -m py_compile \
  scripts/knowledge-extraction/knowledge_adjudication_experiment.py \
  scripts/tests/test_knowledge_adjudication_experiment.py
```

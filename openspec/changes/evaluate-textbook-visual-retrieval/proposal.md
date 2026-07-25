## Why

当前七套教材来源包含五千余幅插图，标题、图片描述和所属正文已经可以参与文本检索，但框图、响应曲线、根轨迹和频域图可能从视觉嵌入获得额外召回收益。直接为全部图片建立高成本视觉索引缺少项目证据，因此先执行独立、非阻塞实验。

## What Changes

- 按框图、响应曲线、根轨迹、频域图和一般示意图对教材插图分层抽样。
- 使用相同查询分别比较“标题、图片描述和所属正文”的文本嵌入、`Qwen/Qwen3-VL-Embedding-8B` 图像嵌入，以及图像加描述的多模态嵌入。
- 通过与正文检索一致的语义基准和 Recall@10 指标记录成本、延迟、召回增益及失败类型。
- 只有视觉通道产生明确增益时才提出后续全量视觉索引接入；否则保留文本检索和图片片段锚点，不增加生产依赖。
- 本实验不阻塞正文混合检索、引用、阅读器或控灵集成上线。

## Capabilities

### New Capabilities

- `textbook-visual-retrieval-evaluation`: 定义教材插图分层实验、文本/视觉/多模态对照、采用门槛和非阻塞边界。

### Modified Capabilities

<!-- None. A production visual index requires a separate follow-up only if this experiment proves material gain. -->

## Impact

- 新版教材运行态的图片文件、标题、描述、所属结构单元和片段锚点。
- 硅基流动视觉嵌入调用、实验脚本与可复查结果工件。
- 不改变正文检索模型，不在本变更中接入生产视觉索引。

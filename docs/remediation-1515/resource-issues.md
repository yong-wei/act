# Issue #1515 资源（Resource Corpus）侧问题清单

状态：2026-08-23 整理，供后续审核与整改。所有条目均来自本次修复执行的已核实观察。

## R1 三族关系候选 0 项可自动准入（阻断级，与 G5 联动）

- 真实 pending.jsonl 21900 行全部 `PENDING_REVIEW`：containment 的 reason 为 `no-explicit-parent-or-root-evidence`（7300），prerequisite/association 为 `awaiting-qualified-item-evidence`（各 7300）。
- 管线实测：0 行通过 qualified-evidence 门禁；全部进入 15 个域 review packs。
- 整改方向：为 containment 建立"域根 → COURSE_ROOT"的结构性证据源（域包 scope/domain 数据），为 prereq/assoc 建立讲义派生的 qualified evidence registry；否则全部依赖逐行课程所有者裁决。

## R2 后继分母尚未从活动 OSS Runtime Release 正式推导

- 本次执行用 authoring 发现清单（869 文本资源）做处理器验证；正式分母必须从生产活动 OSS Runtime Release v2 的 manifest + 显式增量推导（设计决策 2）。
- 教学资源已迁移 OSS：本地 `course-content/runtime` 是物化视图，不是生产真源。
- 整改方向：实现活动 release manifest 读取与逻辑资源分类重开（任务 1.4 的正式版）。

## R3 教材语料分布在工作树间不一致

- 主工作树 `resources/textbooks/` 6 本（其中 dorf 等经 `.git/info/exclude` 本地排除）；act-resource 工作树仅 2 本（hu-shousong 8th 400K 锚点 + exercise-analysis 89M）。
- 影响：textbook processor（任务族 5.1/5.2）在隔离工作树无法访问全量结构化 v2 语料。
- 整改方向：正式执行批次在主工作树运行，或将结构化锚点清单纳入受管 external-input 清单。

## R4 卡片身份与 Authority 身份两套体系

- 838 张卡片 frontmatter `node_id` 为课程侧中文 id（如 `Bode图_1_1`）；scope 成员为 Authority `ctc:/ctkg:` id。
- 本次 card processor 产出原子的 canonicalKey 用课程侧 id；正式 Canonical 映射（任务 7.1）需要经 crosswalk tier-A（仅 71 精确匹配）或扩课程侧节点（见 G6）。

## R5 Fun-ASR-Nano 未就绪（外部依赖）

- LM Studio 已运行（其他模型在跑），但 Fun-ASR-Nano 模型文件未下载到位、API 无该模型。
- 影响：任务族 4 全部（identity 冻结、hotword 校准/预注册、holdout 资格、ASR 媒体处理）阻塞；无权威讲稿的课程视频/音频/播客 0 处理。
- 注意：intro-video 不依赖 ASR（制作真源），但 Videos importer（任务族 3）尚未实现。

## R6 讲义资源形态待正式定版

- authoring 下 60 个 handout md（33 学生版 + 27 教师版）；denominator 语义下两者是否都算教学资源、教师版是否进后继 release 需课程所有者定版。
- 现有 31 个学生讲义已真实处理（11056 原子中含讲义与卡片）。

## R7 习题与仿真/互动资源处理未开始

- 576 个 governed 习题项的清单位置、registry 与 runtime manifest 的 launcher 真源需先盘点（任务族 6 实现前置）。
- 仿真/互动资源（registry id、版本化配置、launch anchor）同样待盘点。

## 已完成可复用资产（避免重复劳动）

- 文本处理器真实执行通过：869 资源（31 讲义 + 838 卡片）→ 11056 语义原子，处理记录与摘要已落盘（/tmp/remediation-run/text/，正式批次需转存 Git 工件目录）。
- crosswalk-full.json（7300 成员名称）已构建；15 个域 review packs 已生成。
- use-codex 审核证据两批（root-locus 30 裁决；lyapunov 11 accept + nonlinear 全 insufficient）。

## R5a Fun-ASR-Nano 运行时调查结论（2026-08-23，负责人决策请求）

模型本体已就绪：LM Studio 自定义目录 `/Users/YW/LocalLLM/lm-studio-models/mlx-community/Fun-ASR-Nano-2512-fp16`（1.9G，MLX fp16，含独立 lm_head）。已验证的运行事实：

1. **LM Studio 无法加载**：CLI/GPU 加载均报 `Model type funasr not supported`（其引擎不支持 funasr 架构）——LM Studio 路线不可用。
2. **mlx-audio 0.5.0 可加载但转写发散**（全感叹号、解码到 8192 token 上限、language 误判 en）。已定位并修复三处库缺陷后仍未收敛：
   - config.json 的 `llm` 段从未被读取（实现只认 `text_config`）→ embed 维度 2048/1024 错配（strict 加载证实；键名归一化后形状全部匹配）；
   - `Qwen3CausalLM.__call__` 硬编码 tied-embedding logits，而权重 tie=false 带独立 lm_head（已做运行时补丁挂载 untied head）；
   - `encoder`/`adaptor` 段同样键名不匹配（实现期待 `audio_encoder_conf`/`audio_adaptor_conf`），归一化后嵌套字段仍被丢弃（实测 `num_encoders` 读取为 None，encoder 以默认参数构建）。
3. **效率基线**（15 秒中文音频，MLX fp16，Apple Silicon）：处理约 8–40 秒（0.5–0.7× 实时），生成 61–200 tok/s，峰值内存 3.0 GB——速度可用但慢于实时。
4. **能力限制**：mlx-audio convert 注释确认该公开 checkpoint **不含时间戳头**（无词级时间戳）；语义分段+时间锚点需要外部对齐方案（如讲义段落与转写文本的 forced alignment）。
5. **正面发现**：模型提示模板**原生支持热词列表**（`热词列表：[...]`），与讲义派生 wordlist 的接线点明确。

### 待负责人决策（对应 spec 4.10：不得静默替换处理器）

- **选项 1：上游修复等待**。向 mlx-audio 提 issue（config 键名断层 + untied lm_head + encoder 参数丢弃三缺陷，已有本调查的完整证据），等修复后重新验证。
- **选项 2：换用 FunASR 官方 PyTorch runtime**（`pip funasr`，官方支持该模型，含时间戳能力），代价是非 MLX 后端、需重测效率。
- **选项 3：换用 mlx-audio 支持成熟的其他 ASR**（如 qwen3_asr——同库支持列表内，架构相近），重新走 hotword 能力验证。
- 建议：选项 1 与 2 并行（issue 提交 + 官方 runtime 基准确认质量与时间戳，谁先达标用谁）。

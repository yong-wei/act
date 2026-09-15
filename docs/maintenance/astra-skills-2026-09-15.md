# Astra 技能更新与指令修订

日期：2026-09-15。工作基线：`5abec74e083a1da745486b2d66674312b5ccb5f5`。

## 结论

已先获取并比较上游技能，再按官方指导修订更新后的内容及项目指令。当前静态审查未发现本次修改引入的阻断问题。未更改应用代码、数据库、生产发布状态或现有子代理模型；未提交、推送或调用子代理。完整多轮模型行为与 Token 成本尚未做对照实验。

## 依据

- [OpenAI GPT-6 Astra Model Guidance](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-6-astra)
- [Eric Provencher: Rethinking skills and prompts for GPT-6 Astra](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)

两份正文已在前轮完整阅读。修订围绕按需上下文、精确触发、已有授权、验证停止条件及任务范围。模型升级不撤销项目安全和教学边界。

## 上游刷新

| 来源 | 获取基线 | 结果 |
| --- | --- | --- |
| [taste-skill](https://github.com/Leonxlnx/taste-skill) | `ccbc15639c97057cbfcf32ecebc38ef716e4bb37` | 核对 12 个现有技能与其附带文件；大多已一致，部分仅空白差异。上游仍含模拟随机化、固定生图数量和伪造日期要求，采用后再本地修订。 |
| [OpenWolf](https://github.com/cytostack/openwolf) | npm `openwolf@2.5.1` | 更新协议模板；采用 hooks 避免重复记账的改善，再修订无条件读取与历史授权继承。未升级全局 2.0.1 运行时或 hooks。 |
| [code-review-graph](https://github.com/tirth8205/code-review-graph) | `b58668751ab0c7670c078cf7cbd4d1f5b8e54f81` | 更新四个现有图谱技能；保留源码核验与最小输出，去掉固定遍历顺序及通用 5 次调用/800 token 上限。保留 ACT 图形故障经验为按需参考。 |
| [OpenSpec](https://github.com/Fission-AI/OpenSpec) | npm `@fission-ai/openspec@1.13.0` | 从发布包生成六个技能模板，保留新路径、schema、store 与规范退役合同，再修订重复确认。未升级全局 CLI。 |

共获取或核对 25 个上游文件，18 个与原安装字节不同；这一数字包含空白与模板变化，不代表 18 项功能升级。具体来源、上游字节摘要、适配后摘要见 `.agents/skills/upstream-lock.json`。`skills-lock.json` 保留原安装器记录，不作为本地适配后的内容验证。

本机全局 OpenSpec 为 1.6.0，而已有模板存在更高 `generatedBy`。六个新技能使用 `rtk proxy npx --yes --package @fission-ai/openspec@1.13.0 openspec`，从 npm 缓存运行匹配版本。安装失败时报告，不猜测缺失字段；其他项目和 Buddy 的全局 CLI 行为不改变。

## 审查发现与处置

| 发现 | 处置 | 保留的约束 |
| --- | --- | --- |
| 最小充分验证与最终强制全量测试冲突 | ACCEPT：统一为风险和验收驱动，复用未变证据 | TypeScript 提交/推送门禁、实际最终内容覆盖、真实报告 |
| 任何不确定都暂停、每个文件重复询问 | ACCEPT：用户级、OpenSpec 与课程技能按已有授权行动 | 重要目标、兼容性、教学取舍和权限缺口仍需确认 |
| 启动时多份文件争夺“首先读取” | ACCEPT：按任务路由状态、历史与图谱 | 续接时核实当前状态，不相信过期摘要 |
| OpenWolf 手工记账与自动 hooks 重复 | ACCEPT：根据已安装 hooks 判断，取消按编辑次数/普通命令失败记账 | 有证据的根因与交接信息按范围记录 |
| 旧发布命令与跨会话授权混在历史中 | ACCEPT：协议明确历史地位，旧命令条目标为历史参考 | 原记录保留，当前生产与 Runtime 限制不变 |
| 图谱先遍历再读日志/代码 | ACCEPT：按问题选择入口，证据足够即停止 | 动态路径与真实代码/测试仍需核验 |
| 无条件写代理、顾问及多层 reviewer | ACCEPT：按授权、风险和独立收益选择 | 命名角色、权限、写入所有权、有限增量复核 |
| HARNESS 假设 Ponytail hook 总是存在 | ACCEPT：不默认增加模型审查；实际启用门禁继续执行 | 不绕过已安装 hook，不伪造凭据 |
| 多个千行视觉技能与过长触发描述 | ACCEPT：删除通用配方，保留各技能用途与风格，精简发现层 | 现有品牌、内容、可访问性与真实浏览器验证 |
| 固定图片数量、模拟 Python、虚构日期 | ACCEPT：按用户要求与实际缺口生成，删除伪造要求 | 真实执行证据与内容来源 |
| 课程细则每次全部加载 | ACCEPT：六个技能保留短入口，详细合同移至按需参考 | 术语、数值验证、师生隔离、作者态与 runtime、严格接受门禁 |
| 文风固定多轮重写、固定两段等待 | ACCEPT：按实际质量修订，逻辑分批不自动等待 | 内容准确、科学前提和用户要求的阶段接受 |
| 完整师生验收强制双子代理 | ACCEPT：允许主线程用隔离身份执行；子代理须获授权 | 双角色真实证据，不能伪造独立审查或完整放行 |
| 只读远端检查隐式触发清理/发布/激活 | ACCEPT：明确分别授权与冻结提交 | 可恢复性、应用/Runtime 分离及不隐式切换 authority |
| 把所有子代理替换成 Astra | REJECT：没有角色级效果与成本证据，本轮不变更模型 | 现有 21 角色配置与权限 |
| 删除课程设计的人类接受点或降低严格 validator | REJECT：属于明确教学质量边界 | 已接受记录可复用，但不能编造、跳过或以局部检查代替 |
| Buddy 公共策略直接本地修改 | DEFER 到上游 Issue：https://github.com/yong-wei/openspec-buddy/issues/31 | Buddy 源文件与脚本未修改，合并清场与认领门禁不放宽 |

## 文件组织与本机范围

- Git 可跟踪修改：项目 AGENTS、课程 override、技能入口、参考、索引和上游锁。
- 本机用户级文件：`~/.codex/AGENTS.md`；精简协作表述与通用流程，修订澄清和验证规则，保留权限与模型路由。
- 当前被 Git 忽略的本机项目文件：`.codex/agents/README.md`、`ROUTING.md`、`HARNESS.md`、`.wolf/OPENWOLF.md`、`.wolf/cerebrum.md`。这些修改不会自动随普通 Git 提交传播；未强制纳入历史记录。
- 更新前文件、上游原文与 CLI 验证结果保存在本机临时备份目录；位置已在本轮工具结果记录。上游来源和摘要存入仓库，方便以后更新时区分本地适配。
- `.claude/skills` 的既有入口与 Buddy 符号链接保持原状。

38 个技能入口合计由 11,816 行减至 1,655 行，约减少 86%。课程专属细则按需保留在 references；此数字只表示入口文本量，不等于实际 Token 节省比例。

## 验证

- 对 36 个非外部链接技能运行系统 `skill-creator/scripts/quick_validate.py`：36/36 通过；另核对 YAML name 与目录一致。
- `python3 .agents/skills/agent-evolver/scripts/validate_agent_configs.py --root <repo>`：21 个代理、21 个目录项通过，模型和 sandbox 未改变。
- 固定 CLI 1.13.0 在独立临时 Git 仓库运行 `new change`、`status --json`、`instructions proposal --json`：全部成功，status 含 planningHome、changeRoot、artifactPaths 和 actionContext。
- 在实际项目仅运行固定 CLI 的 `context --json`：正确解析项目根；未创建、归档或修改任何真实 OpenSpec change。
- Markdown 链接与来源摘要检查：真实引用可解析；例题中的动态图片路径和省略号示例不作为真实文件链接。
- `git diff --check`：通过。

本次只改指令、文档和元数据，未运行应用全量测试、构建或生产验证。未以静态格式通过声称多轮模型行为已验证。

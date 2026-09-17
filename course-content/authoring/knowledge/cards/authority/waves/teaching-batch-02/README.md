# 第二批知识卡与两批实际消费验收

## 交付结论

**第二批 12 张制作完成；两批共 24 张均进入本地真实消费链路。服务器未发布。**

- 当前课程投影：`proj-64a5187e8e4a7b40ddf566ccd9683ec3cd85629ad8af9bab580c70256fb85fd4`。
- 当前绑定发布：`control-theory-engineering-v0.48-b4`。
- 24/24：当前端点、正文哈希、资源目录可执行、图谱抽屉可打开。
- 24/24：通过生产使用的 planLearningPath 入口生成的路径能包含；场景为未掌握、240 分钟、显式知识卡偏好及偏好匹配路径。
- 24/24：当前工作树独立 Next.js 服务的受保护页面经学生测试账号认证后返回完整正文与自检。
- 数值：首批 33 项、第二批 42 项通过。公式：两批共 584 个行内或块级公式渲染通过。
- 累计退役 27 张旧卡，删除 54 个作者态及运行态旧文件。Git 历史和不可变旧发布保留。

## 第二批卡片

| 序号 | 卡片 | 当前节点 |
|---|---|---|
| 1 | [负反馈回路](../../nodes/ctc_modeling-47e8eb68c1aa5cd068c72e54.md) | `ctc:modeling-47e8eb68c1aa5cd068c72e54` |
| 2 | [一阶系统](../../nodes/ctkg_v3e-canonical-8d825b96ea1a50aab0eb7e6c.md) | `ctkg:v3e-canonical-8d825b96ea1a50aab0eb7e6c` |
| 3 | [阻尼比](../../nodes/ctkg_v3e-canonical-ab642a336bbbbafc6327f6f2.md) | `ctkg:v3e-canonical-ab642a336bbbbafc6327f6f2` |
| 4 | [超调量](../../nodes/ctkg_v3e-canonical-df3167f36376f526f6ec5562.md) | `ctkg:v3e-canonical-df3167f36376f526f6ec5562` |
| 5 | [劳斯表](../../nodes/ctkg_v3e-object-7aa500461c5109b7cffd9b19.md) | `ctkg:v3e-object-7aa500461c5109b7cffd9b19` |
| 6 | [奈奎斯特图](../../nodes/ctkg_v3e-object-763fd65e573e7a65dfc4b79c.md) | `ctkg:v3e-object-763fd65e573e7a65dfc4b79c` |
| 7 | [增益裕度](../../nodes/ctkg_m3-v1i_canonical-object_0aa3a61ec0920c38f4e34c4e.md) | `ctkg:m3-v1i:canonical-object:0aa3a61ec0920c38f4e34c4e` |
| 8 | [零阶保持器](../../nodes/ctkg_domainconcept_289e3beca59c9ef373836b12.md) | `ctkg:domainconcept:289e3beca59c9ef373836b12` |
| 9 | [脉冲传递函数](../../nodes/ctkg_v3e-object-7d3704ae133f6be94bf5991b.md) | `ctkg:v3e-object-7d3704ae133f6be94bf5991b` |
| 10 | [朱利稳定判据](../../nodes/ctkg_domainconcept_28bfca2df331c329cea26464.md) | `ctkg:domainconcept:28bfca2df331c329cea26464` |
| 11 | [可控性](../../nodes/ctkg_v3e-object-133c90435f61b9a83b7d4aaf.md) | `ctkg:v3e-object-133c90435f61b9a83b7d4aaf` |
| 12 | [可观测性](../../nodes/ctkg_v3e-object-5592624b3ec200b86f7b744d.md) | `ctkg:v3e-object-5592624b3ec200b86f7b744d` |

## 实际生成路径覆盖

| 目标 | 两批新卡在实际路径中的覆盖 |
|---|---|
| control-correction | 积分控制器、超前补偿、串联滞后校正 |
| frequency-response-foundations | 伯德图、系统带宽、奈奎斯特图 |
| feedback-loop-concept-foundations | 负反馈回路 |
| transfer-function-modeling-foundations | 传递函数 |
| time-domain-response-analysis | 二阶系统、稳态误差、负反馈回路、一阶系统、阻尼比、超调量 |
| root-locus-analysis-foundations | 根轨迹法、劳斯表 |
| stability-margin-frequency-analysis | 相角裕度、增益裕度 |
| ship-ocean-transfer-application | 负反馈回路 |
| discrete-control-foundations | 零阶保持器、脉冲传递函数、朱利稳定判据 |
| state-space-analysis-foundations | 可控性、可观测性 |
| steady-state-control-foundations | 系统型别、稳态误差、积分控制器、PI控制器、负反馈回路 |

路径覆盖表示在明确测试场景下可被生成与打开；真实学生的时间预算、已掌握知识和偏好仍影响选取，不保证每次路径包含所有卡片。知识卡阅读保持为阅读证据，不充当掌握或测评结果。

## 已处理问题

1. 将旧 B′ 的 2,967 条快照外绑定与 58 条无效卡片索引隔离；新投影和活动绑定的无效端点均为 0。125 个原有绑定但已无有效端点的资源显式不投影。
2. 锚点输入中的快照外 ID 也在重建时排除并记录，防止失效引用再次进入运行态。
3. 重新绑定四个失效目标，扩大合适的基础目标范围；增加离散控制、状态空间、稳态精度与 PI 三个基础目标。
4. 修复运行态复合登记的错误标签计数：作者态、快照及正文为 8,090，运行态副本误为 14,810。只同步副本，严格 Authority 读取重新通过，快照字节未改变。
5. 保留已审中文卡片定义，不再用图谱简略描述覆盖新卡定义。
6. 核实原 3001 服务属于另一工作树；本轮使用当前工作树 3004 独立服务验收。

## 仍待复核

136 个旧 ID 的正式后继语义映射尚未全部确定。原引用保留在 quarantined-bindings.jsonl，不能把隔离称作已完成历史学习事实迁移。当前新卡消费不依赖这些失效引用。

## 工件与复核

- inventory.json 与编号 source.json：身份、内容与来源；退役来源用捕获 Git 修订读取。
- numerical-verification.json：第二批数值验证。
- integration.json：投影与绑定发布、隔离计数及不投影资源。
- consumption-verification.json：24 张的实际生成路径、目录和抽屉验证。
- http-verification.json：24 张真实受保护 Next.js 页面验证；未保存认证值，未执行阅读完成。
- retirement.json：第二批旧卡删除清单与恢复位置。

```bash
rtk proxy python3 course-content/authoring/knowledge/cards/authority/waves/teaching-batch-02/verify-content.py
rtk proxy npx tsx course-content/authoring/knowledge/cards/authority/waves/teaching-batch-02/verify-consumption.ts
rtk proxy npx tsx course-content/authoring/knowledge/cards/authority/waves/teaching-batch-02/verify-http.ts
```

HTTP 验证要求当前工作树服务监听 3004，脚本先检查监听进程的工作目录，再使用既有学生测试账号。视觉布局未逐屏截图验收，页面读取和正文完整性已验证。

本轮未生成配套信息图。

# 首批教学知识卡

> 当前最新交付见 [第二批与两批消费验收](../teaching-batch-02/README.md)。下文保留首批阶段记录。

本批完成 12 张文字卡片，并已接入本地运行态 v0.48-b2。每张卡片包含学习目标、展开解释、计算例、适用条件、自检及关联阅读。配套信息图尚未制作。

## 内容与节点绑定

主绑定来自当前 v0.48 的已审核、已发布 DomainConcept。关联陈述、公式、模型用于组织正文；学习建议不自动成为先修边。

| 序号 | 卡片 | 当前图谱节点 | 现有预设路径可达 |
|---|---|---|---|
| 1 | [传递函数](../../nodes/ctc_modeling-865eb1c8824e157c2f05a903.md) | `ctc:modeling-865eb1c8824e157c2f05a903` | 是 |
| 2 | [二阶系统](../../nodes/ctkg_v3e-canonical-772065f42947b660c72584f3.md) | `ctkg:v3e-canonical-772065f42947b660c72584f3` | 尚未覆盖 |
| 3 | [系统型别](../../nodes/ctkg_v3e-canonical-a781b2b377529226a4c5d077.md) | `ctkg:v3e-canonical-a781b2b377529226a4c5d077` | 尚未覆盖 |
| 4 | [稳态误差](../../nodes/ctkg_v3e-canonical-8d214840417a4c3b5780c715.md) | `ctkg:v3e-canonical-8d214840417a4c3b5780c715` | 尚未覆盖 |
| 5 | [伯德图](../../nodes/ctkg_v3e-canonical-504581e399675b9792ab8502.md) | `ctkg:v3e-canonical-504581e399675b9792ab8502` | 是 |
| 6 | [相角裕度](../../nodes/ctkg_v3e-object-1c159c9cc34ce696a62bf837.md) | `ctkg:v3e-object-1c159c9cc34ce696a62bf837` | 是 |
| 7 | [系统带宽](../../nodes/ctkg_v3e-object-42f4fff2329a29d38cbcd4bc.md) | `ctkg:v3e-object-42f4fff2329a29d38cbcd4bc` | 尚未覆盖 |
| 8 | [积分控制器](../../nodes/ctc_v11g-c8c8aef0d010e68842be7236.md) | `ctc:v11g-c8c8aef0d010e68842be7236` | 尚未覆盖 |
| 9 | [PI控制器](../../nodes/ctkg_v3e-object-68d64f3444ac7af6336f1f81.md) | `ctkg:v3e-object-68d64f3444ac7af6336f1f81` | 尚未覆盖 |
| 10 | [超前补偿](../../nodes/ctkg_v3e-object-83b0bd3fc503270cb174a500.md) | `ctkg:v3e-object-83b0bd3fc503270cb174a500` | 是 |
| 11 | [串联滞后校正](../../nodes/ctkg_v3e-object-f9ac171d68c8622f62106397.md) | `ctkg:v3e-object-f9ac171d68c8622f62106397` | 尚未覆盖 |
| 12 | [根轨迹法](../../nodes/ctc_v11g-e8d4b4f1c63aa5a052b15538.md) | `ctc:v11g-e8d4b4f1c63aa5a052b15538` | 尚未覆盖 |

## 制作说明

- 从当前节点及其一跳关系读取相关概念、公式、条件与方法陈述，再结合现有讲义与旧卡片重新组织。每张卡的来源路径和内容哈希见 inventory.json，具体图谱材料见编号 source.json；退役来源按记录中的 Git revision 读取，不要求旧文件仍在卡库。
- 所有数值例均明确为教学模型，未当作真实船舶参数或工程验收标准。
- 相角裕度与相位裕度、根轨迹法与根轨迹、稳态误差的不同对象均保留当前身份，不按名称相似度增加绑定。
- 串联滞后校正区分固定低频增益与固定高频增益的归一化；PI 卡明确图谱中 I 型变 II 型的陈述依赖原系统；二阶卡限定无零点标准公式的适用范围。

## 验证结论

**12 张新卡的本地运行态接入与 21 张旧卡退役删除通过；完整旧课程投影的历史漂移仍待单独处理。**

- 12/12 张卡通过真实卡片解析器与资源查看器解析；错误正文哈希被拒绝。
- 294 个行内或块级公式通过 KaTeX 渲染检查。
- 33 项数值检查通过，使用 SciPy 的 step、lsim、freqresp 与 NumPy 求根。
- 12/12 个资源在批次候选包中具有精确单节点绑定及 whole 锚点；卡片、资源、节点与内容哈希一致。
- Teaching Projection 与资源绑定构建器的批次门禁通过。门禁中的 PUBLISHED 是构建状态，不表示本批已在线上发布。
- 当前九个预设目标及既有先修关系只使 4 张不同卡片可达：传递函数、伯德图、相角裕度、超前补偿。其余 8 张需在相应目标范围或经审核的教学关系覆盖后，才会被那些路径使用。

### 完整课程集成限制

以当前 v0.48 的 engineering.json 重新验证现有课程投影，发现 136 个不在该快照中的节点引用，产生 2,967 项 canonical-id-unknown 错误；加入本批前后错误数量相同，本批未新增此类错误。详情及代表位置见 verification.json。

批次候选只用于内容验证。当前已通过完整资源绑定包 v0.48-b2 接入本地运行态，不需要重建旧 B′。本地绑定指针已切换；其他选择指针、先修关系、线上资源和学习者状态未修改。

## 工件与复核

- `inventory.json`：当前图谱身份、卡片哈希、旧内容哈希与来源哈希。
- `teaching-input.json`：采用现有 TeachingProjectionAuthoringInput 结构的本批资源与卡片记录。
- `verification.json`：批次候选构建、正文读取、精确绑定及旧课程投影重建阻塞。
- `runtime-verification.json`：12/12 目录可执行、图谱抽屉可打开、21 张旧卡消失、42 文件已删除、9,408 条其他绑定保持一致及现有目标可达性。
- `retirement.json`：旧卡精确清单与 Git 恢复位置。
- `projection-drift.json`：136 个历史节点及引用分类。
- `numerical-verification.json`：与本批卡片哈希绑定的数值结果。
- 候选包位置（仓库根目录下）：`.cache/knowledge-card-batches/teaching-batch-01-9702299e1fd2902b4ea33ea9ce5d31662b6f2221fc3cc751c723923d8dc7a799`。该目录为本地可再生工件，未激活。

在仓库根目录复核：

```bash
rtk proxy python3 course-content/authoring/knowledge/cards/authority/waves/teaching-batch-01/verify-content.py
rtk proxy npx tsx course-content/authoring/knowledge/cards/authority/waves/teaching-batch-01/build-candidate.ts
rtk proxy npx tsx course-content/authoring/knowledge/cards/authority/waves/teaching-batch-01/verify-runtime.ts
```

## 后续信息图依据

| 卡片组 | 图解重点 |
|---|---|
| 传递函数、根轨迹法、二阶系统 | 输入输出、特征方程、极点与响应的对应 |
| 系统型别、稳态误差、积分、PI | 输入类别、误差通道、积分状态与动态代价 |
| 伯德图、相角裕度、系统带宽 | 同频读数、开环与闭环频率指标的区别 |
| 超前补偿、串联滞后校正 | 零极点位置、增益归一化、相位变化与设计复核 |

图中只使用已核验公式与例子。沿用本批精确节点身份，图片独立登记为 infographic 资源；旧图是否可复用需逐张视觉核验。

## 本轮交付补充

- 定向 TypeScript 测试 43 项、Python 测试 7 项通过；33 项数值验证及 294 个公式渲染检查通过。生产 web/worker 类型检查、定向 ESLint 与 OpenSpec 严格验证通过。
- 已调用真实资源目录构建器和图谱抽屉解析器，12 张新卡均可执行、可推荐，21 张旧卡不再出现在当前卡片目录。
- 浏览器访问本地页面时需要登录，本轮未完成登录后的视觉验收；上述结论来自真实读取链与自动验证，不作为线上部署完成的证明。
- [下一批计划及路径问题说明](NEXT-BATCH-PLAN.md)。

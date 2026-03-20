建议采用“底座不动，课次增量覆盖”的组织方式。

  结论
  最适合当前阶段的形式是三层：

  1. knowledge_graph.json 继续作为全局稳定底座，不改现有主结构
  2. 每个课次单独维护一个“知识增量包”，只描述该课新增/引用了哪些节点、关系、卡片
  3. 在课程实现时做一次“解析合并”，生成该课可消费的课内知识清单，而不是直接改写全局图谱

  这样最稳，因为你现在仓库里的底座结构已经很清楚：

  - data/knowledge_graph.json 是 nodes(dict) + relations(list) + metadata(dict)
  - 外部设计项目已经天然是增量形式：new_nodes.jsonl、new_relations.jsonl
  - 这两者是兼容的，没必要现在就推翻底座

  知识点组织建议
  我推荐把课程制作项目里的知识图谱资源按“课次包”组织，而不是继续只放两个全局增量文件。

  推荐结构：

  data/
    lessons/
      L-2a/
        manifest.json
        nodes.jsonl
        relations.jsonl
        card_refs.json
      L-2b/
        manifest.json
        nodes.jsonl
        relations.jsonl
        card_refs.json

  其中：

  - nodes.jsonl：只放本课新增节点
  - relations.jsonl：只放本课新增关系
  - manifest.json：描述“本课实际要植入互动课程的知识范围”
  - card_refs.json：列出本课要显示哪些知识卡片，以及顺序/分组

  manifest.json 最重要，建议至少包含：

  - lesson_id
  - title
  - focus_node_ids
  - focus_relation_ids 或筛选规则
  - reuse_node_ids
  - entry_nodes
  - summary_nodes
  - card_order
  - graph_version

  这样互动课程实现时，我不需要自己猜“这一课到底该取哪些点”，而是直接按 manifest 取。

  为什么不建议只靠 new_nodes.jsonl / new_relations.jsonl
  因为它们更像“录入日志”，不太像“课程消费清单”。

  对实现来说，真正需要的是：

  - 哪些节点要在知识图谱页高亮
  - 哪些节点要在步骤 01 出现
  - 哪些节点要在步骤 18 回收
  - 哪些节点要配知识卡片
  - 哪些关系是本课真正要讲的主链路

  这些信息如果只靠全局 JSONL 推断，会越来越脆。

  关系数据的一个关键建议
  你现在 new_relations.jsonl 的 source/target 用的是中文名，不够稳。
  建议尽快改成“双写”：

  {
    "source_id": "阻尼比_3_b849784e",
    "source": "阻尼比",
    "target_id": "超调量_3_xxxxxxxx",
    "target": "超调量",
    "relation_type": "leads_to",
    "label": "ζ决定Mₚ，ζ越大Mₚ越小"
  }

  原因很直接：

  - 页面实现、卡片绑定、图谱高亮，技术上都更适合用稳定 ID
  - 名称以后可能改写，但 ID 不应漂移
  - 当前仓库底座的 nodes 已经是按 id 存的，关系层最好也尽快跟上

  这是我最建议优先修的一点。

  最方便互动课程植入的消费模型
  对每一课，最好不要直接“查全图再筛”。
  而是形成一个课次级的可消费对象，逻辑上类似：

  type LessonKnowledgeBundle = {
    lessonId: string;
    focusNodes: Node[];
    focusRelations: Relation[];
    reusedNodes: Node[];
    cards: CardMeta[];
    mapConfig: {
      highlightedNodeIds: string[];
      entryNodeIds: string[];
      summaryNodeIds: string[];
    };
  };

  这样互动课程页面就能直接消费：

  - 知识图谱页：highlightedNodeIds
  - 步骤内知识卡片：cards
  - 总结页：summaryNodeIds
  - 关系演示页：focusRelations

  也就是说，课页消费“课次包”，不是直接消费“全量图谱”。

  知识卡片最适合的存储方式
  我不建议只按中文文件名平铺在 data/cards/ 下长期发展。短期可用，批量制作会越来越难维护。

  更适合批量课程制作的是“两层结构”：

  data/
    cards/
      nodes/
        阶跃响应_10_47ad4df2.md
        阻尼比_3_b849784e.md
        自然频率_3_xxxxxxxx.md
      lessons/
        L-2a/
          sequence.json
          overrides.json

  其中：

  - nodes/ 是“规范卡片库”，一张卡对一个知识点
  - 文件名用 node_id.md，不要只用中文名
  - lessons/L-2a/sequence.json 只负责定义本课卡片顺序、分组、出现场景
  - overrides.json 用于本课专属改写，比如某张卡在 L-2a 要用更口语化版本

  这是最利于批量制作的，因为：

  - 卡片正文复用
  - 课次只做编排
  - 后续一门课复用旧节点时，不必再复制卡片
  - 本课如需特殊表达，只做 override，不污染全局卡库

  卡片文件本身建议带 frontmatter
  每张卡最好有稳定元数据，而不只是正文。建议至少有：

  ---
  node_id: 阶跃响应_10_47ad4df2
  name: 阶跃响应
  lesson_units:
    - L-2a
  category: 概念性
  knowledge_type: X
  chapter: 3
  tags:
    - 层0速通
    - 时域分析
  card_version: 1
  source_docs:
    - notes/lessons/L-2a/handout.md
  asset_refs:
    - /course-media/L-2a/step-02-ship-response.png
  ---

  # 阶跃响应
  ...

  这样后面做批处理时很方便：

  - 能按 node_id 精确绑定图谱节点
  - 能按 lesson_units 反查哪些课程用了它
  - 能按 asset_refs 自动检查媒体是否缺失
  - 能按 source_docs 回溯设计来源

  我的推荐方案
  如果只选一个方向，我建议你用这个组合：

  - 全局底座继续保持：data/knowledge_graph.json
  - 外部设计项目改为课次分包：data/lessons/<lesson>/{manifest,nodes,relations}
  - 卡片改为“全局节点卡库 + 课次编排层”：
      - data/cards/nodes/<node_id>.md
      - data/cards/lessons/<lesson>/sequence.json

  这是对当前系统最友好的做法，因为：

  - 不破坏现有图谱架构
  - 兼容你现在的 new_nodes.jsonl / new_relations.jsonl 思路
  - 最方便我在实现互动课程时精确取数
  - 最适合后续批量做课和升级到增强格式

  一句话总结
  图谱层用“全局底座 + 课次增量包”，卡片层用“全局节点卡库 + 课次编排清单”，是当前最稳、最易批量化、也最利于互动课程落
  地的组织形式。
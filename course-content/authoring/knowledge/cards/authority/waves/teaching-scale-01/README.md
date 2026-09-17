# 大规模制作第一子批次：16张已接入

> 本目录保留40张、v0.48-b5阶段证据。最新累计48张、v0.48-b6验收见 ../teaching-scale-01b/README.md。

## 交付结论

16张新卡已通过独立内容审核和整改复核，接入本地v0.48-b5。加上既有24张，累计40张均有实际消费证据。未发布服务器。

- 40/40：精确当前节点、作者态/runtime正文哈希、资源目录可执行与图谱资源读取。
- 40/40：通过真实planLearningPath入口生成路径可包含；39张在未掌握基础场景覆盖，超调量另在已掌握其他知识的补缺场景覆盖。
- 40/40：学生测试账号访问实际Next受保护资源页面，返回完整解释与自检。
- 浏览器：新版图谱→系统建模→增益→资源查看器，实际显示新正文与核对要点。截图见graph-card-browser.png；未逐卡做视觉截图。
- 762个公式渲染通过。1003项作者检查包含身份、来源、结构与数值，不是1003个数值算例。
- 本子批次退役3张旧卡、删除6个作者态/runtime旧文件；累计退役30张、删除60文件，恢复副本和清单保留。

## 本子批次卡片

| 卡片 | 当前节点 |
|---|---|
| 微分方程模型 | `ctc:90af7a0497e616bbe6249c30` |
| 增益 | `ctc:modeling-00d2998755974a1329049aac` |
| 拉普拉斯反变换 | `ctc:modeling-05fbe60f54c183c4e3ded892` |
| 动态控制系统 | `ctc:modeling-8aa475ed6514adc11f9b5c8d` |
| 复频域传递函数 | `ctc:modeling-aa10e4daa1e969c557f6ef83` |
| 运算放大器积分器 | `ctc:modeling-b2fd214ec64665147e16ff9d` |
| 滞后补偿 | `ctc:v11g-21fba199a9fdef15887d600f` |
| 时间延迟 | `ctc:v11g-caa20b325717f0a3c570f16b` |
| 未建模动态 | `ctkg:domainconcept:9b4e79193b3701a9657113eb` |
| 相位裕度 | `ctkg:m3-v1i:canonical-object:44ba9f502d62725bda3f150c` |
| 帕德近似 | `ctkg:m3-v1k:canonical-object:39ac7c77fc6c62d14466a017` |
| 时延 | `ctkg:m3-v1l:canonical-object:9536bb480a03e3193e6e88d2` |
| 部分分式展开的覆盖法 | `ctkg:v3e-canonical-060bc33f21e93205ee271eda` |
| 误差信号 | `ctkg:v3e-canonical-e22de9c6670a15c39d8e6b71` |
| 傅里叶系数 | `ctkg:v3e-object-58d24ff14a6b0b0cab5d393f` |
| 相频特性 | `ctkg:v3e-object-9967c0867249bf4c1a625dab` |

## 审核与修复

content-review.md记录独立逐卡审核。4项教学问题（微分方程算例、系统边界、未建模动态表示、傅里叶单双边幅值）均整改并独立复核通过；review-acceptance.json固定最终正文哈希。

integration-review.md记录接入脚本的两项独立finding及裁决。审核集合、批次范围和摘要已固定；接入中断及删除中断可续作，漂移会拒绝继续。最后一次范围固化由主线程以反例测试验证，未另作第三轮独立复审。

## 路径目标调整

7张虽在候选范围内却未在实际路径出现。补充现有目标成员：动态控制系统→反馈基础；复频域传递函数→传函建模；反变换和覆盖法→时域分析；傅里叶系数→频率响应；相位裕度→稳定裕度；帕德近似→船舶与海洋应用。没有新增工程先修边，没有增加路径步数上限，没有写入学习者事实。

## 后续范围

原第一阶段67张中仍有51张未完成，浅初稿保存在drafts并标记draft，原作者态文件已恢复，未进入替代登记。下一子批次8张在teaching-scale-01b制作。

其余252个核心节点已分为29个主题组；专业扩展已筛选115个当前已发布概念。当前总清单458张，已接入40张，尚余418张（其中专业扩展还需来源和教学适用性复核）。不得把候选数量当作已完成覆盖。

## 证据

- inventory.json、accepted-scope.json：本子批次内容和固定范围；scope.json保留原67张阶段清单。
- review-acceptance.json、content-review.md：独立内容结论与哈希。
- integration.json：当前projection与binding身份；retirement.json：恢复清单。
- consumption-verification.json、http-verification.json、browser-verification.json：实际消费。
- numerical-verification.json：作者态混合检查。

历史批次脚本与凭证保留原版本，不代表后续新指针；本目录验证范围为当时40张，最新总体验证见teaching-scale-01b。

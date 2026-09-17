# 大规模制作第二子批次与累计48张验收

## 交付结论

本子批8张作者内容独立审核、整改复核通过，已接入本地v0.48-b6。本轮两子批共新增24张（16+8），连同既有24张，累计48张均可实际消费。服务器未发布。

- 48/48：当前Canonical端点、正文hash、资源目录可执行、图谱节点资源可读取。
- 48/48：实际planLearningPath入口生成的ready路径可包含；47张在无掌握场景覆盖，超调量使用已掌握其他知识的补缺场景覆盖。全部路径不超过12步。
- 48/48：学生测试账号访问实际Next受保护资源页面，返回完整正文、自检与核对要点。
- 浏览器：新版图谱→系统建模→数学模型→资源查看器，显示新版正文和自检。前子批另有增益的浏览器证据；未逐卡做视觉截图。
- 998个公式渲染通过。本子批作者检查354项，其中39项数值检查，236个公式和8卡临时runtime解析通过。
- 本子批退役2张旧卡、删除4文件；本轮累计退役5张、删除10文件；连同既有批次共退役32张、删除64文件。恢复副本及哈希清单保留。

## 8张新卡

| 卡片 | 当前节点 |
|---|---|
| 数学模型 | `ctc:modeling-7734a0845c335f160395bac0` |
| 常系数线性定常系统 | `ctc:modeling-c26fddc50074ec84707d5950` |
| 反馈控制系统 | `ctkg:domainconcept:27b69e7f2e837fd62dc31379` |
| 扰动抑制 | `ctkg:domainconcept:42146fa04dc1459716346cc7` |
| 参数不确定性 | `ctkg:domainconcept:4eaa0995db3f87d3b7e0f117` |
| 闭环系统 | `ctkg:domainconcept:fef4835248def04a043183ee` |
| 终值定理法求稳态误差 | `ctkg:v3e-canonical-01549ef9b34888b89b55f224` |
| 单边拉普拉斯变换 | `ctkg:v3e-canonical-04fd7f69994f8821467462e5` |

## 审核结论

独立初审发现3项P1：非零初态下的叠加条件、非单位反馈误差通道遗漏H、终值定理斜坡表达式错误。主线程从原模型修复并补充反例；独立限定复核确认全部关闭，未发现新的P0/P1。最终正文hash见review-acceptance.json，完整裁决见content-review.md。

本轮两个子批共修复7项教学问题。接入脚本独立审核与恢复测试见前子批integration-review.md；最后的批次范围固化由主线程反例验证，未再进行第三轮独立复审。

## 路径修正

本子批数学模型补入传函建模目标，终值定理法求稳态误差补入稳态控制基础目标。前子批另补7个合适目标成员。目标仍为12个，没有修改Authority、增添工程先修边、增大路径步数上限或写入学生事实。

## 后续制作范围

当前总清单458张，已接入48张，尚余410张：第一阶段剩余43张、其余课程核心252张、专业扩展候选115张。专业扩展仅完成身份筛选，还需来源和教学适用性复核。

下一主题子批为静态误差系数法、终值定理、稳态性能、单位阶跃响应、位置误差常数、单位阶跃函数、单位斜坡函数、速度误差系数。后续采用6—8张主题子批，原模型独立验算及逐卡审核后才接入。

## 证据与复核

- inventory.json、scope.json、accepted-scope.json：本子批完整清单、来源与字节。
- review-acceptance.json、content-review.md：独立内容审核。
- integration.json、retirement.json：本地接入身份与旧卡恢复记录。
- consumption-verification.json：48张目录、图谱与实际路径。
- http-verification.json、browser-verification.json、graph-card-browser.png：受保护页面与浏览器。
- numerical-verification.json：作者态检查。

历史子批保持其捕获范围与凭证。teaching-scale-01/inventory.json中的remaining是当时51张草稿清单，最新剩余量以OpenSpec production-progress.json为准。

## 最终验证

生产Web与Worker类型检查通过；目标与路径相关2个测试文件、13个测试通过；目标及批次脚本ESLint通过；OpenSpec本变更严格验证与git diff --check通过。

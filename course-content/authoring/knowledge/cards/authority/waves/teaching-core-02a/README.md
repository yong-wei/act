# 物理对象与互连建模八卡

八张作者卡已完成，当前 v0.48 canonical 身份与来源逐项绑定。独立领域审核 PASS，已接入本地运行态。

固定教学模型先于正文验算，原始方程、解析解和频域结果见 verify-models.py。内容验证通过：8 张实际 parser 回读、149 个 KaTeX 公式、来源 SHA、真实邻域关系与教学结构，合计 403 项检查。七张有旧作者卡备份，传感器节点原无作者卡，只保留两项真实 Authority 来源。

verify-author-markdown.ts 在临时目录通过正式卡片读取器及 ReactMarkdown/remark-math/rehype-katex，验证本批与前批共 14 张显示正文，无数学错误且自检内容可见；未写运行态。

独立审核者 /root/review_core_modeling_fourteen 对两批分别给出 PASS，无 P0/P1；接受字节见 review-acceptance.json。

## 本地接入验收

已激活 control-theory-engineering-v0.48-b14，累计 105 张全部通过可执行卡、图谱检查器、实际生成路径选入、受保护页面与 Markdown 数学渲染。浏览器验证系统建模领域到本批卡片、自检，主线程已检查截图。Authority 快照和先修关系不变，未写入学习事实，未发布服务器。

相关验证：16项目标/路径/选项测试、2项目标注册与动态目标边界测试、web/worker类型检查、相关ESLint及OpenSpec strict通过。新增两目标的独立实现审核 PASS，见 goal-registration-review.md。

# 多行数学展示修复

真实路径：author/runtime Markdown → readPublishedLearnerCardByToken → cleanLearningText → KnowledgeCard的ReactMarkdown/remarkMath/rehypeKatex。

劳斯卡的多行数组使用同一行的$$与begin/end表达式；原始LaTeX语法有效，原始KaTeX检查通过，但Markdown把开头表达式当fence信息，终止标记也未被识别，吞入后续正文并显示katex-error。根因不是数组数学内容，也不是哈希漂移。

修复只对展示字段内包含换行的$$块建立独立分隔行，inline与单行内容保留。原始字节哈希在解析前验证，不改已审文件或绑定。新增公共读取入口到真实Markdown渲染链的回归，修前1失败2通过，修后3通过；连同呈现测试5通过。

独立 independent-reviewer `/root/review_card_math_fix` 限定审核新增规范化与新测试，结论PASS，无P0/P1或当前验收P2。没有要求重复全量复审。

累计验证现要求每张解析后摘要和解释在真实Markdown/KaTeX链无katex-error；HTTP与浏览器也检查错误元素。最终71张通过，截图显示劳斯表及自检完整可读。

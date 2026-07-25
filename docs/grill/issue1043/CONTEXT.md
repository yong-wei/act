# issue1043 领域语言

## evidence-link（证据链接）
知识图谱资源面板底部"查看关联课次证据"或"进入证据浏览器"按钮生成的链接。它指向 `/profile/evidence` 路由，携带可选的 `lessonId` 和 `node` 参数。

## knowledge-back-navigation（知识节点回退导航）
从 `/profile/evidence` 页返回到知识图谱具体知识节点的导航能力。由 URL 参数 `node` 驱动，证据页读取后将其设为 `backHref` 的目标。

## new-tab-evidence（新标签页证据）
证据链接使用 `<a target="_blank" rel="noopener noreferrer">` 打开新标签页的行为设计。目的是保留原始知识点详情页不被覆盖，用户查看完证据后仅需切换标签页即可继续原上下文。`rel="noopener noreferrer"` 确保新标签页无法通过 `window.opener` 访问原页面，消除安全风险。

## return-to-learning-path（返回当前知识路径）
知识图谱资源面板内的另一个链接，其 `href` 为 `/knowledge?node=<当前节点ID>`，指向在同一页面内跳转到知识图谱并选中该节点。与 `evidence-link` 的区别：`return-to-learning-path` 在当前页跳转（同标签页），而 `evidence-link` 在新标签页打开。

## review-evidence（审阅证据）
`data-resource-node-action` 属性的取值，用于标识"查看关联课次证据"按钮。测试代码通过此属性选择器验证证据链接的存在性。

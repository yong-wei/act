## ADDED Requirements

### Requirement: 运行时镜像打包密封语言资格包

运行时镜像 SHALL 携带已注册 composite release 的密封语言资格包（`course-content/authoring/knowledge/cutover/envelopes/locale-manifests/`），使活跃 release 的语言资格在容器内可核验。资格包在构建上下文缺失时，镜像构建 MUST 失败，不得产出静默回退 historical locale 模式的镜像。

#### Scenario: 容器内资格包可核验

- **WHEN** 生产容器运行且活跃 Authority release 在 composite registry 中存在已合格条目
- **THEN** 语言资格核验在容器内读取密封资格包并完成 digest 校验
- **AND** 不因资格包缺失回退为 historical locale 模式

#### Scenario: 资格包缺失时构建失败

- **WHEN** 构建运行时镜像且构建上下文缺少已注册 composite release 的密封资格包
- **THEN** 构建断言失败，不产出缺包镜像

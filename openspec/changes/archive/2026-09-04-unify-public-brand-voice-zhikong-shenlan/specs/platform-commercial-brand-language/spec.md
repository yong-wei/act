## ADDED Requirements

### Requirement: 对外主品牌名统一为智控深蓝

所有用户可见的对外表面（登录与认证壳、导航、页面标题与 meta 描述、邮件模板）SHALL 以「智控深蓝」作为唯一主品牌名。旧品牌串「AI-OBE船舶智控平台」与「Mission Control for Maritime Education」MUST NOT 出现在登录页、导航或主入口文案中；「AI-OBE」如需保留 SHALL 仅作为关于页或文档语境的产品线副文案。

#### Scenario: 登录页显示统一主品牌

- **WHEN** 未登录用户打开 `/login`
- **THEN** 品牌区显示「智控深蓝」
- **AND** 页面不出现「AI-OBE船舶智控平台」或「Mission Control for Maritime Education」

#### Scenario: 站点元数据使用主品牌表述

- **WHEN** 检查首页与登录页的 `<title>` 与 meta description
- **THEN** 品牌表述与「智控深蓝」一致，不含旧产品线品牌串

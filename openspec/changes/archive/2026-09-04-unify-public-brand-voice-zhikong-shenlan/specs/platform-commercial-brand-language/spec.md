## MODIFIED Requirements

### Requirement: Deep Blue homepage lockup uses governed brand assets
The platform SHALL use the “智控深蓝” identity as the homepage primary brand lockup, paired with the platform description “基于学科垂类大模型的船舶智控教学平台”. Homepage scenarios that previously named “深蓝智控” SHALL use “智控深蓝”.

## ADDED Requirements

### Requirement: 对外主品牌名统一为智控深蓝

所有用户可见的对外表面（登录与认证壳、导航、页面标题与 meta 描述、邮件模板）SHALL 以「智控深蓝」作为唯一主品牌名。旧品牌串「AI-OBE船舶智控平台」与「Mission Control for Maritime Education」MUST NOT 出现在登录页、导航或主入口文案中。「AI-OBE」可作为控灵等产品线/技术副文案，或出现在关于页与文档语境，但 MUST NOT 作为站点主品牌。

#### Scenario: 登录页显示统一主品牌

- **WHEN** 未登录用户打开 `/login`
- **THEN** 品牌区显示「智控深蓝」
- **AND** 页面不出现「AI-OBE船舶智控平台」或「Mission Control for Maritime Education」

#### Scenario: 站点元数据使用主品牌表述

- **WHEN** 检查首页与登录页的 `<title>` 与 meta description
- **THEN** 品牌表述与「智控深蓝」一致，不含旧产品线品牌串

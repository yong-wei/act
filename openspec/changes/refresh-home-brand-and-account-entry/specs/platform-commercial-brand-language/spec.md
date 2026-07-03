## ADDED Requirements

### Requirement: Deep Blue homepage lockup uses governed brand assets
The platform SHALL use the “深蓝智控” identity as the homepage primary brand lockup, paired with the platform description “基于学科垂类大模型的船舶智控教学平台”.

#### Scenario: Homepage brand renders
- **WHEN** the homepage topbar renders
- **THEN** it SHALL show a governed “深蓝智控” calligraphic art logo and the Chinese platform description
- **AND** it SHALL NOT show the legacy “AI-OBE船舶智控平台 / Mission Control for Maritime Education” lockup.

#### Scenario: Brand logo asset is created
- **WHEN** the “深蓝智控” logo asset is introduced
- **THEN** it SHALL be generated with the image2 model
- **AND** the generated source asset and metadata SHALL be stored under `public/assets/platform-brand/`
- **AND** the asset metadata SHALL record intended usage, prompt summary, model family, light/dark treatment, fallback behavior, and owning change.

#### Scenario: Homepage consumes the brand asset
- **WHEN** homepage code renders the “深蓝智控” lockup
- **THEN** it SHALL consume the governed asset through a shared platform brand lockup/component or helper
- **AND** it SHALL NOT scatter page-local image paths or duplicate brand lockup markup that cannot be reused by login, shell, or report surfaces.

#### Scenario: Brand lockup is reviewed
- **WHEN** homepage visual QA runs
- **THEN** the logo, subtitle, personal-center action, and theme switch SHALL remain legible at desktop and 320px mobile widths in supported themes.

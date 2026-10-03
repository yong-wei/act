## Purpose

将当前生产 Runtime 中已经允许浏览器读取的固定教学媒体，以经过资格验证的不可变分发副本交付到 ESA，支持共享缓存、精确内容身份和受控生产切换，同时保持内部数据与源站权限隔离。

## ADDED Requirements

### Requirement: Public media inventory binds the captured production source
The publication inventory SHALL bind one captured active Runtime v2 manifest and its digest. It SHALL include only browser-deliverable lesson audio, video, images and PDFs, textbook asset images, and accepted infographs. Infograph eligibility SHALL be established from the governed runtime manifests and exact content digest. Internal manifests, resource governance, retrieval indexes, student data and arbitrary object keys MUST NOT enter the public inventory.

#### Scenario: Eligible public media is captured
- **WHEN** a source is present in the captured Runtime and its public path, media type and applicable review identity all validate
- **THEN** the inventory SHALL bind its exact source digest, size, media type and immutable destination key

#### Scenario: Internal or unqualified data is encountered
- **WHEN** an object is private governance data, a retrieval index, an unaccepted infograph or has a mismatched digest
- **THEN** the inventory SHALL exclude or reject it without publishing any bytes

### Requirement: Public copies and completion evidence are immutable
The publisher SHALL copy only inventoried bytes to the isolated public teaching-media prefix, forbid overwrite, and set accurate media types and immutable cache metadata. The OSS origin SHALL remain private. The terminal verified delivery index SHALL exist only after the complete included object set passes publication verification; interruption SHALL not enable production routing.

#### Scenario: Publication completes
- **WHEN** every included object has the expected size and digest identity and every media class passes ESA transport verification
- **THEN** the publisher SHALL emit a complete verified index that can be enabled independently from Runtime activation

#### Scenario: Publication is partial or an existing object differs
- **WHEN** a declared object is absent, conflicting or fails verification
- **THEN** production routing SHALL remain on the existing source and the publisher SHALL not overwrite conflicting bytes

### Requirement: Delivery routing preserves exact source identity and fallback
Only an enabled, verified public media index SHALL cause an existing asset entrance to redirect to an immutable ESA URL. Ordinary path delivery SHALL match the active Runtime identity; fixed-version resource delivery SHALL use the exact verified content digest. Missing, malformed or ineligible indexes and unpublished objects SHALL retain existing delivery behavior. Disabling the delivery index SHALL restore the existing delivery path without changing Runtime, graph, classroom or database state.

#### Scenario: A fixed classroom resource has already published bytes
- **WHEN** a captured classroom resource resolves to a digest present in the verified delivery index
- **THEN** its redirect SHALL identify those exact bytes regardless of subsequent active Runtime changes

#### Scenario: Active content changes or an index is disabled
- **WHEN** an ordinary path no longer matches the captured Runtime or its bytes are not qualified for ESA
- **THEN** the application SHALL use the existing current or pinned source instead of returning old same-path content

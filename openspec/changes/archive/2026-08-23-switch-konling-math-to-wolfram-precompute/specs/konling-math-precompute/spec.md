## Purpose

定义控灵在语言模型生成回答前识别数学请求、执行受治理符号计算并注入可信结果的服务端预计算行为，避免模型工具调用造成挂起。

## ADDED Requirements

### Requirement: Konling precomputes supported math requests before model generation
The system SHALL detect supported formula-derivation requests from the latest user message, infer one of the governed calculation operations, and execute the shared calculator before starting model generation.

#### Scenario: Supported request is precomputed
- **WHEN** the latest user message contains a supported operation keyword and an extractable expression
- **THEN** the system SHALL call the shared calculator with the inferred operation and normalized expression
- **AND** SHALL inject the successful result and ordered steps into the model context as trusted server-computed evidence.

#### Scenario: Request is not a supported calculation
- **WHEN** the latest user message does not contain a supported operation keyword or extractable expression
- **THEN** the system SHALL continue normal question answering without invoking the calculator.

#### Scenario: Precomputation cannot produce a result
- **WHEN** expression extraction, validation, runtime availability, or calculation fails
- **THEN** the system SHALL fall back to normal question answering
- **AND** SHALL NOT expose private runtime details to the user or model context.

### Requirement: Konling does not expose calculate to the language model
The system SHALL remove `calculate` from every AI chat request tool set because mathematics is handled by server-side precomputation.

#### Scenario: Math request reaches model generation
- **WHEN** a supported math request has been precomputed
- **THEN** the model request SHALL contain the trusted precomputed context
- **AND** SHALL NOT include the `calculate` tool.
#### Scenario: Ordinary request reaches model generation
- **WHEN** the request is not precomputed
- **THEN** the model request SHALL preserve other authorized tools and normal behavior
- **AND** SHALL NOT include the `calculate` tool.

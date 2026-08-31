# siliconflow-structured-output Specification

## Purpose
TBD - created by archiving change fix-siliconflow-json-schema-constrained-output. Update Purpose after archive.
## Requirements
### Requirement: Governed structured requests use constrained JSON decoding on toggle-whitelisted models

For models in the SiliconFlow thinking-toggle whitelist, the adapter SHALL upgrade an outgoing chat request carrying `response_format: {"type": "json_object"}` to `response_format: {"type": "json_schema", "json_schema": {"name": "governed_output", "schema": <extracted>, "strict": false}}` when the last user message content ends with the governed JSON Schema marker emitted by the structured provider runtime and the trailing schema text parses as JSON. The upgrade SHALL fail open: when the model is not whitelisted, the request carries no `json_object` response format, the marker is absent, or the trailing schema text does not parse, the adapter SHALL forward the request unchanged. The existing `enable_thinking` injection SHALL remain unaffected.

#### Scenario: Governed structured request is upgraded

- **WHEN** a whitelisted model receives a structured request with `json_object` and a trailing governed JSON Schema marker that parses
- **THEN** the outgoing request SHALL carry `json_schema` constrained decoding with `strict: false`
- **AND** the model's output SHALL no longer inflate past the output budget and truncate.

#### Scenario: Marker missing or malformed fails open

- **WHEN** the request has no `json_object` response format, or the last user content lacks the governed marker, or the trailing schema text fails to parse as JSON
- **THEN** the adapter SHALL forward the request unchanged
- **AND** non-whitelisted models SHALL keep the original response format.

#### Scenario: Text-JSON fallback stays untouched

- **WHEN** the fallback path issues a plain text request without `response_format`
- **THEN** the adapter SHALL NOT add any response format to that request.


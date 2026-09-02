# konling-study-question-structure-contract Specification

## Purpose
Define the six-intent study-question output contract, semantic heading aliases, and deterministic structure scoring for Konling generic-chat answers.
## Requirements
### Requirement: Study-question structure is an explicit output contract
Konling SHALL tell the model to answer generic-chat study questions in the required sections for the resolved intent. Canonical titles and documented semantic aliases are valid headings. Presentation preferences SHALL NOT drop a required section. The structure contract SHALL take precedence over the generic short-answer length limit.

#### Scenario: A formula derivation is requested
- **WHEN** the resolved intent is formula derivation
- **THEN** the prompt SHALL require sections covering assumptions or symbols, material transformations, applicable conditions, and a result check

#### Scenario: A learner asks for a concise or table answer
- **WHEN** depth is concise or format is table, steps, or guided hints
- **THEN** the prompt SHALL still require every section of the resolved intent

### Requirement: Structure scoring accepts semantic headings and rejects unstructured prose
A deterministic scorer SHALL treat a required section as present only when a heading line matches the canonical title or an alias and the section body is non-empty. A long answer that merely mentions the titles inline without section headings SHALL fail.

#### Scenario: Semantic equivalent headings are used
- **WHEN** an answer uses documented aliases such as 假设与符号 for 前提与符号
- **THEN** the scorer SHALL count those sections as present

#### Scenario: Unstructured long text mentions the titles
- **WHEN** an answer is a single paragraph that contains the required title strings but has no heading lines
- **THEN** the scorer SHALL not mark the structure as passing

#### Scenario: Short list items remain section bodies
- **WHEN** an answer uses Markdown or bold headings and a section body is a short numbered or bullet list that does not equal a required title or alias
- **THEN** the scorer SHALL keep those list items as body text and SHALL count the section as present

### Requirement: Each study intent has a frozen structure regression
Automatic tests SHALL cover all six study intents with at least one passing semantically structured answer and one failing unstructured answer.

#### Scenario: The frozen structure fixtures are evaluated
- **WHEN** the structure-contract tests run
- **THEN** every study intent SHALL have a non-zero pass on its valid fixture
- **AND** the pass rate on valid fixtures SHALL be at least 80%
- **AND** unstructured fixtures SHALL fail


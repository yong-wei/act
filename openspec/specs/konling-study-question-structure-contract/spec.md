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
A deterministic scorer SHALL treat a required section as present only when a heading line matches the canonical title or an alias and the section body is non-empty. A long answer that merely mentions the titles inline without section headings SHALL fail. The scorer SHALL expose versioned alias calibers as a family: the current caliber SHALL normalize a limited, deterministic set of decorative prefixes (emoji blocks including VS16/ZWJ/keycap combinations, numbering tokens such as `1.`、`1、`、`（一）`、`一、`, decorative punctuation blocks, and whitespace) before matching, while each previously published caliber SHALL stay behavior-frozen so caliber deltas remain attributable. Decorative-prefix normalization SHALL NOT change matching semantics beyond the prefix: a heading still has to equal or start with a canonical title or alias after normalization, and inline keyword mentions in body text SHALL NOT count as headings.

#### Scenario: Semantic equivalent headings are used
- **WHEN** an answer uses documented aliases such as 假设与符号 for 前提与符号
- **THEN** the scorer SHALL count those sections as present

#### Scenario: Decorated semantic headings are used under the current caliber
- **WHEN** an answer uses headings such as `### 🔍 故障定位`, `### 🧠 原因分析`, `### 🛠️ 最小修复`, `### ✅ 验证方法` for the code-debugging intent
- **THEN** the current alias caliber SHALL count all four sections as present
- **AND** the frozen `structure-alias.v1` caliber SHALL still count them as missing, so the caliber delta is attributable

#### Scenario: Decorative prefixes cover numbering and punctuation forms
- **WHEN** a heading carries a leading numbering token (such as `1.` or `（二）`) or decorative punctuation before a canonical title or alias
- **THEN** the current alias caliber SHALL strip the decoration and count the section as present

#### Scenario: Normalization does not manufacture matches
- **WHEN** a heading after decorative-prefix stripping is empty, still does not equal or start with a canonical title or alias, or the required titles appear only inside body text
- **THEN** the scorer SHALL NOT count the section as present

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

### Requirement: Product structure evaluation defaults to the current alias caliber
Product code paths that evaluate study-question structure or attribute answer units to sections (structure evaluation and answer-unit section attribution) SHALL default to the current alias caliber of the versioned family, so decorative headings no longer cause false negatives in product scoring and section attribution. Callers MAY explicitly request a frozen caliber for replay baselines.

#### Scenario: Decorated heading attributes answer units in product runtime
- **WHEN** the product runtime scans an assistant answer whose section headings carry decorative prefixes
- **THEN** answer units SHALL be attributed to the corresponding required sections under the default caliber

#### Scenario: Undecorated answers are unchanged
- **WHEN** an answer without decorative prefixes is evaluated under the default caliber
- **THEN** the outcome SHALL be identical to the frozen `structure-alias.v1` caliber, because prefix stripping is idempotent for undecorated headings


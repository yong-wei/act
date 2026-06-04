## Why

The future control-correction series will make Konling path-aware and citation-enforced for one learning path. The teaching-assistant report requires Konling to act differently across learning overview, path selection, resource execution, grading, class diagnosis, and prep-pack creation. A single generic chat mode cannot express those product roles safely.

## What Changes

- Add explicit Konling teaching-assistant modes for diagnosis explainer, path advisor, resource coach, grading assistant, feedback explainer, class summarizer, and prep coauthor.
- Require each mode to declare context requirements, permitted tools, citation requirements, privacy redaction, fallback behavior, and UI mounting surface.
- Integrate modes with diagnosis, RAG corpus, grading workbench, prep packs, and future path coaching.

## Capabilities

### Modified Capabilities

- `konling-agent-runtime`

## Impact

- Extends future cited path coaching into a multi-surface assistant.
- Depends on citation infrastructure and role-based diagnosis; grading and prep modes become fully enabled when those capabilities land.
- Does not replace the model provider matrix or scoped tool runtime.

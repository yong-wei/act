## Overview

Resource coverage is the lowest-risk overlay because it derives from public or governance-scoped resource metadata. It should answer whether a graph node has enough resources to teach, practice, assess, cite, and validate the target.

## Coverage Signals

For each graph node, compute:

- linked resource count;
- path-eligible ResourceNode count;
- RAG-indexed resource or chunk count;
- citation-ready resource count;
- verified-citation resource count;
- assessment resource count;
- simulation resource count;
- Arena preview, official, and terminal-validation-capable resource counts;
- missing coverage types;
- coverage state.

Coverage states are `sufficient`, `partial`, `missing`, and `not-audited`.

## Source Boundaries

The overlay reads ResourceNode planning metadata, semantic resource projections, runtime textbook search documents, and governed RAG chunk metadata. It must not copy raw resource content, raw chunk text, hidden Arena internals, or private learner evidence.

`RAG-indexed` means a resource or segment can be retrieved. It does not mean the resource can be cited. Citation readiness is a separate state that requires a resolvable citation target or CitationAddress. Verified citation coverage is narrower again: it requires role/scope visibility, authority, freshness, privacy visibility, and citation resolver validation.

## UI

Graph center should support a resource coverage mode. Node details should show coverage counts and missing types using text labels, not color alone.

## Risk

The main risks are conflating linked resources with path-eligible resources, and conflating indexed chunks with verified citations. The overlay must show linked, path-eligible, indexed, citation-ready, and verified-citation counts separately.

Arena coverage also needs explicit provenance. Preview practice resources, official evaluation resources, and terminal-validation-capable resources are separate counts; official evidence remains governed by ArenaSubmission and cannot be inferred from a generic Arena link.

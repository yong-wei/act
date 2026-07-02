## 1. Citation Presentation Contract

- [x] Define the frontend-readable Konling citation presentation payload from `konlingCitationGuard`, CitationChip, and Source Pack metadata.
- [x] Preserve streaming diagnostics separately from final verified citation state.
- [x] Add tests for final verified, limited, and missing-citation states.

## 2. Markdown Footnote Sanitization

- [x] Strip, disable, or normalize model-authored GFM footnotes and `#user-content-fn*` anchors in assistant messages.
- [x] Keep safe ordinary links where they are not pretending to be verified citations.
- [x] Add renderer tests for duplicate `[1]` footnotes and fake `/knowledge#user-content-*` anchors.

## 3. Citation UI And Deep Links

- [x] Render CitationChips or a compact citation list from verified metadata in global and local Konling message bubbles.
- [x] Route knowledge-node, textbook/reference, figure, restricted, and unavailable citations through platform-owned behavior.
- [x] Add click-target and accessibility tests for citation chips.

## 4. Verification

- [x] Add regression coverage for the "时间常数" style concept explanation case.
- [x] Run targeted AI/chat rendering and Konling citation tests.
- [x] Run `openspec validate render-verified-konling-citations --strict`.

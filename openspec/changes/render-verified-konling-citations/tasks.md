## 1. Citation Presentation Contract

- [ ] Define the frontend-readable Konling citation presentation payload from `konlingCitationGuard`, CitationChip, and Source Pack metadata.
- [ ] Preserve streaming diagnostics separately from final verified citation state.
- [ ] Add tests for final verified, limited, and missing-citation states.

## 2. Markdown Footnote Sanitization

- [ ] Strip, disable, or normalize model-authored GFM footnotes and `#user-content-fn*` anchors in assistant messages.
- [ ] Keep safe ordinary links where they are not pretending to be verified citations.
- [ ] Add renderer tests for duplicate `[1]` footnotes and fake `/knowledge#user-content-*` anchors.

## 3. Citation UI And Deep Links

- [ ] Render CitationChips or a compact citation list from verified metadata in global and local Konling message bubbles.
- [ ] Route knowledge-node, textbook/reference, figure, restricted, and unavailable citations through platform-owned behavior.
- [ ] Add click-target and accessibility tests for citation chips.

## 4. Verification

- [ ] Add regression coverage for the "时间常数" style concept explanation case.
- [ ] Run targeted AI/chat rendering and Konling citation tests.
- [ ] Run `openspec validate render-verified-konling-citations --strict`.

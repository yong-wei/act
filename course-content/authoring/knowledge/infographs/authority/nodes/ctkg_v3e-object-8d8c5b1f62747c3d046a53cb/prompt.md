# Authority DomainConcept Infograph — GPT/Grok Image Gen Spec

Generate ONE landscape teaching infographic for the control-theory concept below.
Provider: Grok image_gen (or latest native image generation). Treat output as a polished visual teaching asset, not a flat electronic knowledge card.

## Subject
- Title: 系统不可观测
- Concept kind: unknown
- One-line definition (source of truth): 对于式（9－81）所示线性时变系统，如果取定初始时刻 t0∈Tt，存在一个有限时刻 t1∈Tt, t1>t0，对于所有 t∈[t0, t1]，系统的输出 y(t) 不能唯一确定所有状态的初值 xi(t0), i=1,2,⋯,n，即至少有一…
- Core intuition: 在图谱邻接中可把握：前置 → 否包含元素全…、对角线规范型判据 · 后续 → 可观测性。
- Relation summary: 前置 → 否包含元素全…、对角线规范型判据 · 后续 → 可观测性
- Extended explanation (do not paste verbatim on image): 对于式（9－81）所示线性时变系统，如果取定初始时刻 t0∈Tt，存在一个有限时刻 t1∈Tt, t1>t0，对于所有 t∈[t0, t1]，系统的输出 y(t) 不能唯一确定所有状态的初值 xi(…

## visual_archetype
科普百科图鉴

## layout_contract
- Canvas: landscape 16:9
- Layered composition: (1) main visual scene or engineering metaphor for the concept, (2) 1–3 technical insets (diagram / axes / mechanism cutaway), (3) compact formula or symbolic anchors only if already present in the definition text, (4) a boundary/judgment strip
- Reading order: left-to-right or top-to-bottom, clear visual hierarchy
- Main visual occupies ~45–55% of frame; insets and labels share remaining space without clutter

## text_contract
- Clean Chinese typography; short labels only
- Allowed visible labels (max ~10, each preferably ≤10 Chinese characters): 「系统不可观测」、「属于·可观测性」、「应用于·否包含元素…」、「应用于·对角线规范…」
- Do NOT paste the full definition paragraph onto the image
- Do NOT render prompt metadata, source labels, entity ids, batch names, or English instruction headers
- Translate relation cues to Chinese short phrases already listed
- No decorative fake UI chrome, no watermark, no invented numbers or formulas

## technical_insets_contract
- Provide 1–3 insets that explain mechanism, readback, or boundary judgment
- Prefer control-engineering visuals when supported by the concept name/definition: ship heading, tank level, compass, dashboard, Bode axes, root-locus plane, Nyquist curve, step response, block diagram fragments
- Visual richness must explain the concept, not decorate randomly

## negative_constraints
- No electronic handout screenshot look
- No generic icon-card grid with long paragraphs
- No invented engineering examples, parameters, or stability claims not in the source text
- No malformed Chinese or broken formulas; if no formula is in the source, omit formula panels
- No lesson-id / group / knowledge-type chrome

## Style
Premium educational infographic: crisp lines, calm academic palette (deep navy, teal accents, warm paper-white panels), high information density with breathing room, magazine-quality illustration meeting engineering teaching standards.

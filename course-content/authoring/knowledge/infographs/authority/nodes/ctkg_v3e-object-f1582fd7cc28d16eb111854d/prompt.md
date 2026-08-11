# Authority DomainConcept Infograph — GPT/Grok Image Gen Spec

Generate ONE landscape teaching infographic for the control-theory concept below.
Provider: Grok image_gen (or latest native image generation). Treat output as a polished visual teaching asset, not a flat electronic knowledge card.

## Subject
- Title: 可控性
- Concept kind: unknown
- One-line definition (source of truth): 如果系统所有状态变量的运动都可以由输人来影响和控制而由任意的初态达到原点，则称系统是完全可控的，或者更确切地说是状态完全可控的，简称为系统可控；否则，就称系统是不完全可控的，或简称为系统不可控。
- Core intuition: 否则，就称系统是不完全可控的，或简称为系统不可控。
- Relation summary: 前置 → 系统完全可控、离散系统的可控性与可达性
- Extended explanation (do not paste verbatim on image): 如果系统所有状态变量的运动都可以由输人来影响和控制而由任意的初态达到原点，则称系统是完全可控的，或者更确切地说是状态完全可控的，简称为系统可控；否则，就称系统是不完全可控的，或简称为系统不可控。

## visual_archetype
科普百科图鉴

## layout_contract
- Canvas: landscape 16:9
- Layered composition: (1) main visual scene or engineering metaphor for the concept, (2) 1–3 technical insets (diagram / axes / mechanism cutaway), (3) compact formula or symbolic anchors only if already present in the definition text, (4) a boundary/judgment strip
- Reading order: left-to-right or top-to-bottom, clear visual hierarchy
- Main visual occupies ~45–55% of frame; insets and labels share remaining space without clutter

## text_contract
- Clean Chinese typography; short labels only
- Allowed visible labels (max ~10, each preferably ≤10 Chinese characters): 「可控性」、「是一种·系统完全可控」、「包含组件·离散系统…」
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

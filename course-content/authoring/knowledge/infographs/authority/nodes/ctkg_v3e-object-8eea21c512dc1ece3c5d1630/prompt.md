# Authority DomainConcept Infograph — GPT/Grok Image Gen Spec

Generate ONE landscape teaching infographic for the control-theory concept below.
Provider: Grok image_gen (or latest native image generation). Treat output as a polished visual teaching asset, not a flat electronic knowledge card.

## Subject
- Title: 临界比例度法
- Concept kind: unknown
- One-line definition (source of truth): 一种经典的PID参数整定方法，首先设PID控制器的积分时间系数Ti=∞，微分时间系数Td=0，比例系数设为较小的值；然后增大Kp，观察系统的输出曲线，当系统输出出现等幅振荡时记下临界比例值Km及振荡周期Tc；然后按经验数据表调整比例系数、…
- Core intuition: 然后增大Kp，观察系统的输出曲线，当系统输出出现等幅振荡时记下临界比例值Km及振荡周期Tc。
- Relation summary: （权威图邻接待补充）
- Extended explanation (do not paste verbatim on image): 一种经典的PID参数整定方法，首先设PID控制器的积分时间系数Ti=∞，微分时间系数Td=0，比例系数设为较小的值；然后增大Kp，观察系统的输出曲线，当系统输出出现等幅振荡时记下临界比例值Km及振荡…

## visual_archetype
流程板

## layout_contract
- Canvas: landscape 16:9
- Layered composition: (1) main visual scene or engineering metaphor for the concept, (2) 1–3 technical insets (diagram / axes / mechanism cutaway), (3) compact formula or symbolic anchors only if already present in the definition text, (4) a boundary/judgment strip
- Reading order: left-to-right or top-to-bottom, clear visual hierarchy
- Main visual occupies ~45–55% of frame; insets and labels share remaining space without clutter

## text_contract
- Clean Chinese typography; short labels only
- Allowed visible labels (max ~10, each preferably ≤10 Chinese characters): 「临界比例度法」
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

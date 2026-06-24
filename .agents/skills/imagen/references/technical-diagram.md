# Technical Diagram Reference

Use for system diagrams, process schematics, mechanism explanations, control diagrams, engineering drawings, and scientific visuals.

## Prompt Structure

1. Specify diagram type: block diagram, cutaway, exploded view, flow schematic, axis plot, circuit-like schematic, geometry diagram, or hybrid scene.
2. Define geometry: left-to-right flow, top-down view, cross-section, coordinate axes, layers, or numbered stages.
3. Define symbols and labels exactly.
4. Define what must be visually connected by arrows, wires, pipes, signal paths, or measurement brackets.
5. Define what must not appear.

## Quality Rules

- Use consistent line weights and arrow directions.
- Distinguish physical flow, signal flow, and causal relation with different line styles.
- Keep labels close to the object they describe.
- Use callout magnifiers only for details that need explanation.
- If using formulas, put them in a clean formula zone, not on top of busy geometry.
- Avoid fake precision: do not invent numerical values or scales.

## Prompt Skeleton

```text
Create a precise [language] technical diagram of [system/mechanism].
Canvas: [ratio].
Geometry: [view and layout].
Required components: [list].
Connections: [signals/flows/arrows and directions].
Labels: only [exact labels].
Formula/axis requirements: [if any].
Style: clean vector-like engineering illustration, readable line weights, restrained color.
Negative constraints: no decorative icons, no unsupported components, no dense paragraphs, no watermarks.
```

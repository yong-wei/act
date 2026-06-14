## Context

Representative warning counts from the 2026-06-14 run:

- `button-has-type`: 547.
- `control-has-associated-label`: 171.
- `label-has-associated-control`: 63.
- `media-has-caption`: 4.
- `click-events-have-key-events`: 11.
- `no-static-element-interactions`: 12.

Sample findings confirm real defects: admin lesson plan buttons omit explicit `type`, classroom form labels lack `htmlFor`, and clickable static elements need semantic buttons or keyboard handlers.

## Approach

1. Mechanical safe pass:
   - Add `type="button"` to non-submit buttons.
   - Preserve actual submit buttons in forms.

2. Form control pass:
   - Add stable `id`/`htmlFor` pairs.
   - Use `aria-label` only where visible labels are not appropriate.

3. Interaction pass:
   - Replace static clickable containers with `<button>` where the element performs an action.
   - Add keyboard support only when a semantic element is impossible.

4. Media pass:
   - Add captions where caption assets exist.
   - For dynamic media contracts that do not yet expose caption asset URLs, document a temporary accessibility exception in code with owner and removal conditions, and use a non-empty VTT placeholder until the media metadata contract carries real captions.

## Risks

- Some buttons inside forms may intentionally submit. The implementation must inspect context before adding `type="button"`.
- Captions may require content assets that do not exist yet; temporary exceptions must be explicit.

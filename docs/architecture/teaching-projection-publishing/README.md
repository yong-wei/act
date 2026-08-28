# Teaching projection publishing

The publish, qualify, and rebase implementation lives in
`tools/teaching-projection-publishing`. Product modules keep contracts, store,
builder, and activation readers under `src/lib/teaching-projection` and do not
import the CLI package.

`npm run teaching-projection:check` verifies the 40-file denominator, retired
`src/lib` authority, and product-import fail-closed rule. The CLI never
activates production selectors.

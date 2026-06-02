## Tailwind 4 Migration Focus

Tailwind 4 requires:

- Replacing `@tailwind base/components/utilities` with `@import "tailwindcss"`.
- Replacing the PostCSS plugin with `@tailwindcss/postcss`.
- Reassessing `autoprefixer` and import handling.
- Upgrading `tailwind-merge` with the Tailwind utility-conflict model.
- Preserving custom token definitions and layered CSS behavior.

## Repository-Specific Risk

The repository has a large `src/app/globals.css` with base, component, and utility layers. It also has platform color tokens and commercial UI governance checks. The migration should avoid weakening those gates.

## Browser Validation

Minimum route set:

- `/`
- `/login?callbackUrl=%2Fdata-center`
- `/data-center`
- `/interactive-learning`
- `/interactive-learning/courses`
- `/teacher`
- `/admin`
- `/simulations`
- at least one interactive student route
- at least one 3D simulation route

Desktop and mobile widths should be checked.

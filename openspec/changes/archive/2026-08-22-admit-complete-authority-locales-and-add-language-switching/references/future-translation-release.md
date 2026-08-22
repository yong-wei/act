# Future translation-release boundary

Adopting and activating a future graph-project translation release requires a
separate exact-version OpenSpec after that release's immutable locale manifest
and coverage evidence exist.

This change only implements admission, qualification, and language switching.
It pins contract fixtures to the already published qualified composite
`control-theory-engineering-v0.22`. It does not follow `latest`, does not
treat v0.18/v0.22 overlays or record pins as complete-locale numerator, and
does not mutate or activate current production selectors.

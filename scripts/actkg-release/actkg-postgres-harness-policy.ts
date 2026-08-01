/**
 * Shared exit policy for ACTKG real-PostgreSQL harness short-circuits.
 *
 * When ACTKG_POSTGRES_REQUIRED=1, any path that skips DB assertions must
 * fail closed (non-zero). Optional mode may skip with exit 0.
 */
export function actkgPostgresSkipExitCode(required: boolean): number {
  return required ? 1 : 0;
}

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'edge') return;
  const { warmupPlanningIndexes } = await import(
    '@/features/personalization/path-planning/planning-index-warmup'
  );
  warmupPlanningIndexes();
}

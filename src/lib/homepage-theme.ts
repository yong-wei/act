import type { ThemeMode } from '@/lib/theme-config';

const LIGHT_HOME_GRADIENT = 'bg-gradient-to-br from-sky-100 via-cyan-50 to-slate-100';

export function getHomepageScenarioBackgroundClass({
  mounted,
  theme,
  scenarioGradient,
}: {
  mounted: boolean;
  theme: ThemeMode;
  scenarioGradient: string;
}) {
  if (!mounted || theme === 'dark') {
    return `bg-gradient-to-br ${scenarioGradient}`;
  }

  return LIGHT_HOME_GRADIENT;
}

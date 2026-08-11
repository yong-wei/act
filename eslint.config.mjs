import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'

export default defineConfig([
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },
  ...nextVitals,
  {
    rules: {
      'react-hooks/error-boundaries': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  globalIgnores([
    'evaluate/**',
    '.skillopt-sleep/**',
    '.worktrees/**',
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
])

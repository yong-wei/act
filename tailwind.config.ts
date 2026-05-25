import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    './src/resources/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'primary-blue': '#4169E1',
        'amber-alert': '#FFBF00',
        'dark-blue': '#1c3166',
        'light-blue': '#e6eeff',
        'success-green': '#28a745',
        'danger-red': '#dc3545',
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        'platform-canvas': "hsl(var(--platform-canvas))",
        'platform-canvas-muted': "hsl(var(--platform-canvas-muted))",
        'platform-surface': "hsl(var(--platform-surface))",
        'platform-surface-raised': "hsl(var(--platform-surface-raised))",
        'platform-surface-overlay': "hsl(var(--platform-surface-overlay))",
        'platform-fg-primary': "hsl(var(--platform-fg-primary))",
        'platform-fg-secondary': "hsl(var(--platform-fg-secondary))",
        'platform-fg-muted': "hsl(var(--platform-fg-muted))",
        'platform-fg-inverse': "hsl(var(--platform-fg-inverse))",
        'platform-border': "hsl(var(--platform-border))",
        'platform-border-strong': "hsl(var(--platform-border-strong))",
        'platform-action-primary': "hsl(var(--platform-action-primary))",
        'platform-action-hover': "hsl(var(--platform-action-hover))",
        'platform-action-subtle': "hsl(var(--platform-action-subtle))",
        'platform-evidence-eligible': "hsl(var(--platform-evidence-eligible))",
        'platform-evidence-context': "hsl(var(--platform-evidence-context))",
        'platform-evidence-unsupported': "hsl(var(--platform-evidence-unsupported))",
        'platform-privacy-public': "hsl(var(--platform-privacy-public))",
        'platform-privacy-restricted': "hsl(var(--platform-privacy-restricted))",
        'platform-privacy-private': "hsl(var(--platform-privacy-private))",
        'platform-replay-ready': "hsl(var(--platform-replay-ready))",
        'platform-replay-partial': "hsl(var(--platform-replay-partial))",
        'platform-replay-missing': "hsl(var(--platform-replay-missing))",
        'platform-evaluation-official': "hsl(var(--platform-evaluation-official))",
        'platform-evaluation-preview': "hsl(var(--platform-evaluation-preview))",
        'platform-evaluation-hidden': "hsl(var(--platform-evaluation-hidden))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        'rotate-slowly': {
          '0%': { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(360deg)' },
        },
        'wave': {
          '0%, 100%': { transform: 'scaleY(1)' },
          '50%': { transform: 'scaleY(2)' },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        'rotate-slowly': 'rotate-slowly 120s linear infinite',
        'wave': 'wave 1s ease-in-out infinite',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
export default config

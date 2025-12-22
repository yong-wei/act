import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      colors: {
        // Colors from ai0318.html
        'primary-blue': '#4169E1',
        'amber-alert': '#FFBF00',
        'dark-blue': '#1c3166',
        'light-blue': '#e6eeff',
        'success-green': '#28a745',
        'danger-red': '#dc3545',
        'gray-800': '#343a40',
        'white': '#ffffff',

        // Colors from ethics0318.html
        'primary-color': '#4682B4',
        'accent-color': '#7FFF00',
        'dark-bg': '#1C2331',
        'light-bg': '#EEF5FF',
        'panel-bg': 'rgba(28, 35, 49, 0.85)',
        'panel-border': 'rgba(70, 130, 180, 0.5)',

        // Colors from knowledge.html
        'knowledge-bg': '#020721',
        'knowledge-text': '#e0e6ff',
        'sidebar-bg': 'rgba(9, 21, 64, 0.8)',
        'sidebar-border': 'rgba(79, 134, 198, 0.3)',
        'knowledge-blue': '#4f86c6',
        'knowledge-light-blue': '#8aa8d2',
        'search-placeholder': '#5d7ba0',
        'resource-card-bg': 'rgba(26, 41, 88, 0.5)',
        'resource-text': '#bac6e0',
        'formula-bg': 'rgba(12, 29, 79, 0.4)',
        'slider-thumb': '#4f86c6',
        'workshop-bubble-gradient-start': '#4f86c6',
        'workshop-bubble-gradient-end': '#265691',
        'workshop-menu-bg': 'rgba(9, 21, 64, 0.95)',
        'workshop-menu-border': 'rgba(79, 134, 198, 0.5)',
        'sync-panel-bg': 'rgba(9, 21, 64, 0.85)',
        'sync-panel-border': 'rgba(79, 134, 198, 0.3)',
        'badge-bg': 'rgba(245, 197, 66, 0.2)',
        'badge-color': '#f5c542',
        'scenario-color': '#f5544f',
        'theory-color': '#4f86c6',
        'ethics-color': '#50c38a',

        // Colors from ArgumentPrinciple.html
        'ap-primary': '#3498db',
        'ap-secondary': '#2ecc71',
        'ap-error': '#e74c3c',
        'ap-bg': '#f8f9fa',
        'ap-panel': '#ffffff',
        'ap-text': '#333333',
        'ap-grid': '#e0e0e0',

        // Colors from background0318.html
        'bg-primary': '#1a3e59',
        'bg-secondary': '#2d6a9f',
        'bg-accent': '#41b6e6',
        'bg-warning': '#e74c3c',
        'bg-success': '#27ae60',
        'bg-light': '#ecf0f1',
        'bg-dark': '#2c3e50',
        'bg-bg-dark': '#1c2833',
        'bg-text': '#333',

        // Colors from personal0318.html
        'personal-deep-blue': '#0a3d62',
        'personal-mid-blue': '#1e5f8c',
        'personal-light-blue': '#3498db',
        'personal-gold': '#FFD700',
        'personal-dark-gray': '#2c3e50',
        'personal-progress-green': '#27ae60',
        'personal-ethics-blue': '#2980b9',
        'personal-warning-red': '#e74c3c',

        // Colors from pid-simulator.css
        'pid-bg': '#f0f4f8',
        'pid-model-btn': '#2c5282',
        'pid-model-btn-hover': '#4299e1',
        'pid-model-btn-active': '#48bb78',
        'pid-panel-bg': '#fff',
        'pid-placeholder-bg': '#ebf8ff',
        'pid-placeholder-text': '#2c5282',
        'pid-input-border': '#ccc',
      },
      gridTemplateAreas: {
        'background-layout': [
          '"header header header"',
          '"sidebar main rightpanel"',
          '"footer footer footer"',
        ],
        'personal-layout': [
          '"dashboard dashboard dashboard"',
          '"compass main tools"',
          '"journal journal journal"',
        ],
      },
    },
  },
  plugins: [],
};
export default config;

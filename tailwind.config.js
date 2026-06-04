/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // All driven by CSS variables in src/styles/index.css (HSL channels).
        paper: 'hsl(var(--paper) / <alpha-value>)',
        surface: 'hsl(var(--surface) / <alpha-value>)',
        'surface-2': 'hsl(var(--surface-2) / <alpha-value>)',
        ink: 'hsl(var(--ink) / <alpha-value>)',
        'ink-soft': 'hsl(var(--ink-soft) / <alpha-value>)',
        'ink-muted': 'hsl(var(--ink-muted) / <alpha-value>)',
        line: 'hsl(var(--line) / <alpha-value>)',
        'line-strong': 'hsl(var(--line-strong) / <alpha-value>)',
        brand: {
          DEFAULT: 'hsl(var(--brand) / <alpha-value>)',
          soft: 'hsl(var(--brand-soft) / <alpha-value>)',
          ink: 'hsl(var(--brand-ink) / <alpha-value>)',
          contrast: 'hsl(var(--brand-contrast) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          contrast: 'hsl(var(--accent-contrast) / <alpha-value>)',
        },
        good: 'hsl(var(--good) / <alpha-value>)',
        'good-soft': 'hsl(var(--good-soft) / <alpha-value>)',
        warn: 'hsl(var(--warn) / <alpha-value>)',
        'warn-soft': 'hsl(var(--warn-soft) / <alpha-value>)',
        bad: 'hsl(var(--bad) / <alpha-value>)',
        'bad-soft': 'hsl(var(--bad-soft) / <alpha-value>)',
      },
      fontFamily: {
        display: ['Outfit', '"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.04em' }],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 2px hsl(var(--shadow) / 0.03), 0 1px 3px hsl(var(--shadow) / 0.04)',
        'card-hover': '0 1px 2px hsl(var(--shadow) / 0.05), 0 6px 20px -10px hsl(var(--shadow) / 0.14)',
        pop: '0 8px 36px -12px hsl(var(--shadow) / 0.22)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
}

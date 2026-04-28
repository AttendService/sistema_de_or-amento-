/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        brand: {
          50:  'var(--c-brand-50)',
          100: 'var(--c-brand-100)',
          200: 'var(--c-brand-200)',
          300: 'var(--c-brand-300)',
          400: 'var(--c-brand-400)',
          500: 'var(--c-brand-500)',
          600: 'var(--c-brand-600)',
          700: 'var(--c-brand-700)',
          800: 'var(--c-brand-800)',
          900: 'var(--c-brand-900)',
        },
        surface: {
          0:   'var(--c-surface-0)',
          50:  'var(--c-surface-50)',
          100: 'var(--c-surface-100)',
          200: 'var(--c-surface-200)',
          300: 'var(--c-surface-300)',
          400: 'var(--c-surface-400)',
          500: 'var(--c-surface-500)',
          600: 'var(--c-surface-600)',
          700: 'var(--c-surface-700)',
          800: 'var(--c-surface-800)',
          900: 'var(--c-surface-900)',
          950: 'var(--c-surface-950)',
        },
        status: {
          requested:  '#6B7AFF',
          analysis:   '#F59E0B',
          progress:   '#8B5CF6',
          sent:       '#06B6D4',
          approved:   '#10B981',
          rejected:   '#EF4444',
          onhold:     '#F97316',
          cancelled:  '#94A3B8',
        }
      },
      boxShadow: {
        card:  '0 1px 3px 0 rgb(0 0 0 / .06), 0 1px 2px -1px rgb(0 0 0 / .06)',
        panel: '0 4px 24px -4px rgb(0 0 0 / .1)',
        glow:  '0 0 0 3px rgb(75 95 255 / .2)',
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
      },
    },
  },
  plugins: [],
}

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
          50:  '#f0f4ff',
          100: '#dde6ff',
          200: '#c3d0ff',
          300: '#9db1ff',
          400: '#7086ff',
          500: '#4B5FFF',
          600: '#3444f0',
          700: '#2a36d6',
          800: '#242dac',
          900: '#222c88',
        },
        surface: {
          0:   '#ffffff',
          50:  '#f8f9fc',
          100: '#f1f3f9',
          200: '#e4e8f2',
          300: '#cdd3e4',
          400: '#aeb6cf',
          500: '#8a93ad',
          600: '#66708b',
          700: '#4a5068',
          800: '#2d3148',
          900: '#1a1d2e',
          950: '#0f1120',
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

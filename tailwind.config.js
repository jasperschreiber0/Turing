/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink:     '#0A0A0A',
        paper:   '#FFFFFF',
        grey:    '#999999',
        warn:    '#FF6B35',
        dim:     '#999999',
        surface: '#F7F7F5',
        lifted:  '#EFEFED',
        muted:   '#D8D5CE',
      },
      fontFamily: {
        display: ['var(--font-bebas)', 'sans-serif'],
        mono:    ['var(--font-mono)', 'monospace'],
        sans:    ['var(--font-dm)', 'sans-serif'],
      },
      animation: {
        'ink-reveal': 'inkReveal 0.5s ease forwards',
        'fade-up':    'fadeUp 0.4s ease forwards',
      },
      keyframes: {
        inkReveal: {
          'from': { clipPath: 'inset(0 100% 0 0)' },
          'to':   { clipPath: 'inset(0 0% 0 0)' },
        },
        fadeUp: {
          'from': { opacity: '0', transform: 'translateY(6px)' },
          'to':   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        bg: 'var(--dj-bg)',
        surface: 'var(--dj-surface)',
        sunk: 'var(--dj-sunk)',
        ink: {
          DEFAULT: 'var(--dj-text)',
          soft: 'var(--dj-text-soft)',
          faint: 'var(--dj-text-faint)',
        },
        accent: {
          DEFAULT: 'var(--dj-accent)',
          soft: 'var(--dj-accent-soft)',
          hover: 'var(--dj-accent-hover)',
        },
        line: 'var(--dj-line)',
        danger: 'var(--dj-danger)',
        ok: 'var(--dj-ok)',
      },
      fontFamily: {
        sans: 'var(--dj-font-sans)',
        mono: 'var(--dj-font-mono)',
      },
      borderRadius: {
        card: '10px',
        btn: '8px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(28, 27, 25, 0.04), 0 1px 3px rgba(28, 27, 25, 0.06)',
        pop: '0 8px 28px rgba(28, 27, 25, 0.16)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 140ms ease-out',
      },
    },
  },
  plugins: [],
}

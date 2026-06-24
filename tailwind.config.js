/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        bg: 'var(--ps-bg)',
        surface: 'var(--ps-surface)',
        sunk: 'var(--ps-sunk)',
        ink: {
          DEFAULT: 'var(--ps-text)',
          soft: 'var(--ps-text-soft)',
          faint: 'var(--ps-text-faint)',
        },
        accent: {
          DEFAULT: 'var(--ps-accent)',
          soft: 'var(--ps-accent-soft)',
          hover: 'var(--ps-accent-hover)',
        },
        line: 'var(--ps-line)',
        danger: 'var(--ps-danger)',
        ok: 'var(--ps-ok)',
      },
      fontFamily: {
        sans: 'var(--ps-font-sans)',
        mono: 'var(--ps-font-mono)',
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

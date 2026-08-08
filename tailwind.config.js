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
        warn: 'var(--dj-warn)',
      },
      fontFamily: {
        sans: 'var(--dj-font-sans)',
        mono: 'var(--dj-font-mono)',
        brand: 'var(--dj-font-brand)',
      },
      borderRadius: {
        card: '16px',
        btn: '11px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(28, 27, 25, 0.04), 0 1px 3px rgba(28, 27, 25, 0.06)',
        pop: '0 16px 44px rgba(28, 27, 25, 0.14)',
        cta: '0 8px 22px rgba(91, 84, 240, 0.22)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        rise: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pop: {
          '0%': { opacity: '0', transform: 'scale(0.82)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'soft-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 160ms cubic-bezier(0.16, 1, 0.3, 1)',
        rise: 'rise 320ms cubic-bezier(0.16, 1, 0.3, 1) both',
        pop: 'pop 180ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'soft-in': 'soft-in 180ms ease-out both',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        ink: { 50: '#fafaf7', 100: '#f3f2ec', 800: '#26241f', 900: '#1a1916' },
        accent: { DEFAULT: '#5b54f0', soft: '#ebeafe' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}

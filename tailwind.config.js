/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './**/*.{ts,tsx}',
    '!./node_modules/**',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          900: '#0a0800',
          800: '#1a1200',
          700: '#2d1d00',
          600: '#b45309',
          500: '#f59e0b',
          400: '#fbbf24',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  safelist: [
    'bg-brand-600', 'bg-brand-500', 'bg-brand-500/20', 'bg-brand-900/50',
    'text-brand-400', 'text-brand-500', 'border-brand-500/20', 'ring-brand-500',
  ],
  plugins: [],
};

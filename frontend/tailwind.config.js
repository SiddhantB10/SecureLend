/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        secure: {
          950: '#050505',
          900: '#0b0b0b',
          850: '#111111',
          800: '#171717',
          700: '#262626',
          600: '#3f3f3f',
        },
        neon: {
          500: '#f8e71c',
          400: '#fff066',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(248, 231, 28, 0.2), 0 0 30px rgba(248, 231, 28, 0.12)',
      },
      backgroundImage: {
        grid: 'linear-gradient(rgba(248, 231, 28, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(248, 231, 28, 0.08) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
};

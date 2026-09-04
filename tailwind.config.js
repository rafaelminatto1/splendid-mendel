/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf9',
          100: '#ccfbf1',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#005f73',
          800: '#004655',
          900: '#0f172a',
        },
        sage: {
          100: '#e8f3ee',
          500: '#81b29a',
          600: '#699982',
        },
        ivory: {
          50: '#fcfcfb',
          100: '#f9f9f7',
          200: '#f0f0eb',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

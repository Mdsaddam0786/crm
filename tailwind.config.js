/** @type {import('tailwindcss').Config} */
export default {
  content: ['./client/index.html', './client/src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'] },
      colors: {
        brand: { 50: '#effaf7', 100: '#d7f2ea', 200: '#b0e4d6', 300: '#7ccfbc', 400: '#47b39e', 500: '#279884', 600: '#1a7a6b', 700: '#176257', 800: '#164f47', 900: '#14423c' },
        ink: { 950: '#0b1220', 900: '#111a2c', 800: '#1b2539' },
      },
      boxShadow: { card: '0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)' },
    },
  },
  plugins: [],
};

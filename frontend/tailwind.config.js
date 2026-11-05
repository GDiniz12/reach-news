/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        pplx: {
          bg: '#191a1a',
          card: '#202222',
          hover: '#262828',
          border: '#2d2f2f',
          teal: '#20b8cd',
          tealLight: '#53b8bb',
          text: '#ececec',
          muted: '#8e9293',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif-editorial)', 'Georgia', ' Cambria', 'Times New Roman', 'serif'],
      },
    },
  },
  plugins: [],
};

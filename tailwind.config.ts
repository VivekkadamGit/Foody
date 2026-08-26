import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-playfair)', 'Georgia', 'serif'],
        body: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        anek: ['var(--font-anek)', 'system-ui', 'sans-serif'],
        barlow: ['var(--font-barlow)', 'system-ui', 'sans-serif'],
      },
      colors: {
        cream: '#FAF6EF',
        charcoal: '#1A1614',
        spice: {
          DEFAULT: '#C0432A',
          light: '#D95A3F',
          dark: '#8C3020',
        },
        muted: '#8B7D72',
        warm: {
          50: '#FAF6EF',
          100: '#F0E8DC',
          200: '#DDD0C0',
        },
        // "Design 8a" dark palette — used on the home page hero/ranking sections only
        ink: {
          DEFAULT: '#17110e',
          light: '#1d1512',
          card: '#241a15',
        },
        ember: {
          DEFAULT: '#d9482b',
          light: '#ee8a34',
        },
        sand: {
          DEFAULT: '#a8998c',
          dark: '#8b8578',
          darker: '#6f665d',
        },
        gold2: '#c9a46b',
        confirmed: '#3fbb84',
      },
    },
  },
  plugins: [],
};
export default config;

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
      },
    },
  },
  plugins: [],
};
export default config;

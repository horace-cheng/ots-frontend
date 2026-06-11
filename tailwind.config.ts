import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink:    { DEFAULT: '#1a1a2e', light: '#2d2d4e' },
        paper:  { DEFAULT: '#f5f0e8', dark: '#e8e0d0' },
        gold:   { DEFAULT: '#c9933a', light: '#e8b654', dark: '#9a6e28' },
        mist:   { DEFAULT: '#8a9bb5', light: '#b8c7d9' },
        moss:   { DEFAULT: '#4a7c59', light: '#6ba07a' },
        coral:  { DEFAULT: '#c9614a', light: '#e07b65' },
      },
      fontFamily: {
        display: ['"Noto Serif TC"', '"Iansui"', 'Georgia', 'serif'],
        body:    ['"Iansui"', '"Noto Sans TC"', 'system-ui', 'sans-serif'],
        mono:    ['ui-monospace', 'monospace'],
      },
      backgroundImage: {
        'paper-texture': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
}

export default config

import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
    '../../packages/graph/src/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          0: '#0B0B10',
          1: '#111118',
          2: '#17171F',
          3: '#1E1E27',
          4: '#262631',
        },
        border: {
          DEFAULT: '#2C2C38',
          strong: '#3A3A48',
        },
        fg: {
          DEFAULT: '#F2F2F7',
          secondary: '#B7B7C6',
          muted: '#7E7E90',
          inverse: '#0B0B10',
        },
        orange: {
          50: '#FFF2E6',
          200: '#FFC899',
          400: '#FF9447',
          500: '#FF7A1A',
          600: '#E36610',
          700: '#B94F06',
        },
        purple: {
          200: '#D6B3FF',
          400: '#B478FF',
          500: '#9D4EDD',
          600: '#7E30C4',
          700: '#5C1F94',
        },
        success: '#3DD68C',
        warning: '#F5A524',
        danger: '#F0506B',
        info: '#4DA3FF',
        node: {
          flow: '#7E7E90',
          narrative: '#FF7A1A',
          stage: '#4DA3FF',
          audio: '#3DD68C',
          logic: '#9D4EDD',
          systems: '#F5A524',
          screens: '#D6B3FF',
        },
      },
      borderRadius: {
        xs: '2px',
        sm: '4px',
        md: '6px',
        lg: '10px',
        xl: '14px',
        pill: '999px',
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono Variable', 'JetBrains Mono', 'ui-monospace', 'monospace'],
        serif: ['Source Serif 4 Variable', 'Source Serif 4', 'Georgia', 'serif'],
      },
      fontSize: {
        xs: ['11px', { lineHeight: '16px', letterSpacing: '0' }],
        sm: ['12px', { lineHeight: '18px', letterSpacing: '0' }],
        base: ['13px', { lineHeight: '20px', letterSpacing: '0' }],
        md: ['14px', { lineHeight: '22px', letterSpacing: '-0.01em' }],
        lg: ['16px', { lineHeight: '24px', letterSpacing: '-0.01em' }],
        xl: ['20px', { lineHeight: '28px', letterSpacing: '-0.01em' }],
        '2xl': ['24px', { lineHeight: '32px', letterSpacing: '-0.01em' }],
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.4)',
        md: '0 4px 12px rgba(0, 0, 0, 0.45)',
        lg: '0 12px 32px rgba(0, 0, 0, 0.55)',
      },
    },
  },
  plugins: [],
};

export default config;

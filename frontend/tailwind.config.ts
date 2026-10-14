import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'deep-slate': '#244855',
        'signal-red': '#E64833',
        umber: '#874F41',
        sage: '#90AEAD',
        sand: '#FBE9D0',
        glass: 'rgba(251, 233, 208, 0.7)',
        'glass-slate': 'rgba(36, 72, 85, 0.8)',
        // Stitch specific aliases
        primary: '#08323e',
        secondary: '#b62515',
        surface: '#fbe9d0',
        'surface-container-low': '#fff2e1',
        'surface-dim': '#e9d8bf',
        'on-surface': '#244855',
        'on-surface-variant': '#41484b',
        'on-background': '#231a0b',
        'on-secondary': '#ffffff',
        'on-primary': '#ffffff',
        error: '#b62515',
        tertiary: '#874f41',
        outline: '#90aead',
        'glass-fill': 'rgba(251, 233, 208, 0.7)',
        'secondary-container': '#fc5841',
        'on-secondary-container': '#5b0300',
        'primary-container': '#244855',
        'on-primary-container': '#92b6c5',
        'surface-container': '#fdebd2',
        'surface-container-high': '#f8e6cd',
        'glass-border': 'rgba(144, 174, 173, 0.3)',
      },
      fontFamily: {
        heading: ['"Space Grotesk"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
        // Stitch aliases
        'headline-xl': ['"Space Grotesk"', 'sans-serif'],
        'headline-lg': ['"Space Grotesk"', 'sans-serif'],
        'headline-md': ['"Space Grotesk"', 'sans-serif'],
        'body-lg': ['Inter', 'sans-serif'],
        'body-md': ['Inter', 'sans-serif'],
        'body-sm': ['Inter', 'sans-serif'],
        'label-md': ['"IBM Plex Mono"', 'monospace'],
        'label-sm': ['"IBM Plex Mono"', 'monospace'],
      },
      fontSize: {
        'headline-xl': [
          '48px',
          { lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '700' },
        ],
        'headline-lg': [
          '32px',
          { lineHeight: '40px', letterSpacing: '-0.01em', fontWeight: '600' },
        ],
        'headline-md': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'body-lg': ['18px', { lineHeight: '28px', fontWeight: '400' }],
        'body-md': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-sm': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'label-md': ['14px', { lineHeight: '20px', letterSpacing: '0.05em', fontWeight: '500' }],
        'label-sm': ['12px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '500' }],
      },
      transitionTimingFunction: {
        custom: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config;

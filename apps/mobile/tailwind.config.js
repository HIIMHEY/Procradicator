/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: process.env.DARK_MODE ? process.env.DARK_MODE : 'class',
  content: [
    './app/**/*.{html,js,jsx,ts,tsx,mdx}',
    './components/**/*.{html,js,jsx,ts,tsx,mdx}',
    './utils/**/*.{html,js,jsx,ts,tsx,mdx}',
    './*.{html,js,jsx,ts,tsx,mdx}',
    './src/**/*.{html,js,jsx,ts,tsx,mdx}',
  ],
  presets: [require('nativewind/preset')],
  important: 'html',
  safelist: [
    {
      pattern:
        /(bg|border|text|stroke|fill)-(primary|secondary|tertiary|error|success|warning|info|typography|outline|background|indicator)-(0|50|100|200|300|400|500|600|700|800|900|950|white|gray|black|error|warning|muted|success|info|light|dark|primary)/,
    },
  ],
  theme: {
    extend: {
      colors: {
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        'surface-dim': 'rgb(var(--color-surface-dim) / <alpha-value>)',
        'surface-bright': 'rgb(var(--color-surface-bright) / <alpha-value>)',
        'surface-container': {
          lowest: 'rgb(var(--color-surface-container-lowest) / <alpha-value>)',
          low: 'rgb(var(--color-surface-container-low) / <alpha-value>)',
          DEFAULT: 'rgb(var(--color-surface-container) / <alpha-value>)',
          high: 'rgb(var(--color-surface-container-high) / <alpha-value>)',
          highest: 'rgb(var(--color-surface-container-highest) / <alpha-value>)',
        },
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        'on-primary': 'rgb(var(--color-on-primary) / <alpha-value>)',
        'primary-container': 'rgb(var(--color-primary-container) / <alpha-value>)',
        'on-primary-container': 'rgb(var(--color-on-primary-container) / <alpha-value>)',
        secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
        'on-secondary': 'rgb(var(--color-on-secondary) / <alpha-value>)',
        'secondary-container': 'rgb(var(--color-secondary-container) / <alpha-value>)',
        'on-secondary-container': 'rgb(var(--color-on-secondary-container) / <alpha-value>)',
        outline: 'rgb(var(--color-outline) / <alpha-value>)',
        'outline-variant': 'rgb(var(--color-outline-variant) / <alpha-value>)',
        background: 'rgb(var(--color-background) / <alpha-value>)',
        'on-background': 'rgb(var(--color-on-background) / <alpha-value>)',
        'on-surface': 'rgb(var(--color-on-surface) / <alpha-value>)',
        'on-surface-variant': 'rgb(var(--color-on-surface-variant) / <alpha-value>)',
        error: 'rgb(var(--color-error) / <alpha-value>)',
        'error-container': 'rgb(var(--color-error-container) / <alpha-value>)',
        'on-error-container': 'rgb(var(--color-on-error-container) / <alpha-value>)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-default)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        full: 'var(--radius-full)',
      },
      spacing: {
        base: 'var(--space-base)',
        gutter: 'var(--space-gutter)',
        'margin-mobile': 'var(--space-margin-mobile)',
        'margin-desktop': 'var(--space-margin-desktop)',
        'section-gap': 'var(--space-section-gap)',
      },
      fontFamily: {
        heading: ['Plus Jakarta Sans', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      fontSize: {
        'headline-lg': ['40px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '600' }],
        'headline-lg-mobile': [
          '32px',
          { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '600' },
        ],
        'headline-md': ['24px', { lineHeight: '1.4', letterSpacing: '-0.01em', fontWeight: '500' }],
        'body-lg': ['18px', { lineHeight: '1.8', letterSpacing: '0.01em', fontWeight: '400' }],
        'body-md': ['16px', { lineHeight: '1.6', letterSpacing: '0.01em', fontWeight: '400' }],
        'label-md': ['14px', { lineHeight: '1.4', letterSpacing: '0.05em', fontWeight: '500' }],
        'label-sm': ['12px', { lineHeight: '1.4', letterSpacing: '0.03em', fontWeight: '500' }],
      },
    },
  },
};

import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'brand-red': '#D8393D',
        'brand-muted-red': '#FF5555',
        'ld-bg': 'rgb(var(--color-bg) / <alpha-value>)',
        'ld-body': 'rgb(var(--color-body) / <alpha-value>)',
        'ld-card': 'rgb(var(--color-card) / <alpha-value>)',
        'ld-elevated': 'rgb(var(--color-elevated) / <alpha-value>)',
        'ld-border': 'rgb(var(--color-border) / <alpha-value>)',
        'ld-border-subtle': 'rgb(var(--color-border-subtle) / <alpha-value>)',
        'ld-text': 'rgb(var(--color-text) / <alpha-value>)',
        'ld-text-muted': 'rgb(var(--color-text-muted) / <alpha-value>)',
        'ld-text-dim': 'rgb(var(--color-text-dim) / <alpha-value>)',
      },
      fontFamily: {
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'page-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          from: { opacity: '0', transform: 'scale(0.8)' },
          '60%': { transform: 'scale(1.08)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(300%)' },
        },
        'pulse-red': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(216, 57, 61, 0.45)' },
          '50%': { boxShadow: '0 0 0 14px rgba(216, 57, 61, 0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
        'fade-in': 'fade-in 0.4s ease-out both',
        'scale-in': 'scale-in 0.3s ease-out both',
        'page-in': 'page-in 0.22s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'pop-in': 'pop-in 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        shimmer: 'shimmer 1.8s ease-in-out infinite',
        'pulse-red': 'pulse-red 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;

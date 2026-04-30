/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        felt: { DEFAULT: '#1a5c38', dark: '#0f3d24', light: '#22774a' },
        gold: { DEFAULT: '#c9a84c', light: '#e0c068', dark: '#9a7a30' },
        card: '#f5f0e8',
        chip: {
          red: '#e63946',
          green: '#2ecc71',
          black: '#1a1a2e',
          purple: '#7c3aed',
          white: '#f1faee',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      keyframes: {
        dealIn: {
          '0%': { transform: 'translateY(-60px) rotate(-8deg)', opacity: '0' },
          '100%': { transform: 'translateY(0) rotate(0deg)', opacity: '1' },
        },
        flipCard: {
          '0%': { transform: 'rotateY(90deg)', opacity: '0.5' },
          '100%': { transform: 'rotateY(0deg)', opacity: '1' },
        },
        pulse_gold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(201,168,76,0.7)' },
          '50%': { boxShadow: '0 0 0 8px rgba(201,168,76,0)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        dealIn: 'dealIn 0.35s ease-out forwards',
        flipCard: 'flipCard 0.4s ease-out forwards',
        pulse_gold: 'pulse_gold 1.5s infinite',
        slideUp: 'slideUp 0.3s ease-out forwards',
        shimmer: 'shimmer 2s infinite linear',
      },
    },
  },
  plugins: [],
};

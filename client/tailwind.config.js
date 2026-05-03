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
          '0%':   { transform: 'translateY(-50px) rotate(-6deg) scale(0.92)', opacity: '0' },
          '70%':  { transform: 'translateY(4px) rotate(0.5deg) scale(1.01)',  opacity: '1' },
          '100%': { transform: 'translateY(0) rotate(0deg) scale(1)',         opacity: '1' },
        },
        flipCard: {
          '0%':   { transform: 'perspective(400px) rotateY(90deg)', opacity: '0.3' },
          '60%':  { transform: 'perspective(400px) rotateY(-8deg)', opacity: '1' },
          '100%': { transform: 'perspective(400px) rotateY(0deg)',  opacity: '1' },
        },
        scaleIn: {
          '0%':   { transform: 'scale(0.88) translateY(12px)', opacity: '0' },
          '70%':  { transform: 'scale(1.03) translateY(-2px)', opacity: '1' },
          '100%': { transform: 'scale(1) translateY(0)',        opacity: '1' },
        },
        slideDown: {
          '0%':   { transform: 'translateY(-16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',      opacity: '1' },
        },
        shakeX: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-7px)' },
          '40%': { transform: 'translateX(6px)' },
          '60%': { transform: 'translateX(-5px)' },
          '80%': { transform: 'translateX(4px)' },
        },
        floatUp: {
          '0%':   { transform: 'translateY(0)',    opacity: '1' },
          '100%': { transform: 'translateY(-44px)', opacity: '0' },
        },
        chipIn: {
          '0%':   { transform: 'scale(0.7) rotate(-8deg)', opacity: '0' },
          '70%':  { transform: 'scale(1.12) rotate(2deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(0deg)',     opacity: '1' },
        },
        winCell: {
          '0%':   { boxShadow: '0 0 0 0 rgba(201,168,76,0)' },
          '30%':  { boxShadow: '0 0 14px 5px rgba(201,168,76,0.75)' },
          '70%':  { boxShadow: '0 0 10px 3px rgba(201,168,76,0.45)' },
          '100%': { boxShadow: '0 0 8px 2px rgba(201,168,76,0.3)' },
        },
        potPop: {
          '0%':   { transform: 'scale(1)' },
          '40%':  { transform: 'scale(1.18)' },
          '70%':  { transform: 'scale(0.96)' },
          '100%': { transform: 'scale(1)' },
        },
        bjGlow: {
          '0%':   { boxShadow: '0 0 0 0 rgba(250,204,21,0)',    filter: 'brightness(1)' },
          '35%':  { boxShadow: '0 0 22px 8px rgba(250,204,21,0.55)', filter: 'brightness(1.15)' },
          '100%': { boxShadow: '0 0 0 0 rgba(250,204,21,0)',    filter: 'brightness(1)' },
        },
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
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
        dealIn:     'dealIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards',
        flipCard:   'flipCard 0.45s cubic-bezier(0.34,1.3,0.64,1) forwards',
        scaleIn:    'scaleIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards',
        slideDown:  'slideDown 0.3s ease-out forwards',
        shakeX:     'shakeX 0.5s ease-out forwards',
        floatUp:    'floatUp 1.2s ease-out forwards',
        chipIn:     'chipIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards',
        winCell:    'winCell 2s ease-in-out forwards',
        potPop:     'potPop 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        bjGlow:     'bjGlow 1.2s ease-out forwards',
        fadeIn:     'fadeIn 0.4s ease-out forwards',
        pulse_gold: 'pulse_gold 1.5s infinite',
        slideUp:    'slideUp 0.3s ease-out forwards',
        shimmer:    'shimmer 2s infinite linear',
      },
    },
  },
  plugins: [],
};

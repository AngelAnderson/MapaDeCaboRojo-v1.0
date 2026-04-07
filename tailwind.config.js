/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#10b981', // emerald-500
          hover: '#059669',   // emerald-600
          light: '#d1fae5',   // emerald-100
          dark: '#064e3b',    // emerald-900
        },
        surface: {
          light: '#f8fafc',   // slate-50
          dark: '#0f172a',    // slate-900
        },
        accent: {
          DEFAULT: '#fbbf24', // amber-400
          hover: '#f59e0b',   // amber-500
        },
        muted: {
          DEFAULT: '#94a3b8', // slate-400
          dark: '#64748b',    // slate-500
        },
      },
      borderRadius: {
        card: '1.25rem',   // 20px — cards
        pill: '9999px',    // pills/buttons
        sheet: '2rem',     // 32px — bottom sheets
      },
      boxShadow: {
        card: '0 4px 24px rgba(0,0,0,0.08)',
        'card-dark': '0 4px 24px rgba(0,0,0,0.3)',
        float: '0 20px 40px rgba(0,0,0,0.15)',
        'float-dark': '0 20px 40px rgba(0,0,0,0.4)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.32,0.72,0,1)',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        pulseDot: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.4)', opacity: '0.6' },
        },
      },
    }
  },
  plugins: [],
}

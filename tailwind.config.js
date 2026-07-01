/** @type {import('tailwindcss').Config} */

// Level-20 design system. Palette ramps are literal (stable across themes);
// semantic surface/ink/line tokens are CSS variables (see src/index.css) so
// light + dark consume the same names. Legacy keys (primary/accent/surface/
// muted/shadow-card/rounded-card) are preserved so existing components keep working.
export default {
  content: [
    "./index.html",
    "./App.tsx",
    "./index.tsx",
    "./constants.ts",
    "./types.ts",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./services/**/*.{ts,tsx}",
    "./utils/**/*.{ts,tsx}",
    "./i18n/**/*.{ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // Body: Source Sans 3 (loaded in index.html). Display: Fraunces serif.
        sans: ['"Source Sans 3"', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],       // 11
        xs: ['0.75rem', { lineHeight: '1.05rem' }],          // 12
        sm: ['0.8125rem', { lineHeight: '1.2rem' }],         // 13
        base: ['0.9375rem', { lineHeight: '1.5rem' }],       // 15
        lg: ['1.0625rem', { lineHeight: '1.6rem' }],         // 17
        xl: ['1.25rem', { lineHeight: '1.7rem' }],           // 20
        '2xl': ['1.5rem', { lineHeight: '1.85rem', letterSpacing: '-0.01em' }],
        '3xl': ['1.875rem', { lineHeight: '2.1rem', letterSpacing: '-0.02em' }],
        '4xl': ['2.375rem', { lineHeight: '2.5rem', letterSpacing: '-0.02em' }],
        '5xl': ['3rem', { lineHeight: '3.1rem', letterSpacing: '-0.03em' }],
        '6xl': ['3.75rem', { lineHeight: '3.8rem', letterSpacing: '-0.03em' }],
      },
      colors: {
        // ── Legacy (kept, values refined to sit in the new system) ──
        primary: {
          DEFAULT: '#10b981',
          hover: '#059669',
          light: '#d1fae5',
          dark: '#064e3b',
        },
        accent: {
          DEFAULT: '#fbbf24',
          hover: '#f59e0b',
        },
        surface: {
          light: '#faf9f7',
          dark: '#12100e',
        },
        muted: {
          DEFAULT: '#a8a29e',
          dark: '#78716c',
        },

        // ── Brand: emerald (the water / verified green) ──
        brand: {
          50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7',
          400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857',
          800: '#065f46', 900: '#064e3b', 950: '#022c22',
        },
        // ── Coral: El Faro / the red cliffs that name the town (cabo ROJO) ──
        coral: {
          50: '#fff5f1', 100: '#ffe4d9', 200: '#ffc7b0',
          300: '#ff9f7d', 400: '#fb6d43', 500: '#f0491f', 600: '#dd3413',
          700: '#b72713', 800: '#932317', 900: '#781f16', 950: '#410c08',
        },
        // ── Gold: the sunset / sponsor / premium ──
        gold: {
          50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d',
          400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309',
          800: '#92400e', 900: '#78350f', 950: '#451a03',
        },
        // ── Sand: warm neutral (replaces cold slate) ──
        sand: {
          50: '#faf9f7', 100: '#f4f2ed', 200: '#e8e4db', 300: '#d6cfc1',
          400: '#b3a894', 500: '#8f8371', 600: '#726758', 700: '#5c5347',
          800: '#3a342c', 900: '#241f19', 950: '#151210',
        },

        // ── Semantic (CSS vars; light+dark) ──
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        paper: 'rgb(var(--paper) / <alpha-value>)',
        'paper-2': 'rgb(var(--paper-2) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        'ink-soft': 'rgb(var(--ink-soft) / <alpha-value>)',
        'ink-muted': 'rgb(var(--ink-muted) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        'line-strong': 'rgb(var(--line-strong) / <alpha-value>)',
      },
      borderRadius: {
        sm: '0.5rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        card: '1.25rem',   // legacy — 20px cards
        pill: '9999px',
        sheet: '1.75rem',  // 28px bottom sheets
      },
      boxShadow: {
        // Elevation scale — soft, warm-tinted, layered
        e1: '0 1px 2px rgba(23,20,17,0.06), 0 1px 3px rgba(23,20,17,0.05)',
        e2: '0 2px 4px rgba(23,20,17,0.05), 0 4px 10px rgba(23,20,17,0.06)',
        e3: '0 4px 8px rgba(23,20,17,0.05), 0 10px 24px rgba(23,20,17,0.08)',
        e4: '0 8px 16px rgba(23,20,17,0.06), 0 20px 40px rgba(23,20,17,0.12)',
        e5: '0 16px 32px rgba(23,20,17,0.10), 0 32px 64px rgba(23,20,17,0.18)',
        // legacy
        card: '0 4px 24px rgba(0,0,0,0.08)',
        'card-dark': '0 4px 24px rgba(0,0,0,0.3)',
        float: '0 20px 40px rgba(0,0,0,0.15)',
        'float-dark': '0 20px 40px rgba(0,0,0,0.4)',
        // focus ring helper
        ring: '0 0 0 3px rgba(16,185,129,0.35)',
      },
      zIndex: {
        base: '0',
        chrome: '1000',
        sheet: '2000',
        nav: '3000',
        modal: '4000',
        toast: '5000',
        max: '9999',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.32, 0.72, 0, 1)',
        'out-expo': 'cubic-bezier(0.19, 1, 0.22, 1)',
        'out-back': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out both',
        'slide-up': 'slideUp 0.42s cubic-bezier(0.32,0.72,0,1) both',
        'scale-in': 'scaleIn 0.24s cubic-bezier(0.34,1.56,0.64,1) both',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
        shimmer: 'shimmer 1.4s linear infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { transform: 'translateY(14px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        scaleIn: { from: { transform: 'scale(0.96)', opacity: '0' }, to: { transform: 'scale(1)', opacity: '1' } },
        pulseDot: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.4)', opacity: '0.6' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    }
  },
  plugins: [],
}

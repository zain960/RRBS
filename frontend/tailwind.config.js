/** @type {import('tailwindcss').Config} */

/**
 * RRBS design tokens.
 *
 * The palette is deliberately narrow: deep navy carries structure and intent,
 * warm amber carries action, and a warm-tinted neutral ramp keeps surfaces from
 * reading as cold grey. Semantic colours are single values because they only
 * ever appear as a state signal, never as a surface.
 *
 * Nothing here is themeable at runtime — a single property, one brand (SRS §1.2).
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Deep navy. Primary buttons, admin sidebar, links, headings.
        primary: {
          50: '#F2F5F8',
          100: '#E1E8EF',
          200: '#C3D1DE',
          300: '#9AB0C5',
          400: '#6B88A5',
          500: '#456686',
          600: '#2E4C69',
          700: '#1D3752',
          800: '#0F2942', // base
          900: '#081A2B',
        },
        // Warm amber/gold. CTAs, highlights, active states, focus ring.
        accent: {
          50: '#FDF8F1',
          100: '#F9EDDC',
          200: '#F1D9B6',
          300: '#E5BF87',
          400: '#D3A25C',
          500: '#B8823A', // base
          600: '#9C6A2C',
          700: '#7C5223',
          800: '#5C3C1B',
          900: '#3D2812',
        },
        // Warm off-white surfaces through to near-black ink.
        neutral: {
          50: '#FAF7F2', // base surface
          100: '#F3EFE8',
          200: '#E7E1D8',
          300: '#D2C9BC',
          400: '#A79D8E',
          500: '#7C7367',
          600: '#5C554B',
          700: '#403A33',
          800: '#26221D',
          900: '#0A0A0A', // ink
        },
        success: '#16A34A',
        danger: '#DC2626',
        warning: '#EA580C',
        info: '#0284C7',
      },

      fontFamily: {
        // Inter everywhere; Playfair reserved for hospitality moments on the
        // public side, never in the back office.
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },

      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }], // 12
        sm: ['0.875rem', { lineHeight: '1.25rem' }], // 14
        base: ['0.9375rem', { lineHeight: '1.5rem' }], // 15
        lg: ['1.0625rem', { lineHeight: '1.625rem' }], // 17
        xl: ['1.25rem', { lineHeight: '1.75rem' }], // 20
        '2xl': ['1.5rem', { lineHeight: '2rem' }], // 24
        '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.01em' }], // 30
        '4xl': ['2.5rem', { lineHeight: '2.75rem', letterSpacing: '-0.02em' }], // 40
        '5xl': ['3.5rem', { lineHeight: '3.75rem', letterSpacing: '-0.02em' }], // 56
      },

      borderRadius: {
        sm: '6px',
        DEFAULT: '10px',
        lg: '14px',
        xl: '20px',
        '2xl': '28px',
      },

      boxShadow: {
        card: '0 1px 3px rgba(15,41,66,0.08), 0 1px 2px rgba(15,41,66,0.04)',
        hover: '0 8px 24px rgba(15,41,66,0.10)',
        modal: '0 20px 60px rgba(15,41,66,0.20)',
      },

      // Named so a screen asks for the intent, not the millisecond count.
      transitionDuration: {
        hover: '150ms',
        state: '200ms',
      },

      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        // Kitchen queue: a status change should catch the eye once, not nag.
        'pulse-highlight': {
          '0%': { backgroundColor: 'rgba(184,130,58,0.18)' },
          '100%': { backgroundColor: 'transparent' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },

      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'fade-in-up': 'fade-in-up 200ms ease-out',
        'scale-in': 'scale-in 200ms ease-in-out',
        'slide-in-right': 'slide-in-right 200ms ease-out',
        'pulse-highlight': 'pulse-highlight 1.2s ease-out',
        shimmer: 'shimmer 1.6s infinite',
      },

      maxWidth: {
        '8xl': '88rem',
      },

      aspectRatio: {
        room: '16 / 9',
        food: '4 / 3',
      },
    },
  },
  plugins: [],
}

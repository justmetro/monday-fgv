const c = (n) => `hsl(var(--${n}))`;
module.exports = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Figtree', 'sans-serif'], heading: ['Figtree', 'sans-serif'] },
      colors: {
        border: c('border'), input: c('input'), ring: c('ring'), background: c('background'), foreground: c('foreground'),
        primary: { DEFAULT: c('primary'), foreground: c('primary-foreground') },
        secondary: { DEFAULT: c('secondary'), foreground: c('secondary-foreground') },
        destructive: { DEFAULT: c('destructive'), foreground: c('primary-foreground') },
        muted: { DEFAULT: c('muted'), foreground: c('muted-foreground') },
        accent: { DEFAULT: c('accent'), foreground: c('accent-foreground') },
        popover: { DEFAULT: c('popover'), foreground: c('popover-foreground') },
        card: { DEFAULT: c('card'), foreground: c('card-foreground') },
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)', xl: 'var(--radius-xl)', '2xl': 'var(--radius-2xl)' },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

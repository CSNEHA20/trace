/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: '#F4F4F5',
        canvasGrey: '#EFEFEF',
        surface: '#FFFFFF',
        surfaceVariant: '#EFEFEF',
        card: '#FFFFFF',
        pill: '#FFFFFF',
        primary: '#111111',
        secondary: '#F5A623',
        accent: '#F5A623',
        brandYellow: '#F5A623',
        brandAmber: '#FFBF00',
        deepBlack: '#111111',
        pureBlack: '#000000',
        text: '#111111',
        textSecondary: '#6B7280',
        muted: '#6B7280',
        border: '#E5E7EB',
        borderDark: '#D1D5DB',
        success: '#16A34A',
        error: '#DC2626',
        warning: '#F5A623',
      }
    },
  },
  plugins: [],
}


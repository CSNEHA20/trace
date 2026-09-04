/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: '#090D16',
        surface: '#121826',
        primary: '#00F2FE',
        secondary: '#4FACFE',
        accent: '#FF2A6D',
        text: '#F1F5F9',
        muted: '#64748B'
      }
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        archivo: ['Archivo', 'system-ui', 'sans-serif'],
      },
      colors: {
        hostsblue: {
          purple: '#A855F7',
          blue: '#0000FF',
          green: '#84D71A',
          dark: '#0a0a0a',
          card: '#141414',
        },
      },
      boxShadow: {
        'glow-purple': '0 0 20px rgba(168, 85, 247, 0.3)',
        'glow-blue': '0 0 20px rgba(0, 0, 255, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

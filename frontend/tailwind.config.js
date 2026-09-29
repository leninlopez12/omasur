/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        granate: {
          50: '#FDF3F5',
          100: '#FBE4E8',
          200: '#F5C7CF',
          300: '#E9A1AE',
          400: '#D46B7E',
          500: '#B03A50',
          600: '#7B1E2B',
          700: '#661822',
          800: '#4F131B',
          900: '#380D13',
        },
        // Verde oficial de Excel, para los botones de la plantilla.
        excel: {
          50: '#ECF6F0',
          100: '#D3EADD',
          600: '#217346',
          700: '#1B5E39',
        },
        whatsapp: {
          400: '#25D366',
          500: '#1EBE5D',
          600: '#128C7E',
          700: '#075E54',
        },
        yape: {
          100: '#F3E3F7',
          300: '#C77BD6',
          400: '#A24BB4',
          500: '#8A2E9C',
          600: '#742284',
          700: '#5C1A69',
          800: '#45134F',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        suave: '0 10px 40px -12px rgba(123, 30, 43, 0.25)',
      },
      keyframes: {
        aparecer: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        latido: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.06)' },
        },
        saltar: {
          '0%, 20%, 50%, 80%, 100%': { transform: 'translateY(0)' },
          '40%': { transform: 'translateY(-10px)' },
          '60%': { transform: 'translateY(-5px)' },
        },
        radar: {
          '0%': { transform: 'scale(1)', opacity: '0.75' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        // Entrada del modal: llega desde abajo y crece un poco de más antes
        // de asentarse, que es lo que le da el peso de objeto.
        emerger: {
          '0%': { opacity: '0', transform: 'translateY(40px) scale(0.92)' },
          '60%': { opacity: '1', transform: 'translateY(0) scale(1.02)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        sello: {
          '0%': { opacity: '0', transform: 'scale(0.4) rotate(-12deg)' },
          '70%': { opacity: '1', transform: 'scale(1.12) rotate(3deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
        },
        // El resplandor de atrás respira: sin esto la pantalla se ve congelada.
        respirar: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.75' },
          '50%': { transform: 'scale(1.18)', opacity: '1' },
        },
        flotar: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      animation: {
        aparecer: 'aparecer 0.6s ease-out both',
        latido: 'latido 2.6s ease-in-out infinite',
        saltar: 'saltar 2.2s ease-in-out infinite',
        radar: 'radar 1.6s ease-out infinite',
        emerger: 'emerger 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        sello: 'sello 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both',
        respirar: 'respirar 4s ease-in-out infinite',
        flotar: 'flotar 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

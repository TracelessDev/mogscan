/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Дорогая темная палитра (мягкий графит, не вырвиглазный черный)
        canvas: '#0E0F12',       // Основной фон экрана
        card: '#1A1B20',         // Приподнятые карточки
        stroke: '#282A30',       // Тонкие рамки карточек
        charcoal: '#FFFFFF',     // Основной текст теперь белый
        muted: '#8E929C',        // Второстепенный серый текст
        
        // Наши акценты
        yellow: {
          DEFAULT: '#FFE600',    // Заряженный желтый
          hover: '#ebd400',
        },
        pink: {
          DEFAULT: '#FF2E93',    // Акцентный розовый
        }
      },
      fontFamily: {
        bounded: ['Bounded', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '20px',
        '3xl': '28px',
      },
      boxShadow: {
        'block': '0 4px 24px rgba(0, 0, 0, 0.25)', // Мягкая тень в темной теме
      }
    },
  },
  plugins: [],
}
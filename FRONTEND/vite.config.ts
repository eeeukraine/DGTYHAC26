import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // Жестко задаем порт
    strictPort: true, // Запрещаем Vite автоматически менять порт, если 5173 занят
    hmr: {
      port: 5173, // HMR тоже на 5173
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8080', // Перенаправляем запросы к бэкенду
        changeOrigin: true,
      },
    },
  },
})
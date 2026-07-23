import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // O backend redireciona o OAuth para o FRONTEND_URL (http://localhost:3001),
  // então a porta do dev server precisa ser fixa e bater com ele.
  server: { port: 3001, strictPort: true },
})

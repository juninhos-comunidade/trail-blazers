/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@auth': fileURLToPath(new URL('./src/auth', import.meta.url)),
      '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
      '@content': fileURLToPath(new URL('./src/content', import.meta.url)),
      '@lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
      '@mocks': fileURLToPath(new URL('./src/mocks', import.meta.url)),
      '@pages': fileURLToPath(new URL('./src/pages', import.meta.url)),
      '@routes': fileURLToPath(new URL('./src/routes', import.meta.url)),
      '@theme': fileURLToPath(new URL('./src/theme', import.meta.url)),
    },
  },
  // O backend redireciona o OAuth para o FRONTEND_URL (http://localhost:3001),
  // então a porta do dev server precisa ser fixa e bater com ele.
  server: { port: 3001, strictPort: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.d.ts',
        'src/test/**',
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 70,
      },
    },
  },
})

// vite.config.ts
// Standard Vite + React config.
// Path alias '@' -> src/ so imports are always absolute.

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
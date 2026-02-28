import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'fs': resolve(__dirname, './src/utils/fs-mock.ts'),
      'module': resolve(__dirname, './src/utils/module-mock.ts'),
    }
  }
})

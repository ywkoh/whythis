import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@whythis/core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
      '@whythis/vue': fileURLToPath(new URL('./packages/vue/src/index.ts', import.meta.url)),
      '@whythis/vite': fileURLToPath(new URL('./packages/vite/src/index.ts', import.meta.url))
    }
  },
  test: {
    include: ['packages/**/*.test.ts']
  }
})

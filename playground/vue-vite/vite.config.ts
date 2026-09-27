import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import whyThis from '@whythis/vite'

export default defineConfig({
  plugins: [
    // WhyThis has enforce: 'pre', and is listed first to make the intended
    // source-instrumentation order explicit.
    whyThis(),
    vue()
  ]
})

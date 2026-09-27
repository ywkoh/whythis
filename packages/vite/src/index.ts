import type { Plugin, ResolvedConfig } from 'vite'
import { instrumentVueSfc } from './instrument.js'

export { extractDependencies } from './dependencies.js'
export { instrumentVueSfc } from './instrument.js'

/**
 * Must run before @vitejs/plugin-vue so it can instrument the original SFC.
 * It deliberately does nothing outside `mode: 'development'`.
 */
export default function whyThis(): Plugin {
  let config: ResolvedConfig | undefined

  return {
    name: 'whythis:vue-source-instrumentation',
    enforce: 'pre',
    configResolved(resolved) {
      config = resolved
    },
    transform(source, id) {
      if (!config || config.mode !== 'development') return null
      const filename = id.split('?', 1)[0]
      if (!filename.endsWith('.vue')) return null
      return instrumentVueSfc(source, {
        filename,
        root: config.root,
        enabled: true
      })?.code ?? null
    }
  }
}

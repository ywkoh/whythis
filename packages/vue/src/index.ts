import type { BindingMetadata } from '@whythis/core'
import { BindingRegistry } from '@whythis/core'
import { ensureOverlay } from './overlay.js'

const REGISTRY_KEY = '__whythis_registry__'

declare global {
  interface Window {
    [REGISTRY_KEY]?: BindingRegistry
  }
}

function registry(): BindingRegistry {
  if (typeof window === 'undefined') return new BindingRegistry()
  return (window[REGISTRY_KEY] ??= new BindingRegistry())
}

/** Called only by code injected by @whythis/vite in development SFC modules. */
export function registerMetadata(file: string, bindings: BindingMetadata[]): void {
  const current = registry()
  current.register(file, bindings)
  ensureOverlay(current)
}

export { formatValue, inspectElement, traceAsText } from './trace.js'
export type { VueInternalInstance } from './component-adapter.js'

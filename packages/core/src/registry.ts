import type { BindingMetadata } from './types.js'

/**
 * Runtime metadata index. Registering a file replaces its previous metadata,
 * which makes updates deterministic during Vite HMR.
 */
export class BindingRegistry {
  private readonly byElementId = new Map<string, BindingMetadata[]>()
  private readonly elementIdsByFile = new Map<string, Set<string>>()

  register(file: string, bindings: readonly BindingMetadata[]): void {
    const previousElementIds = this.elementIdsByFile.get(file)
    if (previousElementIds) {
      for (const elementId of previousElementIds) {
        this.byElementId.delete(elementId)
      }
    }

    const elementIds = new Set<string>()
    for (const binding of bindings) {
      const current = this.byElementId.get(binding.elementId) ?? []
      current.push(binding)
      this.byElementId.set(binding.elementId, current)
      elementIds.add(binding.elementId)
    }
    this.elementIdsByFile.set(file, elementIds)
  }

  get(elementId: string): readonly BindingMetadata[] {
    return this.byElementId.get(elementId) ?? []
  }

  clear(): void {
    this.byElementId.clear()
    this.elementIdsByFile.clear()
  }
}

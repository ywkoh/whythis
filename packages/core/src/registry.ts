import type { BindingMetadata, ComputedMetadata } from './types.js'

/**
 * Runtime metadata index. Registering a file replaces its previous metadata,
 * which makes updates deterministic during Vite HMR.
 */
export class BindingRegistry {
  private readonly byElementId = new Map<string, BindingMetadata[]>()
  private readonly elementIdsByFile = new Map<string, Set<string>>()
  private readonly computedByFile = new Map<string, Map<string, ComputedMetadata>>()

  register(
    file: string,
    bindings: readonly BindingMetadata[],
    computed: readonly ComputedMetadata[] = []
  ): void {
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
    this.computedByFile.set(file, new Map(computed.map((entry) => [entry.name, entry])))
  }

  get(elementId: string): readonly BindingMetadata[] {
    return this.byElementId.get(elementId) ?? []
  }

  getComputed(file: string, name: string): ComputedMetadata | undefined {
    return this.computedByFile.get(file)?.get(name)
  }

  clear(): void {
    this.byElementId.clear()
    this.elementIdsByFile.clear()
    this.computedByFile.clear()
  }
}

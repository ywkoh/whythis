import type { StateChange } from '@whythis/core'
import { getCurrentInstance, isRef, watch } from 'vue'
import { formatValue, isSensitivePath } from './value-format.js'

const MAX_CHANGES_PER_INSTANCE = 30
const changesByInstance = new WeakMap<object, StateChange[]>()

/** Values are formatted before storage, so the history never retains raw state. */
export function recordChange(instance: object | null, path: string, before: unknown, after: unknown): void {
  if (!instance) return
  const redact = isSensitivePath(path)
  const changes = changesByInstance.get(instance) ?? []
  changes.push({
    path,
    before: redact ? '[redacted]' : formatValue(before),
    after: redact ? '[redacted]' : formatValue(after),
    at: Date.now()
  })
  if (changes.length > MAX_CHANGES_PER_INSTANCE) changes.shift()
  changesByInstance.set(instance, changes)
}

export function recentChanges(instance: object | null, paths: readonly string[], limit = 5): StateChange[] {
  if (!instance || paths.length === 0) return []
  const relevant = new Set(paths)
  return (changesByInstance.get(instance) ?? [])
    .filter((entry) => relevant.has(entry.path))
    .slice(-limit)
    .reverse()
}

/** Called synchronously from instrumented <script setup> code in development. */
export function trackRef(value: unknown, path: string): void {
  const instance = getCurrentInstance()
  if (!instance || !isRef(value)) return
  watch(value, (after, before) => recordChange(instance, path, before, after), { flush: 'sync' })
}

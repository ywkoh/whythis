/**
 * A small deterministic hash for source IDs. It is not a security primitive;
 * it only keeps development DOM attributes concise and stable across reloads.
 */
export function stableId(prefix: string, input: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`
}

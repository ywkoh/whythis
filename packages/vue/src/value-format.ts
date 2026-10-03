const SENSITIVE_SEGMENT = /(?:token|secret|password|authorization|cookie|session)/i
export const REDACTED_VALUE = Symbol('whythis-redacted')

export function isSensitivePath(path: string): boolean {
  return path.split('.').some((segment) => SENSITIVE_SEGMENT.test(segment))
}

/** A conservative readable representation; object values are never recursively collected. */
export function formatValue(value: unknown): string {
  if (value === REDACTED_VALUE) return '[redacted]'
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  if (typeof value === 'string') return JSON.stringify(value.length > 180 ? `${value.slice(0, 177)}…` : value)
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  if (typeof value === 'function') return '[function]'
  if (Array.isArray(value)) return `[Array(${value.length})]`
  return '[object]'
}

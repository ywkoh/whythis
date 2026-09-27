import type {
  BindingMetadata,
  BindingTrace,
  DependencyValue,
  SelectionTrace
} from '@whythis/core'
import { BindingRegistry } from '@whythis/core'
import { componentName, getOwningComponent, readComponentPath } from './component-adapter.js'

const SENSITIVE_SEGMENT = /(?:token|secret|password|authorization|cookie|session)/i
const REDACTED_VALUE = Symbol('whythis-redacted')

function isSensitivePath(path: string): boolean {
  return path.split('.').some((segment) => SENSITIVE_SEGMENT.test(segment))
}

function dependencyValue(element: Element, path: string): DependencyValue {
  if (isSensitivePath(path)) return { path, status: 'redacted' }
  const value = readComponentPath(getOwningComponent(element), path)
  return value.found
    ? { path, status: 'available', value: value.value }
    : { path, status: 'unavailable' }
}

function renderedBindingValue(element: Element, binding: BindingMetadata): unknown {
  // Do not turn an inspected `:value="accessToken"` / `{{ token }}` into a
  // side channel. Direct values marked sensitive are redacted before reading
  // the DOM result as well as when rendering dependencies below.
  if (
    (binding.bindingName && SENSITIVE_SEGMENT.test(binding.bindingName)) ||
    binding.dependencies.some(isSensitivePath)
  ) {
    return REDACTED_VALUE
  }
  if (binding.bindingType === 'text') return element.textContent ?? ''

  const name = binding.bindingName
  if (!name) return undefined
  const candidate = element as unknown as Record<string, unknown>
  if (name in candidate) return candidate[name]
  return element.getAttribute(name)
}

function selectedSummary(element: Element): string {
  const tag = element.tagName.toLowerCase()
  const attributes = [...element.attributes]
    .filter((attribute) => attribute.name !== 'data-whythis-id')
    .slice(0, 3)
    .map((attribute) => {
      if (SENSITIVE_SEGMENT.test(attribute.name)) return `${attribute.name}="[redacted]"`
      return attribute.value === '' ? attribute.name : `${attribute.name}="${attribute.value}"`
    })
  return `<${[tag, ...attributes].join(' ')}>`
}

function traceBinding(element: Element, binding: BindingMetadata): BindingTrace {
  return {
    binding,
    result: renderedBindingValue(element, binding),
    dependencies: binding.dependencies.map((path) => dependencyValue(element, path))
  }
}

function nearestInstrumentedElement(element: Element): Element | null {
  return element.closest('[data-whythis-id]')
}

/** Resolves a selected DOM element using only registered source metadata. */
export function inspectElement(element: Element, registry: BindingRegistry): SelectionTrace {
  const selected = nearestInstrumentedElement(element)
  if (!selected) {
    return {
      selected: selectedSummary(element),
      component: componentName(getOwningComponent(element)),
      source: null,
      bindings: [],
      message: 'No supported WhyThis binding metadata was found for this element.'
    }
  }

  const elementId = selected.getAttribute('data-whythis-id')
  const bindings = elementId ? registry.get(elementId) : []
  const component = getOwningComponent(selected)
  return {
    selected: selectedSummary(selected),
    component: componentName(component),
    source: bindings[0]?.file ?? component?.type?.__file ?? null,
    bindings: bindings.map((binding) => traceBinding(selected, binding)),
    ...(bindings.length === 0
      ? { message: 'The element has a WhyThis ID but no currently registered metadata.' }
      : {})
  }
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

export function traceAsText(trace: SelectionTrace): string {
  const lines = ['WhyThis', `Selected: ${trace.selected}`]
  if (trace.component) lines.push(`Component: ${trace.component}`)
  if (trace.source) lines.push(`Source: ${trace.source}`)
  if (trace.message) lines.push(trace.message)
  for (const entry of trace.bindings) {
    const { binding } = entry
    lines.push('', `Binding: ${binding.bindingType === 'text' ? `{{ ${binding.expression} }}` : `:${binding.bindingName}="${binding.expression}"`}`)
    lines.push(
      `Current result: ${binding.bindingName ?? 'text'} = ${formatValue(entry.result)}`
    )
    for (const dependency of entry.dependencies) {
      const result =
        dependency.status === 'available'
          ? formatValue(dependency.value)
          : dependency.status === 'redacted'
            ? '[redacted]'
            : '[unavailable]'
      lines.push(`Direct dependency: ${dependency.path} = ${result}`)
    }
  }
  return lines.join('\n')
}

import type {
  BindingMetadata,
  BindingTrace,
  DependencyValue,
  SelectionTrace
} from '@whythis/core'
import { BindingRegistry } from '@whythis/core'
import { componentName, getOwningComponent, readComponentPath } from './component-adapter.js'
import { recentChanges } from './history.js'
import { formatValue, isSensitivePath, REDACTED_VALUE } from './value-format.js'
export { formatValue } from './value-format.js'

function dependencyValue(element: Element, path: string): DependencyValue {
  if (isSensitivePath(path)) return { path, status: 'redacted' }
  const value = readComponentPath(getOwningComponent(element), path)
  return value.found
    ? { path, status: 'available', value: value.value }
    : { path, status: 'unavailable' }
}

function displayDependency(dependency: DependencyValue): string {
  return dependency.status === 'available'
    ? formatValue(dependency.value)
    : dependency.status === 'redacted'
      ? '[redacted]'
      : '[unavailable]'
}

function renderedBindingValue(element: Element, binding: BindingMetadata): unknown {
  // Do not turn an inspected `:value="accessToken"` / `{{ token }}` into a
  // side channel. Direct values marked sensitive are redacted before reading
  // the DOM result as well as when rendering dependencies below.
  if (
    (binding.bindingName && isSensitivePath(binding.bindingName)) ||
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
      if (isSensitivePath(attribute.name)) return `${attribute.name}="[redacted]"`
      return attribute.value === '' ? attribute.name : `${attribute.name}="${attribute.value}"`
    })
  return `<${[tag, ...attributes].join(' ')}>`
}

function traceBinding(
  element: Element,
  binding: BindingMetadata,
  registry: BindingRegistry
): BindingTrace {
  const computed = binding.dependencies.flatMap((name) => {
    const metadata = registry.getComputed(binding.file, name)
    return metadata ? [{
      name,
      file: metadata.file,
      line: metadata.line,
      references: metadata.references.map((path) => dependencyValue(element, path))
    }] : []
  })
  const relevantPaths = [
    ...binding.dependencies,
    ...computed.flatMap((entry) => entry.references.map((reference) => reference.path))
  ]
  return {
    binding,
    result: renderedBindingValue(element, binding),
    dependencies: binding.dependencies.map((path) => dependencyValue(element, path)),
    computed,
    recentChanges: recentChanges(getOwningComponent(element), relevantPaths)
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
    bindings: bindings.map((binding) => traceBinding(selected, binding, registry)),
    ...(bindings.length === 0
      ? { message: 'The element has a WhyThis ID but no currently registered metadata.' }
      : {})
  }
}

export function traceAsText(trace: SelectionTrace): string {
  const lines = ['WhyThis', `Selected: ${trace.selected}`]
  if (trace.component) lines.push(`Component: ${trace.component}`)
  if (trace.source) lines.push(`Source: ${trace.source}`)
  if (trace.message) lines.push(trace.message)
  for (const entry of trace.bindings) {
    const { binding } = entry
    lines.push('', `Binding: ${binding.bindingType === 'text' ? `{{ ${binding.expression} }}` : `:${binding.bindingName}="${binding.expression}"`}`)
    lines.push(`Location: ${binding.file}:${binding.line}`)
    lines.push(binding.bindingType === 'text'
      ? `Rendered element text: ${formatValue(entry.result)}`
      : `Current result: ${binding.bindingName} = ${formatValue(entry.result)}`)
    for (const dependency of entry.dependencies) {
      lines.push(`Direct dependency: ${dependency.path} = ${displayDependency(dependency)}`)
    }
    for (const computed of entry.computed) {
      lines.push(`Computed getter source (static): ${computed.name} at ${computed.file}:${computed.line}`)
      for (const reference of computed.references) {
        lines.push(`Getter source reference: ${reference.path} = ${displayDependency(reference)}`)
      }
    }
    for (const change of entry.recentChanges) {
      lines.push(`Observed change: ${change.path}: ${change.before} → ${change.after} at ${new Date(change.at).toISOString()} (writer unknown)`)
    }
  }
  return lines.join('\n')
}

/** Copyable context with bounded, preformatted values and explicit evidence limits. */
export function traceAsMarkdown(trace: SelectionTrace): string {
  const lines = [
    '# WhyThis Debug Context',
    '', '## Target', JSON.stringify(trace.selected),
    '', '## Component', trace.component ?? '[unavailable]'
  ]
  if (trace.message) lines.push('', '## Note', trace.message)

  lines.push('', '## Bindings')
  for (const entry of trace.bindings) {
    const binding = entry.binding
    lines.push(
      '', `### ${binding.bindingName ?? 'text'}`,
      `- Source: ${binding.file}:${binding.line}`,
      `- Expression: ${JSON.stringify(binding.expression)}`,
      `- Rendered result: ${formatValue(entry.result)}`
    )
    for (const dependency of entry.dependencies) {
      lines.push(`- Direct template dependency: ${dependency.path} = ${displayDependency(dependency)}`)
    }
    for (const computed of entry.computed) {
      lines.push(`- Computed getter source (static): ${computed.name} at ${computed.file}:${computed.line}`)
      for (const reference of computed.references) {
        lines.push(`  - Getter source reference: ${reference.path} = ${displayDependency(reference)}`)
      }
    }
  }

  lines.push('', '## Recent observed changes')
  const seen = new Set<string>()
  const changes = trace.bindings.flatMap((entry) => entry.recentChanges)
    .sort((a, b) => b.at - a.at)
  for (const change of changes) {
    const key = `${change.path}:${change.at}:${change.before}:${change.after}`
    if (seen.has(key)) continue
    seen.add(key)
    lines.push(`- ${change.path}: ${change.before} → ${change.after} at ${new Date(change.at).toISOString()} (writer unknown)`)
  }
  if (seen.size === 0) lines.push('None observed since instrumentation started.')

  lines.push('', '## Evidence limits',
    'Computed links are static getter source references. Change history covers only instrumented local refs after setup; writer locations are not captured.')
  return lines.join('\n')
}

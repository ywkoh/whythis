/**
 * Vue does not expose a public DOM-to-component lookup. This small development
 * adapter isolates the private dev fields used by the overlay so no other
 * WhyThis module depends on Vue internals.
 *
 * Compatibility note: `__vueParentComponent` and `setupState` are Vue runtime
 * internals and can change across Vue releases. We feature-detect both fields
 * and degrade to unavailable values when they are absent.
 */
export interface VueInternalInstance {
  proxy?: Record<PropertyKey, unknown>
  setupState?: Record<PropertyKey, unknown>
  type?: {
    __file?: string
    __name?: string
    name?: string
  }
}

interface VueOwnedElement extends Element {
  __vueParentComponent?: VueInternalInstance
}

export function getOwningComponent(element: Element): VueInternalInstance | null {
  let current: Element | null = element
  while (current) {
    const component = (current as VueOwnedElement).__vueParentComponent
    if (component) return component
    current = current.parentElement
  }
  return null
}

export function componentName(component: VueInternalInstance | null): string | null {
  if (!component) return null
  const type = component.type
  if (type?.__name || type?.name) return type.__name ?? type.name ?? null
  const file = type?.__file
  return file ? file.split('/').pop()?.replace(/\.vue$/, '') ?? null : null
}

function hasProperty(target: object | undefined, key: string): boolean {
  return Boolean(target && Reflect.has(target, key))
}

function unwrapRef(value: unknown): unknown {
  if (
    value &&
    typeof value === 'object' &&
    (value as { __v_isRef?: boolean }).__v_isRef === true
  ) {
    return (value as { value: unknown }).value
  }
  return value
}

/** Reads a known template dependency without calling arbitrary application code. */
export function readComponentPath(
  component: VueInternalInstance | null,
  path: string
): { found: boolean; value?: unknown } {
  if (!component || path.length === 0) return { found: false }
  const [root, ...segments] = path.split('.')

  // `proxy` is Vue's public component-instance surface for Options API and
  // normal setup() return values. setupState is an internal fallback needed for
  // template-local <script setup> bindings, which are closed publicly by Vue.
  let current: unknown
  if (hasProperty(component.proxy, root)) {
    current = component.proxy![root]
  } else if (hasProperty(component.setupState, root)) {
    current = component.setupState![root]
  } else {
    return { found: false }
  }

  current = unwrapRef(current)
  for (const segment of segments) {
    if (current === null || (typeof current !== 'object' && typeof current !== 'function')) {
      return { found: false }
    }
    if (!Reflect.has(current, segment)) return { found: false }
    current = unwrapRef((current as Record<string, unknown>)[segment])
  }
  return { found: true, value: current }
}

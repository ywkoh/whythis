export type BindingKind = 'attribute' | 'text'

/** Metadata generated from one statically understood Vue template binding. */
export interface BindingMetadata {
  /** Deterministic ID for this particular source binding. */
  id: string
  /** Deterministic ID placed on the owning native DOM element. */
  elementId: string
  /** Project-relative SFC filename. */
  file: string
  /** Source element tag, as written in the template. */
  element: string
  bindingType: BindingKind
  /** `null` for an interpolation. */
  bindingName: string | null
  /** Original JavaScript expression, without a guessed rewrite. */
  expression: string
  /** Direct static references found in the expression. */
  dependencies: string[]
  /** One-based source line for the binding. */
  line: number
}

/** Direct source references in a Composition API computed getter. */
export interface ComputedMetadata {
  name: string
  file: string
  line: number
  references: string[]
}

export interface DependencyValue {
  path: string
  status: 'available' | 'unavailable' | 'redacted'
  value?: unknown
}

export interface BindingTrace {
  binding: BindingMetadata
  result: unknown
  dependencies: DependencyValue[]
  computed: ComputedTrace[]
}

export interface ComputedTrace {
  name: string
  file: string
  line: number
  /** Static getter references with their current values, not runtime tracking. */
  references: DependencyValue[]
}

export interface SelectionTrace {
  selected: string
  component: string | null
  source: string | null
  bindings: BindingTrace[]
  message?: string
}

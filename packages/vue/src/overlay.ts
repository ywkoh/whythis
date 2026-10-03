import type { SelectionTrace } from '@whythis/core'
import { BindingRegistry } from '@whythis/core'
import { formatValue, inspectElement, traceAsText } from './trace.js'

const OVERLAY_ID = '__whythis_overlay__'

interface OverlayState {
  host: HTMLElement
  registry: BindingRegistry
  lastSelection: SelectionTrace | null
  inspect: (element: Element) => SelectionTrace
}

declare global {
  interface Window {
    __WHYTHIS__?: {
      inspect(element: Element): SelectionTrace
      getLastSelection(): SelectionTrace | null
    }
    [OVERLAY_ID]?: OverlayState
  }
}

function isOverlayEvent(event: Event, host: HTMLElement): boolean {
  return event.composedPath().includes(host)
}

function renderTrace(root: ShadowRoot, trace: SelectionTrace): void {
  const drawer = root.querySelector<HTMLElement>('[data-whythis-drawer]')
  const content = root.querySelector<HTMLElement>('[data-whythis-content]')
  if (!drawer || !content) return
  drawer.hidden = false
  content.replaceChildren()

  const append = (tag: string, text: string, className?: string): HTMLElement => {
    const node = document.createElement(tag)
    node.textContent = text
    if (className) node.className = className
    content.append(node)
    return node
  }
  append('h2', 'WhyThis')
  append('p', 'Selected', 'label')
  append('code', trace.selected)
  if (trace.component) {
    append('p', 'Component', 'label')
    append('p', trace.component)
  }
  if (trace.source) {
    append('p', 'Source', 'label')
    append('p', trace.source)
  }
  if (trace.message) append('p', trace.message, 'notice')

  for (const entry of trace.bindings) {
    const { binding } = entry
    append('hr', '')
    append('p', 'Binding', 'label')
    append(
      'code',
      binding.bindingType === 'text'
        ? `{{ ${binding.expression} }}`
        : `:${binding.bindingName}="${binding.expression}"`
    )
    append('p', 'Location', 'label')
    append('code', `${binding.file}:${binding.line}`)
    append('p', binding.bindingType === 'text' ? 'Rendered element text' : 'Current result', 'label')
    append('code', binding.bindingType === 'text'
      ? formatValue(entry.result)
      : `${binding.bindingName} = ${formatValue(entry.result)}`)
    append('p', 'Direct template dependencies', 'label')
    if (entry.dependencies.length === 0) {
      append('p', 'No static direct dependency found.', 'notice')
    }
    for (const dependency of entry.dependencies) {
      const value =
        dependency.status === 'available'
          ? formatValue(dependency.value)
          : dependency.status === 'redacted'
            ? '[redacted]'
            : '[unavailable]'
      append('code', `${dependency.path} = ${value}`, 'dependency')
    }
    for (const computed of entry.computed) {
      append('p', 'Computed getter source references (static)', 'label')
      append('code', `${computed.name} at ${computed.file}:${computed.line}`)
      if (computed.references.length === 0) {
        append('p', 'No supported local getter source reference found.', 'notice')
      }
      for (const reference of computed.references) {
        const value = reference.status === 'available'
          ? formatValue(reference.value)
          : reference.status === 'redacted'
            ? '[redacted]'
            : '[unavailable]'
        append('code', `${reference.path} = ${value}`, 'dependency')
      }
    }
  }
}

function createOverlay(registry: BindingRegistry): OverlayState {
  const host = document.createElement('div')
  host.id = OVERLAY_ID
  document.documentElement.append(host)
  const root = host.attachShadow({ mode: 'open' })
  root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      button { cursor: pointer; border: 0; font: inherit; }
      #whythis-trigger { position: fixed; right: 20px; bottom: 20px; z-index: 2147483647; padding: 10px 13px; border-radius: 8px; color: #fff; background: #1d4ed8; box-shadow: 0 3px 12px #0004; }
      #whythis-trigger[data-active="true"] { background: #b45309; }
      #whythis-highlight { position: fixed; z-index: 2147483646; display: none; pointer-events: none; outline: 2px solid #f59e0b; background: #f59e0b1f; }
      [data-whythis-drawer] { position: fixed; z-index: 2147483646; top: 0; right: 0; width: min(430px, 92vw); height: 100vh; overflow: auto; padding: 22px; color: #e5e7eb; background: #111827; box-shadow: -6px 0 20px #0005; font-size: 13px; line-height: 1.5; }
      h2 { margin: 0 0 20px; font-size: 20px; } p { margin: 5px 0; } code { display: block; overflow-wrap: anywhere; padding: 5px 7px; border-radius: 4px; background: #1f2937; color: #fef3c7; } .label { margin-top: 15px; color: #9ca3af; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; } .dependency { margin-top: 5px; color: #bfdbfe; } .notice { color: #fbbf24; } hr { margin: 20px 0; border: 0; border-top: 1px solid #374151; } .close { position: absolute; top: 14px; right: 14px; padding: 5px 8px; color: #e5e7eb; background: #374151; border-radius: 4px; } .actions { display: flex; gap: 8px; margin-top: 22px; } .actions button { padding: 8px 10px; color: #fff; background: #374151; border-radius: 5px; }
    </style>
    <button id="whythis-trigger" type="button">WhyThis</button>
    <div id="whythis-highlight"></div>
    <aside data-whythis-drawer hidden><button class="close" type="button" data-whythis-close>Close</button><div data-whythis-content></div><div class="actions"><button type="button" data-whythis-copy>Copy trace</button><button type="button" data-whythis-log>Log to console</button></div></aside>
  `

  let selecting = false
  let suppressClick = false
  let highlighted: Element | null = null
  let lastSelection: SelectionTrace | null = null
  const trigger = root.querySelector<HTMLButtonElement>('#whythis-trigger')!
  const highlight = root.querySelector<HTMLElement>('#whythis-highlight')!
  const drawer = root.querySelector<HTMLElement>('[data-whythis-drawer]')!

  const placeHighlight = (element: Element | null): void => {
    highlighted = element
    if (!element) {
      highlight.style.display = 'none'
      return
    }
    const box = element.getBoundingClientRect()
    Object.assign(highlight.style, {
      display: 'block',
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.width}px`,
      height: `${box.height}px`
    })
  }

  const endSelection = (): void => {
    selecting = false
    trigger.dataset.active = 'false'
    document.removeEventListener('pointermove', onMove, true)
    document.removeEventListener('pointerdown', onPointerDown, true)
    document.removeEventListener('keydown', onKeydown, true)
    placeHighlight(null)
  }
  const inspect = (element: Element): SelectionTrace => {
    const trace = inspectElement(element, registry)
    lastSelection = trace
    renderTrace(root, trace)
    return trace
  }
  const onMove = (event: PointerEvent): void => {
    if (isOverlayEvent(event, host)) return placeHighlight(null)
    const target = event.target instanceof Element ? event.target : null
    placeHighlight(target)
  }
  const onPointerDown = (event: PointerEvent): void => {
    if (isOverlayEvent(event, host)) return
    if (event.button !== 0) return
    event.preventDefault()
    event.stopImmediatePropagation()
    const target = event.target instanceof Element ? event.target : null
    endSelection()
    if (target) {
      suppressClick = true
      inspect(target)
    }
  }
  const onClick = (event: MouseEvent): void => {
    if (!suppressClick) return
    suppressClick = false
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  const onPointerUp = (): void => {
    // Disabled controls do not dispatch click; release the guard after the
    // pointer sequence while still suppressing clicks on enabled controls.
    setTimeout(() => { suppressClick = false }, 0)
  }
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') endSelection()
  }
  const beginSelection = (): void => {
    if (selecting) return endSelection()
    drawer.hidden = true
    selecting = true
    trigger.dataset.active = 'true'
    document.addEventListener('pointermove', onMove, true)
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeydown, true)
  }

  trigger.addEventListener('click', beginSelection)
  document.addEventListener('click', onClick, true)
  document.addEventListener('pointerup', onPointerUp, true)
  root.querySelector('[data-whythis-close]')?.addEventListener('click', () => {
    drawer.hidden = true
  })
  root.querySelector('[data-whythis-copy]')?.addEventListener('click', async () => {
    if (lastSelection) await navigator.clipboard?.writeText(traceAsText(lastSelection))
  })
  root.querySelector('[data-whythis-log]')?.addEventListener('click', () => {
    if (lastSelection) console.info('[WhyThis]', lastSelection)
  })

  return {
    host,
    registry,
    get lastSelection() {
      return lastSelection
    },
    inspect
  }
}

export function ensureOverlay(registry: BindingRegistry): OverlayState | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null
  const current = window[OVERLAY_ID]
  if (current) return current

  const state = createOverlay(registry)
  window[OVERLAY_ID] = state
  window.__WHYTHIS__ = Object.freeze({
    inspect: state.inspect,
    getLastSelection: () => state.lastSelection
  })
  return state
}

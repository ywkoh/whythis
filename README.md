# WhyThis — Vue 3 MVP

Development-only debugger for answering: “which Vue template binding and direct template dependency produced this DOM state?” It is deliberately not a state inspector, Vue DevTools replacement, or provenance system for network/Pinia.

## Run the playground

```bash
npm install
npm run dev
```

Open the Vite URL, click **WhyThis**, and select the disabled **Order** button. The trace shows `disabled = true`, `canOrder = false`, and the computed getter's source reference `stock = 0`. Toggle stock, then select it again to see the values update.

To verify the production exclusion:

```bash
npm run verify:production
```

The verification searches for generated runtime/metadata markers only (the demo's own “WhyThis” text is allowed). The Vite plugin only transforms in `mode === 'development'`, so the production application imports neither the runtime overlay nor its metadata.

## Package use

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import whyThis from '@whythis/vite'

export default defineConfig({
  plugins: [whyThis(), vue()]
})
```

`@whythis/vite` uses `enforce: 'pre'`, so the original `.vue` source is seen before `@vitejs/plugin-vue`; listing it first makes that ordering clear.

## Architecture and guarantees

`@whythis/core` contains the typed binding model, deterministic FNV-based IDs, and the HMR-safe registry. `@whythis/vite` parses each SFC with `@vue/compiler-sfc`, parses its template with `@vue/compiler-dom`, and parses binding expressions with `@babel/parser`/AST traversal. It instruments native element `v-bind` directives and `{{ interpolation }}` only. A native source element gets `data-whythis-id`; full metadata is registered at runtime, not put into the DOM.

`@whythis/vue` owns the Shadow DOM floating button, selection overlay, drawer, copy/log actions, and read-only `window.__WHYTHIS__.inspect(element)` plus `getLastSelection()`. It reads the selected DOM property/attribute for the current rendered result and evaluates only static direct expression references, such as `canOrder`, `stock`, and `member.active`.

The direct template dependency edge is exact source syntax. For a named, top-level Composition API `computed()` getter in `<script setup>`, WhyThis also reports direct local source references. `:disabled="!canOrder"` reports `canOrder`, then the getter source reference `stock` and its current value. This is static source analysis: it does not prove that a conditional branch read `stock` at runtime or identify the code that last changed it. Dynamic member paths, event handlers, component VNode bindings, Pinia, requests, and mutation history remain outside this MVP.

## Vue API boundary

There is no Vue public API that maps an arbitrary DOM element to its owning component. The runtime has one isolated adapter which feature-detects the Vue development internals `element.__vueParentComponent` and `instance.setupState`. The former finds the owner; the latter is necessary because `<script setup>` bindings are intentionally closed on the public instance. The adapter tries the public `instance.proxy` first and degrades to `[unavailable]` if either internal field changes. No other module uses Vue internals.

This makes DOM ownership and `<script setup>` value lookup **feasible with a documented Vue-version limitation**, rather than a claimed public guarantee. SFC/template AST analysis and the compact DOM-ID registry are reliable. The computed link is limited to statically recognized top-level `computed()` declarations with function getters in `<script setup>`. Runtime computed dependency provenance would require separate opt-in instrumentation; the current source references must not be presented as observed reactive reads.

## Test

```bash
npm test
```

Tests cover SFC/template analysis, IDs, expression dependencies (including member expressions), the registry/HMR replacement, runtime adapter behavior, and disabled production instrumentation.

To run the browser smoke test for the playground's Order button, install Chrome or Chromium and run:

```bash
npm run test:browser
```

Set `CHROME_PATH` if the browser executable is outside the standard macOS or Linux locations. This checks the disabled and enabled button trace, computed getter source reference, source lines, copied text, and picker click suppression in a real browser.

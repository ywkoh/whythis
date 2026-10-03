# @whythis/vite

WhyThis helps you inspect which Vue template binding produced a selected DOM value. It runs in Vite development mode and shows the binding, its source file, and the current values of direct template dependencies.

## Install

In a Vue 3 application using Vite:

```bash
npm install -D @whythis/vite @whythis/vue
```

Add the plugin to `vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import whyThis from '@whythis/vite'

export default defineConfig({
  plugins: [whyThis(), vue()]
})
```

Start the development server, click the **WhyThis** button, then select an element. The drawer shows its supported bindings, direct template dependencies, and recent observed changes. **Copy trace** copies a plain text trace; **Copy for AI** copies structured Markdown.

For example, selecting `<button :disabled="!canOrder">Order</button>` can show that `disabled` is `true`, `canOrder` is `false`, and the `canOrder` getter references `stock`, whose current value is `0`.

## Current scope

WhyThis instruments native element `v-bind` directives and text interpolations in Vue single-file components. It reads direct references written in the template expression. It also analyzes named, top-level Composition API `computed()` getters in `<script setup>` and shows their direct local source references and current values when available. These references come from source code; they do not prove which conditional branch ran.

Relevant local `ref()` and `shallowRef()` values in `<script setup>` are observed in development. The drawer shows recent changes per component instance, including previous and new values and time. History starts after setup, is bounded in memory, and does not identify the writer location. Pinia mutation details, network requests, and component bindings are not included.

The plugin only transforms files when Vite's mode is `development`. Some value lookups rely on Vue development internals and may be unavailable with other Vue versions. Sensitive-looking fields such as tokens and passwords are redacted in the trace.

Source code, playground, and detailed limitations: [WhyThis on GitHub](https://github.com/ywkoh/whythis).

MIT licensed.

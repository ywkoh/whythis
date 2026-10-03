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

Start the development server, click the **WhyThis** button, then select an element. The drawer shows its supported bindings and their direct template dependencies. **Copy trace** copies the current trace as text.

For example, selecting `<button :disabled="!canOrder">Order</button>` can show that `disabled` is `true` and `canOrder` is `false`.

## Current scope

WhyThis instruments native element `v-bind` directives and text interpolations in Vue single-file components. It reads direct references written in the template expression. In the example above, it can report `canOrder`; it does not yet trace the computed getter back to `stock` or show which code last changed `stock`. Pinia, network requests, mutation history, and component bindings are not included.

The plugin only transforms files when Vite's mode is `development`. Some value lookups rely on Vue development internals and may be unavailable with other Vue versions. Sensitive-looking fields such as tokens and passwords are redacted in the trace.

Source code, playground, and detailed limitations: [WhyThis on GitHub](https://github.com/ywkoh/whythis).

MIT licensed.

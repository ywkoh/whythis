import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const chromePath = process.env.CHROME_PATH ?? [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
].find(existsSync)
assert.ok(chromePath, 'Set CHROME_PATH to a Chrome or Chromium executable')
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function availablePort() {
  const server = createServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise((resolve) => server.close(resolve))
  return port
}

async function waitFor(check, label, processToWatch) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (processToWatch.exitCode !== null) throw new Error(`${label} exited with ${processToWatch.exitCode}`)
    try {
      const result = await check()
      if (result) return result
    } catch { /* The server may still be starting. */ }
    await pause(100)
  }
  throw new Error(`Timed out waiting for ${label}`)
}

class ChromePage {
  constructor(socket) {
    this.socket = socket
    this.nextId = 1
    this.pending = new Map()
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      const operation = this.pending.get(message.id)
      if (!operation) return
      this.pending.delete(message.id)
      if (message.error) operation.reject(new Error(message.error.message))
      else operation.resolve(message.result)
    })
  }

  send(method, params = {}) {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  async evaluate(expression) {
    const response = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    })
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text)
    return response.result.value
  }

  async click(selector) {
    const point = await this.evaluate(`(() => {
      const element = ${selector}
      element.scrollIntoView({ block: 'center' })
      const rect = element.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    })()`)
    await this.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1
    })
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1
    })
    await pause(30)
  }
}

const profile = await mkdtemp(join(tmpdir(), 'whythis-chrome-'))
const port = await availablePort()
const server = spawn(process.execPath, [
  join(root, 'node_modules/vite/bin/vite.js'),
  '--host', '127.0.0.1', '--port', String(port), '--strictPort'
], { cwd: join(root, 'playground/vue-vite'), stdio: 'ignore' })
let chrome
let page

try {
  await waitFor(async () => (await fetch(`http://127.0.0.1:${port}/`)).ok, 'Vite', server)
  chrome = spawn(chromePath, [
    '--headless=new', '--no-first-run', '--no-default-browser-check',
    '--disable-gpu', '--remote-debugging-port=0',
    `--user-data-dir=${profile}`, 'about:blank'
  ], { stdio: 'ignore' })
  const debugPort = await waitFor(async () => {
    const data = await readFile(join(profile, 'DevToolsActivePort'), 'utf8')
    return Number(data.split('\n')[0])
  }, 'Chrome', chrome)
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()
  const target = targets.find((entry) => entry.type === 'page')
  assert.ok(target, 'Chrome page target exists')
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  page = new ChromePage(socket)
  await page.send('Page.enable')
  await page.send('Runtime.enable')
  await page.send('Page.navigate', { url: `http://127.0.0.1:${port}/` })

  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await page.evaluate("Boolean(window.__WHYTHIS__ && document.querySelector('button.primary'))")) break
    await pause(100)
  }
  assert.equal(await page.evaluate("Boolean(window.__WHYTHIS__ && document.querySelector('button.primary'))"), true)

  const trigger = "document.querySelector('#__whythis_overlay__').shadowRoot.querySelector('#whythis-trigger')"
  const order = "document.querySelector('button.primary')"
  const stock = "document.querySelector('.controls button')"
  const expectedLine = (await readFile(join(root, 'playground/vue-vite/src/components/OrderButton.vue'), 'utf8'))
    .split('\n').findIndex((line) => line.includes(':disabled="!canOrder"')) + 1
  const computedLine = (await readFile(join(root, 'playground/vue-vite/src/components/OrderButton.vue'), 'utf8'))
    .split('\n').findIndex((line) => line.includes('const canOrder = computed(')) + 1

  async function selectedOrder(expectedDisabled, expectedRecent = []) {
    await page.click(trigger)
    assert.equal(await page.evaluate(`${trigger}.dataset.active`), 'true', 'picker is active')
    await page.click(order)
    const trace = await page.evaluate('window.__WHYTHIS__.getLastSelection()')
    assert.match(trace.selected, /<button class="primary"/)
    assert.equal(trace.component, 'OrderButton')
    assert.equal(trace.source, 'src/components/OrderButton.vue')
    assert.equal(trace.bindings.length, 1)
    const entry = trace.bindings[0]
    assert.equal(entry.binding.expression, '!canOrder')
    assert.equal(entry.binding.line, expectedLine)
    assert.equal(entry.result, expectedDisabled)
    assert.deepEqual(entry.dependencies, [{
      path: 'canOrder', status: 'available', value: !expectedDisabled
    }])
    assert.deepEqual(entry.computed, [{
      name: 'canOrder',
      file: 'src/components/OrderButton.vue',
      line: computedLine,
      references: [{ path: 'stock', status: 'available', value: expectedDisabled ? 0 : 3 }]
    }])
    assert.deepEqual(entry.recentChanges.map(({ path, before, after }) => ({ path, before, after })), expectedRecent)
    for (const change of entry.recentChanges) assert.ok(Number.isFinite(change.at))
    const drawer = await page.evaluate("document.querySelector('#__whythis_overlay__').shadowRoot.querySelector('[data-whythis-content]').innerText")
    assert.ok(drawer.includes(`OrderButton.vue:${expectedLine}`))
    assert.ok(drawer.includes(`disabled = ${expectedDisabled}`))
    assert.ok(drawer.includes(`canOrder = ${!expectedDisabled}`))
    assert.match(drawer, /computed getter source references \(static\)/i)
    assert.ok(drawer.includes(`canOrder at src/components/OrderButton.vue:${computedLine}`))
    assert.ok(drawer.includes(`stock = ${expectedDisabled ? 0 : 3}`))
    if (expectedRecent.length > 0) {
      assert.match(drawer, /recent observed changes/i)
      assert.ok(drawer.includes(`${expectedRecent[0].before} → ${expectedRecent[0].after}`))
    }
  }

  await selectedOrder(true)
  await page.evaluate(`(() => {
    window.__copiedTrace = null
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (value) => { window.__copiedTrace = value } }
    })
    document.querySelector('#__whythis_overlay__').shadowRoot.querySelector('[data-whythis-copy]').click()
  })()`)
  const copied = await page.evaluate('window.__copiedTrace')
  assert.ok(copied.includes(`Location: src/components/OrderButton.vue:${expectedLine}`))
  assert.ok(copied.includes('Current result: disabled = true'))
  assert.ok(copied.includes('Direct dependency: canOrder = false'))
  assert.ok(copied.includes(`Computed getter source (static): canOrder at src/components/OrderButton.vue:${computedLine}`))
  assert.ok(copied.includes('Getter source reference: stock = 0'))

  await page.click(stock)
  assert.equal(await page.evaluate(`${order}.disabled`), false)
  await selectedOrder(false, [{ path: 'stock', before: '0', after: '3' }])

  await page.evaluate("document.querySelector('#__whythis_overlay__').shadowRoot.querySelector('[data-whythis-ai]').click()")
  const aiContext = await page.evaluate('window.__copiedTrace')
  assert.ok(aiContext.includes('# WhyThis Debug Context'))
  assert.ok(aiContext.includes('## Recent observed changes'))
  assert.ok(aiContext.includes('stock: 0 → 3'))
  assert.ok(aiContext.includes('writer unknown'))

  // Picking an enabled control must inspect it without running its click handler.
  await page.click(trigger)
  await page.click(stock)
  assert.equal(await page.evaluate(`${order}.disabled`), false)

  await page.click(stock)
  assert.equal(await page.evaluate(`${order}.disabled`), true)
  await selectedOrder(true, [
    { path: 'stock', before: '3', after: '0' },
    { path: 'stock', before: '0', after: '3' }
  ])

  console.log('Browser smoke passed: Order trace, stock history, Copy for AI, source lines, and click suppression')
} finally {
  page?.socket.close()
  async function stop(child) {
    if (!child || child.exitCode !== null) return
    const exited = new Promise((resolve) => child.once('exit', resolve))
    child.kill()
    await Promise.race([exited, pause(3000)])
  }
  await Promise.all([stop(chrome), stop(server)])
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(profile, { recursive: true, force: true })
      break
    } catch (error) {
      if (error.code !== 'ENOTEMPTY' || attempt === 4) throw error
      await pause(100)
    }
  }
}

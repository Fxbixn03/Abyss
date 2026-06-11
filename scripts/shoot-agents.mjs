#!/usr/bin/env node
/**
 * Capture real screenshots of the running Abyss app — each agent in dark and
 * light mode — and assemble them into a looping GIF.
 *
 * How it works: launch the *built* Electron app (dist-electron + dist) with a
 * throwaway user-data dir and Chrome's remote-debugging port open, then drive it
 * over the DevTools Protocol (no extra deps — Node's global WebSocket/fetch).
 * For every agent×mode we seed the two persisted Zustand stores in localStorage,
 * reload, let the dashboard fetch its data, and grab a screenshot. ImageMagick
 * stitches the PNGs into assets/abyss-agents.gif.
 *
 * Prereq: a current build on disk (`pnpm build:dir` or `pnpm build`).
 * Usage:   node scripts/shoot-agents.mjs [agentId ...]   (default: claude codex gemini)
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ELECTRON = path.join(ROOT, 'node_modules', '.bin', 'electron')
const OUT = path.join(ROOT, 'assets', 'abyss-agents.gif')
const PORT = 9333

const AGENTS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['claude', 'codex', 'gemini']
const MODES = ['dark', 'light']

// Emulated viewport — fixed so every frame is identical in size. dsf 2 = crisp.
const VW = 1280
const VH = 800
const DSF = 2
const SETTLE_MS = 2600 // let the dashboard's IPC data fetch + render settle
const DELAY_CS = 150 // GIF hold per frame (1/100 s)
const GIF_WIDTH = 1120 // downscale target

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Minimal CDP client over the page target's WebSocket. */
class Cdp {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.waiters = []
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id != null && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)
      } else if (msg.method) {
        this.waiters = this.waiters.filter((w) => {
          if (w.method === msg.method) {
            w.resolve(msg.params)
            return false
          }
          return true
        })
      }
    })
  }

  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  once(method, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const w = { method, resolve }
      this.waiters.push(w)
      setTimeout(() => {
        this.waiters = this.waiters.filter((x) => x !== w)
        reject(new Error(`timeout waiting for ${method}`))
      }, timeout)
    })
  }
}

async function waitForTarget() {
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const targets = await res.json()
      const page = targets.find(
        (t) => t.type === 'page' && t.webSocketDebuggerUrl,
      )
      if (page) return page.webSocketDebuggerUrl
    } catch {
      /* not up yet */
    }
    await sleep(250)
  }
  throw new Error('Electron remote-debugging endpoint never came up')
}

function seedState(agentId, mode) {
  const agent = JSON.stringify({ state: { activeAgentId: agentId }, version: 0 })
  const theme = JSON.stringify({
    state: {
      appearance: mode,
      agentThemeMap: {},
      customThemes: [],
      hiddenThemes: [],
    },
    version: 0,
  })
  return `
    localStorage.setItem('abyss-active-agent', ${JSON.stringify(agent)});
    localStorage.setItem('abyss-themes', ${JSON.stringify(theme)});
    true;
  `
}

async function main() {
  // Throwaway profile so we don't collide with the user's running instance
  // (single-instance lock is per user-data dir) or touch their settings. Seed
  // the onboarding/tour flags so no dialog covers the dashboard.
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'abyss-shots-'))
  writeFileSync(
    path.join(userDataDir, 'abyss-settings.json'),
    JSON.stringify({
      onboarded: true,
      tutorialDone: true,
      sandboxAcknowledged: true,
    }),
  )
  const shotsDir = mkdtempSync(path.join(tmpdir(), 'abyss-frames-'))

  // The host (VSCode/Electron) exports ELECTRON_RUN_AS_NODE=1, which would make
  // our electron binary run as plain Node (require('electron') → a string, no
  // app API). Strip it so it boots as a real GUI app.
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_NO_ATTACH_CONSOLE

  const child = spawn(
    ELECTRON,
    [
      ROOT,
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${userDataDir}`,
    ],
    { cwd: ROOT, env, stdio: ['ignore', 'inherit', 'inherit'] },
  )

  let ws
  try {
    const wsUrl = await waitForTarget()
    ws = new WebSocket(wsUrl)
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true })
      ws.addEventListener('error', rej, { once: true })
    })
    const cdp = new Cdp(ws)
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')

    const frames = []
    let n = 0
    for (const agentId of AGENTS) {
      for (const mode of MODES) {
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: VW,
          height: VH,
          deviceScaleFactor: DSF,
          mobile: false,
        })
        await cdp.send('Runtime.evaluate', {
          expression: seedState(agentId, mode),
        })
        const loaded = cdp.once('Page.loadEventFired')
        await cdp.send('Page.reload', { ignoreCache: false })
        await loaded
        await sleep(SETTLE_MS)
        const { data } = await cdp.send('Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: false,
        })
        const file = path.join(shotsDir, `${String(n).padStart(2, '0')}-${agentId}-${mode}.png`)
        writeFileSync(file, Buffer.from(data, 'base64'))
        frames.push(file)
        console.log(`captured ${agentId} · ${mode}`)
        n++
      }
    }

    mkdirSync(path.dirname(OUT), { recursive: true })
    await runMagick(frames)
    console.log('\nwrote', OUT)
  } finally {
    try {
      ws?.close()
    } catch {
      /* ignore */
    }
    child.kill('SIGTERM')
    rmSync(userDataDir, { recursive: true, force: true })
    rmSync(shotsDir, { recursive: true, force: true })
  }
}

function runMagick(frames) {
  return new Promise((resolve, reject) => {
    const args = [
      '-delay',
      String(DELAY_CS),
      '-loop',
      '0',
      ...frames,
      '-resize',
      String(GIF_WIDTH),
      '-colors',
      '256',
      '-layers',
      'optimize',
      OUT,
    ]
    const p = spawn('magick', args, { stdio: ['ignore', 'inherit', 'inherit'] })
    p.on('error', reject)
    p.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`magick exited ${code}`)),
    )
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

import path from 'node:path'
import { existsSync } from 'node:fs'
import { app, BrowserWindow, session } from 'electron'
import { resolveOsEnv } from '@core/os-env'
import { SettingsStore } from '@core/settings-store'
import { disposeAllChats } from '@core/chat/session-manager'
import { configureSnapshots } from '@core/snapshots'
import { allowedRoots } from '@core/path-scope'
import { configureProfiles } from '@core/profiles'
import { runDailyBackup, defaultBackupDir } from '@core/backup'
import type { IpcContext } from './ipc/context'
import { registerIpcHandlers } from './ipc'
import { createEmitter } from './ipc/emit'
import { setupAutoUpdater } from './updater'
import { configureWatcher, unwatchAll } from './fs-watcher'
import { installCrashHandlers, logError } from './log'

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const isDev = Boolean(DEV_SERVER_URL)

// Built file layout:
//   dist-electron/main.js      (this file)
//   dist-electron/preload.js
//   dist/index.html            (renderer)
const PRELOAD = path.join(__dirname, 'preload.js')
const RENDERER_HTML = path.join(__dirname, '../dist/index.html')
// Window/taskbar icon in dev; packaged builds embed the icon via electron-builder.
const DEV_ICON = path.join(__dirname, '../resources/icon.png')

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    fullscreen: true,
    show: false,
    backgroundColor: '#0c0e14',
    autoHideMenuBar: true,
    icon: existsSync(DEV_ICON) ? DEV_ICON : undefined,
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      // OS-level sandbox for the renderer — the second line of defense behind a
      // Chromium 0-day or XSS chain. The preload only touches contextBridge +
      // ipcRenderer (no Node), so it stays valid under the sandbox.
      sandbox: true,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  hardenNavigation(mainWindow.webContents)

  if (DEV_SERVER_URL) {
    void mainWindow.loadURL(DEV_SERVER_URL)
  } else {
    void mainWindow.loadFile(RENDERER_HTML)
  }
}

/**
 * Defense-in-depth: the renderer should only ever live at its own origin. Deny
 * all `window.open` / target=_blank popups, and block any navigation away from
 * the dev server (dev) or the bundled `file://` renderer (prod). External links
 * are opened deliberately through the OpenExternal IPC channel, not in-window.
 */
function hardenNavigation(contents: Electron.WebContents): void {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  contents.on('will-navigate', (event, url) => {
    const allowed = isDev
      ? Boolean(DEV_SERVER_URL) && url.startsWith(DEV_SERVER_URL as string)
      : url.startsWith('file://')
    if (!allowed) {
      event.preventDefault()
      logError(`Blocked navigation to ${url}`)
    }
  })
}

/** Lock down the renderer in production (dev needs Vite's relaxed defaults). */
function applySecurityPolicies(): void {
  if (isDev) return
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          [
            "default-src 'self'",
            "script-src 'self'",
            // CodeMirror + Tailwind inject inline styles.
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data:",
            "font-src 'self' data:",
            "connect-src 'self'",
            // Defense-in-depth: no plugins, no <base> hijack, no framing, no
            // form posts off-origin.
            "object-src 'none'",
            "base-uri 'self'",
            "frame-ancestors 'none'",
            "form-action 'none'",
          ].join('; '),
        ],
      },
    })
  })
}

function buildIpcContext() {
  const env = resolveOsEnv({
    home: app.getPath('home'),
    appData: app.getPath('appData'),
  })
  const userData = app.getPath('userData')
  const settings = new SettingsStore(path.join(userData, 'abyss-settings.json'))
  // Snapshot config writes; never snapshot Abyss's own data dir (avoids recursion).
  // `allowedRoots` re-confines restore writes to Abyss's directories.
  configureSnapshots({
    root: path.join(userData, 'snapshots'),
    exclude: [userData],
    allowedRoots: allowedRoots(env, userData),
  })
  configureProfiles(path.join(userData, 'profiles'))
  const getWindow = () => mainWindow
  const emit = createEmitter(getWindow)
  configureWatcher(emit)
  return { env, settings, userData, getWindow, emit }
}

/** Daily auto-backup: runs once per day on first launch, honouring settings. */
async function maybeRunDailyBackup(ctx: IpcContext): Promise<void> {
  try {
    const settings = await ctx.settings.read()
    if (settings.autoBackup === false) return
    const dir = settings.backupDir || defaultBackupDir(ctx.userData)
    await runDailyBackup(ctx.env, dir, settings.backupKeep ?? 3)
  } catch {
    // Backups are best-effort; never block startup on a failure.
  }
}

// Single-instance: focus the existing window instead of opening a second app.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  void app.whenReady().then(() => {
    installCrashHandlers()
    applySecurityPolicies()
    const ctx = buildIpcContext()
    registerIpcHandlers(ctx)
    createWindow()
    setupAutoUpdater(ctx.emit, isDev)
    void maybeRunDailyBackup(ctx)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  // Kill any live chat processes and run ephemeral logouts before quitting.
  app.on('before-quit', () => {
    void disposeAllChats()
    unwatchAll()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}

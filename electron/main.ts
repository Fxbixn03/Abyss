import path from 'node:path'
import { existsSync } from 'node:fs'
import { app, BrowserWindow, session } from 'electron'
import { resolveOsEnv } from '@core/os-env'
import { SettingsStore } from '@core/settings-store'
import { disposeAllChats } from '@core/chat/session-manager'
import { registerIpcHandlers } from './ipc'
import { createEmitter } from './ipc/emit'

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
    show: false,
    backgroundColor: '#0c0e14',
    autoHideMenuBar: true,
    icon: existsSync(DEV_ICON) ? DEV_ICON : undefined,
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (DEV_SERVER_URL) {
    void mainWindow.loadURL(DEV_SERVER_URL)
  } else {
    void mainWindow.loadFile(RENDERER_HTML)
  }
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
  const settings = new SettingsStore(
    path.join(app.getPath('userData'), 'abyss-settings.json'),
  )
  const getWindow = () => mainWindow
  return { env, settings, getWindow, emit: createEmitter(getWindow) }
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
    applySecurityPolicies()
    registerIpcHandlers(buildIpcContext())
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  // Kill any live chat processes and run ephemeral logouts before quitting.
  app.on('before-quit', () => {
    void disposeAllChats()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}

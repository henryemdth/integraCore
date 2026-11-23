import { app, BrowserWindow, ipcMain } from "electron"
import path from "path"
import fs from "fs"
import http from "http"
import https from "https"
import { ensureConfigFile, readJsonConfig } from "./config.js"
import { createFileLogger, enforceAppLicense, getConfigPath, getFrontendPath, getIconPath } from "./common.js"

let mainWindow: BrowserWindow | null = null
// Activation key from config.json (set by loadServerUrl).
let licenseKey = ""

// Documented defaults written to config.json on first run. The `serverUrl`
// key is kept for backward compatibility with already-installed clients.
const DEFAULT_CLIENT_CONFIG = {
  _comments: [
    "integraCore Client runtime configuration. Restart the app after editing",
    "for changes to apply (the in-app Settings screen edits this same file).",
    "serverUrl: address of the machine running integraCore Server,",
    "e.g. \"http://192.168.1.50:3001\".",
    "LICENSE_KEY: activation key provided by the vendor (required to run;",
    "the app shows this machine's ID when it is missing or invalid).",
  ],
  serverUrl: "http://localhost:3001",
  LICENSE_KEY: "",
}

const logger = createFileLogger("client-main.log")
const log = logger.log

function loadServerUrl(): string {
  const configPath = getConfigPath()
  if (ensureConfigFile(configPath, DEFAULT_CLIENT_CONFIG)) {
    log(`[client] Created default config at ${configPath}`)
  }
  const { values, error } = readJsonConfig(configPath)
  if (error) log(`[client] ${error} — using the default server URL`)
  // Activation key from config.json — Electron-side only, never sent anywhere.
  licenseKey = values?.LICENSE_KEY || ""
  return values?.serverUrl || "http://localhost:3001"
}

function normalizeHttpUrl(raw: string): URL | null {
  let formatted = raw.trim()
  if (!formatted) return null
  if (!formatted.startsWith("http://") && !formatted.startsWith("https://")) {
    formatted = `http://${formatted}`
  }
  try {
    const parsed = new URL(formatted)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
    return parsed
  } catch {
    return null
  }
}

function saveServerUrl(url: string): boolean {
  const parsed = normalizeHttpUrl(url)
  if (!parsed) return false
  const clean = parsed.origin
  try {
    const configPath = getConfigPath()
    ensureConfigFile(configPath, DEFAULT_CLIENT_CONFIG)
    const { values } = readJsonConfig(configPath)
    // Preserve the documentation block and any extra keys the admin added.
    const next = { ...DEFAULT_CLIENT_CONFIG, ...(values ?? {}), serverUrl: clean }
    fs.writeFileSync(configPath, JSON.stringify(next, null, 2))
    return true
  } catch (err) {
    log(`[client] Failed to save config: ${err instanceof Error ? err.message : err}`)
    return false
  }
}

function testConnection(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const parsed = normalizeHttpUrl(url)
    if (!parsed) {
      resolve(false)
      return
    }
    const client = parsed.protocol === "https:" ? https : http
    const healthUrl = new URL("/api/health", parsed.origin)

    const req = client.get(healthUrl, (res) => {
      resolve(res.statusCode === 200)
      res.resume()
    })

    req.on("error", () => resolve(false))
    req.setTimeout(4000, () => {
      req.destroy()
      resolve(false)
    })
    req.end()
  })
}

function setupIpc(): void {
  ipcMain.handle("get-backend-url", () => {
    return loadServerUrl()
  })

  ipcMain.handle("set-backend-url", (_event, url: string) => {
    return saveServerUrl(url)
  })

  ipcMain.handle("test-connection", async (_event, url: string) => {
    return testConnection(url)
  })
}

async function createWindow(): Promise<void> {
  const preloadPath = app.isPackaged
    ? path.join(app.getAppPath(), "dist", "preload.js")
    : path.join(__dirname, "..", "preload.js")

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "integraCore Client",
    icon: getIconPath(__dirname),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      additionalArguments: ["--platform=client"],
    },
  })

  mainWindow.on("closed", () => {
    mainWindow = null
  })

  const frontendPath = getFrontendPath(__dirname)
  log(`[client] Loading frontend from: ${frontendPath}`)
  if (app.isPackaged) {
    await mainWindow.loadFile(frontendPath)
  } else {
    await mainWindow.loadURL(process.env.DEV_FRONTEND_URL || "http://localhost:5173")
  }
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  // Must be set before the window exists so Windows groups the taskbar button
  // under this id (matching the electron-builder appId) instead of generic Electron.
  app.setAppUserModelId("com.integracore.client")

  app.whenReady().then(async () => {
    logger.init()
    setupIpc()
    log(`[client] Config: ${getConfigPath()} (server URL: ${loadServerUrl()})`)

    // License gate: a packaged install requires a valid LICENSE_KEY in
    // config.json — without one the app shows a dialog and quits before the
    // UI exists. Dev runs skip it; force with INTEGRA_FORCE_LICENSE_GATE=1.
    if (app.isPackaged || process.env.INTEGRA_FORCE_LICENSE_GATE === "1") {
      if (!enforceAppLicense("integraCore Client", licenseKey, log)) {
        app.quit()
        return
      }
    }

    await createWindow()
  })

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit()
    }
  })
}

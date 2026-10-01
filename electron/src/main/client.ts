import { app, BrowserWindow, dialog, ipcMain } from "electron"
import path from "path"
import fs from "fs"
import http from "http"
import { CONFIG_FILENAME, ensureConfigFile, readJsonConfig } from "./config.js"
import { getMachineId, verifyLicenseKey, type LicenseReason } from "./license.js"

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

// ---- file logging ---------------------------------------------------------
// Packaged Windows apps have no visible console: append to
// userData/logs/client-main.log so connection problems are diagnosable.

let logFile: string | null = null

function initLogging(): void {
  try {
    const logsDir = path.join(app.getPath("userData"), "logs")
    fs.mkdirSync(logsDir, { recursive: true })
    logFile = path.join(logsDir, "client-main.log")
    // Keep one rotated copy when the log grows past 1 MB.
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > 1024 * 1024) {
      fs.renameSync(logFile, logFile.replace(/\.log$/, ".old.log"))
    }
  } catch {
    logFile = null // logging is best-effort; never block startup on it
  }
}

function log(line: string): void {
  console.log(line)
  if (!logFile) return
  try {
    fs.appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`)
  } catch { /* best-effort */ }
}

function getResourcesPath(): string {
  if (app.isPackaged) {
    return process.resourcesPath
  }
  return path.resolve(__dirname, "..", "..", "..")
}

function getConfigPath(): string {
  return path.join(app.getPath("userData"), CONFIG_FILENAME)
}

function getFrontendPath(): string {
  return path.join(getResourcesPath(), "frontend", "dist", "index.html")
}

function getIconPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "icon.png")
  }
  return path.resolve(__dirname, "..", "..", "build", "icon.png")
}

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

// ---- license gate ----------------------------------------------------------
// A packaged install runs only with a valid LICENSE_KEY in config.json. On
// failure: one native dialog (reason + this machine's ID + where the key
// goes) and quit — no window.

const LICENSE_REASON_TEXT: Record<LicenseReason, string> = {
  MISSING: "Falta la clave de activación (LICENSE_KEY).",
  MALFORMED: "La clave de activación no es válida.",
  BAD_SIGNATURE: "La clave de activación no es válida (firma incorrecta o clave de otro cliente).",
  WRONG_MACHINE: "Esta clave pertenece a otra computadora.",
  EXPIRED: "La licencia ha expirado. Solicite una renovación a su proveedor.",
}

function enforceLicense(): boolean {
  const machineId = getMachineId()
  const result = verifyLicenseKey(licenseKey, machineId)
  if (result.ok) {
    log(`[license] Activated: ${result.payload.customer} (${result.payload.type})`)
    return true
  }
  log(`[license] Locked (${result.reason})${result.detail ? `: ${result.detail}` : ""}`)
  const detail = result.reason === "EXPIRED" && result.detail ? `\n${result.detail}` : ""
  dialog.showErrorBox(
    "integraCore Client — Activación requerida",
    `${LICENSE_REASON_TEXT[result.reason]}${detail}\n\n` +
      `ID de esta máquina (envíelo a su proveedor):\n${machineId}\n\n` +
      `Coloque su clave en el archivo:\n${getConfigPath()}\n` +
      `con:  "LICENSE_KEY": "<clave proporcionada por su proveedor>"\n` +
      `y reinicie la aplicación.`
  )
  return false
}

function saveServerUrl(url: string): void {
  try {
    const configPath = getConfigPath()
    ensureConfigFile(configPath, DEFAULT_CLIENT_CONFIG)
    const { values } = readJsonConfig(configPath)
    // Preserve the documentation block and any extra keys the admin added.
    const next = { ...DEFAULT_CLIENT_CONFIG, ...(values ?? {}), serverUrl: url }
    fs.writeFileSync(configPath, JSON.stringify(next, null, 2))
  } catch (err) {
    log(`[client] Failed to save config: ${err instanceof Error ? err.message : err}`)
  }
}

function testConnection(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    let formattedUrl = url.trim()
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `http://${formattedUrl}`
    }

    const req = http.get(`${formattedUrl}/api/health`, (res) => {
      resolve(res.statusCode === 200)
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
    saveServerUrl(url)
    return true
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
    icon: getIconPath(),
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

  const frontendPath = getFrontendPath()
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
    initLogging()
    setupIpc()
    log(`[client] Config: ${getConfigPath()} (server URL: ${loadServerUrl()})`)

    // License gate: a packaged install requires a valid LICENSE_KEY in
    // config.json — without one the app shows a dialog and quits before the
    // UI exists. Dev runs skip it; force with INTEGRA_FORCE_LICENSE_GATE=1.
    if (app.isPackaged || process.env.INTEGRA_FORCE_LICENSE_GATE === "1") {
      if (!enforceLicense()) {
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

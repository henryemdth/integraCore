import { app, BrowserWindow, ipcMain } from "electron"
import path from "path"
import fs from "fs"
import http from "http"

let mainWindow: BrowserWindow | null = null

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
  return path.join(app.getPath("userData"), "config.json")
}

function getFrontendPath(): string {
  return path.join(getResourcesPath(), "frontend", "dist", "index.html")
}

function loadConfig(): { serverUrl?: string } {
  try {
    const p = getConfigPath()
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf-8"))
    }
  } catch { /* ignore */ }
  return {}
}

function saveConfig(config: { serverUrl?: string }): void {
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2))
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
    const config = loadConfig()
    return config.serverUrl || "http://localhost:3001"
  })

  ipcMain.handle("set-backend-url", (_event, url: string) => {
    saveConfig({ serverUrl: url })
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

  app.whenReady().then(async () => {
    initLogging()
    setupIpc()
    await createWindow()
  })

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit()
    }
  })
}

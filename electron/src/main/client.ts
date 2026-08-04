import { app, BrowserWindow, ipcMain } from "electron"
import path from "path"
import fs from "fs"
import http from "http"

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
    console.error("[client] Failed to save config:", err)
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

  const win = new BrowserWindow({
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

  const frontendPath = getFrontendPath()
  console.log(`[client] Cargando frontend desde: ${frontendPath}`)
  if (app.isPackaged) {
    win.loadFile(frontendPath)
  } else {
    win.loadURL(process.env.DEV_FRONTEND_URL || "http://localhost:5173")
  }
}

app.whenReady().then(async () => {
  setupIpc()
  await createWindow()
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})
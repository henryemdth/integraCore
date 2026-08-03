import { app, BrowserWindow, ipcMain, dialog } from "electron"
import path from "path"
import fs from "fs"
import http from "http"

function getConfigPath(): string {
  return path.join(app.getPath("userData"), "config.json")
}

function getFrontendPath(): string {
  const resourcesPath = process.resourcesPath || path.join(__dirname, "..", "..", "..")
  return path.join(resourcesPath, "frontend", "dist", "index.html")
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
    const req = http.get(`${url}/api/health`, (res) => {
      resolve(res.statusCode === 200)
    })
    req.on("error", () => resolve(false))
    req.setTimeout(5000, () => {
      req.destroy()
      resolve(false)
    })
    req.end()
  })
}

async function showConnectionDialog(): Promise<string | null> {
  const config = loadConfig()
  const defaultUrl = config.serverUrl || "http://"

  const { response } = await dialog.showMessageBox({
    type: "question",
    buttons: ["Connect", "Cancel"],
    title: "integraCore Client",
    message: "Connect to Server",
    detail: `Enter the server machine's IP address and port.\nExample: http://192.168.1.100:3001`,
    checkboxLabel: "Remember this address",
    checkboxChecked: true,
  })

  if (response === 0) {
    return defaultUrl
  }
  return null
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
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "integraCore Client",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "..", "preload.js"),
      additionalArguments: [],
    },
  })

  const frontendPath = getFrontendPath()
  win.loadFile(frontendPath)
}

app.whenReady().then(async () => {
  setupIpc()

  const config = loadConfig()
  if (!config.serverUrl) {
    const url = await showConnectionDialog()
    if (url) {
      const connected = await testConnection(url)
      if (connected) {
        const { checkboxChecked } = await dialog.showMessageBox({
          type: "info",
          title: "Connected",
          message: "Successfully connected to server.",
          checkboxLabel: "Remember this address",
          checkboxChecked: true,
        })
        if (checkboxChecked) {
          saveConfig({ serverUrl: url })
        }
      }
    } else {
      app.quit()
      return
    }
  }

  createWindow()
})

app.on("window-all-closed", () => {
  app.quit()
})

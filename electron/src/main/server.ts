import { app, BrowserWindow } from "electron"
import path from "path"
import { fork, ChildProcess } from "child_process"

let backendProcess: ChildProcess | null = null

function getResourcesPath(): string {
  return process.resourcesPath || path.join(__dirname, "..", "..", "..")
}

function getFrontendPath(): string {
  return path.join(getResourcesPath(), "frontend", "dist", "index.html")
}

function getBackendEntry(): string {
  return path.join(getResourcesPath(), "backend", "dist", "index.js")
}

function getDataDir(): string {
  return path.join(app.getPath("userData"), "data")
}

async function startBackend(): Promise<void> {
  const entry = getBackendEntry()
  const dataDir = getDataDir()

  return new Promise((resolve, reject) => {
    backendProcess = fork(entry, [], {
      env: {
        ...process.env,
        PORT: "3001",
        DATA_DIR: dataDir,
        DB_DRIVER: "sqlite",
        JWT_SECRET: process.env.JWT_SECRET || "integracore-server-secret",
        CORS_ORIGIN: "http://localhost:3001",
        NODE_ENV: "production",
      },
      stdio: ["pipe", "pipe", "pipe", "ipc"],
    })

    backendProcess.stdout?.on("data", (data: Buffer) => {
      console.log(`[backend] ${data.toString().trim()}`)
    })

    backendProcess.stderr?.on("data", (data: Buffer) => {
      console.error(`[backend] ${data.toString().trim()}`)
    })

    backendProcess.on("error", (err) => {
      console.error("[backend] Failed to start:", err)
      reject(err)
    })

    backendProcess.on("exit", (code) => {
      console.log(`[backend] Exited with code ${code}`)
      backendProcess = null
    })

    const maxRetries = 30
    let retries = 0

    const poll = async () => {
      try {
        const http = await import("http")
        const req = http.get("http://localhost:3001/api/health", (res) => {
          if (res.statusCode === 200) {
            resolve()
          } else {
            retry()
          }
        })
        req.on("error", () => retry())
        req.end()
      } catch {
        retry()
      }
    }

    const retry = () => {
      retries++
      if (retries >= maxRetries) {
        reject(new Error("Backend failed to start within timeout"))
        return
      }
      setTimeout(poll, 500)
    }

    setTimeout(poll, 1000)
  })
}

function stopBackend(): void {
  if (backendProcess) {
    backendProcess.kill("SIGTERM")
    setTimeout(() => {
      if (backendProcess && !backendProcess.killed) {
        backendProcess.kill("SIGKILL")
      }
    }, 5000)
  }
}

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "integraCore Server",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "..", "preload.js"),
      additionalArguments: ["--platform=server"],
    },
  })

  const frontendPath = getFrontendPath()
  win.loadFile(frontendPath)
}

app.whenReady().then(async () => {
  try {
    await startBackend()
    console.log("[server] Backend is ready")
  } catch (err) {
    console.error("[server] Failed to start backend:", err)
  }

  createWindow()
})

app.on("window-all-closed", () => {
  stopBackend()
  app.quit()
})

app.on("before-quit", () => {
  stopBackend()
})

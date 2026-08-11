import { app, BrowserWindow } from "electron"
import path from "path"
import { fork, ChildProcess } from "child_process"

let backendProcess: ChildProcess | null = null
let stopping = false
let restartAttempts = 0

function getResourcesPath(): string {
  if (app.isPackaged) {
    return process.resourcesPath
  }
  return path.resolve(__dirname, "..", "..", "..")
}

function getFrontendPath(): string {
  return path.join(getResourcesPath(), "frontend", "dist", "index.html")
}

function getFrontendUrl(): string {
  return process.env.DEV_FRONTEND_URL || "http://localhost:5173"
}

function getBackendEntry(): string {
  return path.join(getResourcesPath(), "backend", "dist", "index.cjs")
}

function getDataDir(): string {
  return path.join(app.getPath("userData"), "data")
}

async function startBackend(): Promise<void> {
  const entry = getBackendEntry()
  const dataDir = getDataDir()

  const backendEnv: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: "3001",
    DATA_DIR: dataDir,
    DB_DRIVER: "sqlite",
    // "*" lets the packaged frontend (loaded from file://, Origin "null")
    // reach its own local backend. Tighten via env for cloud/Postgres.
    CORS_ORIGIN: "*",
    NODE_ENV: "production",
  }
  // When set, honor an explicit JWT_SECRET; otherwise the backend generates
  // and persists a per-install secret under DATA_DIR/.jwt-secret. Never pass a
  // shared hardcoded fallback.
  if (process.env.JWT_SECRET) backendEnv.JWT_SECRET = process.env.JWT_SECRET

  return new Promise((resolve, reject) => {
    backendProcess = fork(entry, [], {
      env: backendEnv,
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
      backendProcess = null
      reject(err)
    })

    backendProcess.on("exit", (code) => {
      console.log(`[backend] Exited with code ${code}`)
      backendProcess = null
      // A failed backend (e.g. a DB operation gone wrong mid-restore) must not
      // leave the app dead-silent: restart it with backoff.
      if (!stopping) scheduleBackendRestart()
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

function scheduleBackendRestart(): void {
  const delay = Math.min(1000 * Math.pow(2, restartAttempts), 30000)
  restartAttempts++
  console.log(`[server] Restarting backend in ${delay}ms (attempt ${restartAttempts})`)
  setTimeout(async () => {
    if (stopping) return
    try {
      await startBackend()
      restartAttempts = 0
      console.log("[server] Backend restarted and ready")
    } catch (err) {
      console.error("[server] Backend restart failed, will retry:", err)
    }
  }, delay)
}

function stopBackend(): void {
  stopping = true
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

  if (app.isPackaged) {
    const frontendPath = getFrontendPath()
    win.loadFile(frontendPath)
  } else {
    win.loadURL(getFrontendUrl())
  }
}

app.whenReady().then(async () => {
  if (app.isPackaged) {
    startBackend()
      .then(() => {
        restartAttempts = 0
        console.log("[server] Backend is ready")
      })
      .catch((err) => {
        console.error("[server] Failed to start backend:", err)
        scheduleBackendRestart()
      })
  } else {
    console.log("[server] Dev mode: using external backend on http://localhost:3001")
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

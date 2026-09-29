import { contextBridge, ipcRenderer } from "electron"

const isServer = process.argv.includes("--platform=server")

/** Reads `--flag=value` style arguments passed via additionalArguments. */
function argvValue(flag: string): string | undefined {
  const prefix = `${flag}=`
  const arg = process.argv.find((a) => a.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : undefined
}

if (isServer) {
  contextBridge.exposeInMainWorld("electronAPI", {
    platform: "server",
    // The Server main passes the configured port (config.json PORT) so the
    // bundled frontend always talks to the backend it actually forked.
    backendUrl: argvValue("--backend-url") ?? "http://localhost:3001",
  })
} else {
  contextBridge.exposeInMainWorld("electronAPI", {
    platform: "client",
    getBackendUrl: () => ipcRenderer.invoke("get-backend-url"),
    setBackendUrl: (url: string) => ipcRenderer.invoke("set-backend-url", url),
    testConnection: (url: string) => ipcRenderer.invoke("test-connection", url),
  })
}

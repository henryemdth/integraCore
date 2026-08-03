import { contextBridge, ipcRenderer } from "electron"

const isServer = process.argv.includes("--platform=server")

if (isServer) {
  contextBridge.exposeInMainWorld("electronAPI", {
    platform: "server",
    backendUrl: "http://localhost:3001",
  })
} else {
  contextBridge.exposeInMainWorld("electronAPI", {
    platform: "client",
    getBackendUrl: () => ipcRenderer.invoke("get-backend-url"),
    setBackendUrl: (url: string) => ipcRenderer.invoke("set-backend-url", url),
    testConnection: (url: string) => ipcRenderer.invoke("test-connection", url),
  })
}

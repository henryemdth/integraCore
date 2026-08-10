import React, { Suspense } from "react"
import ReactDOM from "react-dom/client"
import { HashRouter, BrowserRouter } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"
import { queryClient } from "./lib/queryClient"
import { setBackendUrl } from "./lib/api"
import { isElectron } from "./lib/platform"
import App from "./App"
import "./i18n"
import "./index.css"

// Electron loads the bundle over file:// where the History API fails on
// reload/deep-links, so it keeps hash routing. Web/cloud deployments get
// clean URLs via BrowserRouter (backed by an SPA rewrite on the host).
const Router = isElectron ? HashRouter : BrowserRouter

async function resolveBackendUrl(): Promise<void> {
  const electron = window.electronAPI
  if (electron?.getBackendUrl) {
    try {
      const url = await electron.getBackendUrl()
      if (url) setBackendUrl(url)
    } catch {
      // Fall back to the cached/default URL.
    }
  }
}

resolveBackendUrl().then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando...</div>}>
        <QueryClientProvider client={queryClient}>
          <Router>
            <App />
          </Router>
          <Toaster position="top-right" richColors closeButton />
        </QueryClientProvider>
      </Suspense>
    </React.StrictMode>
  )
})

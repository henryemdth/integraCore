import axios from "axios"
import { goToLogin } from "./navigation"

declare global {
  interface Window {
    electronAPI?: {
      platform: "server" | "client"
      backendUrl?: string
      getBackendUrl?: () => Promise<string>
      setBackendUrl?: (url: string) => Promise<boolean>
      testConnection?: (url: string) => Promise<boolean>
    }
  }
}

const BACKEND_URL_CACHE_KEY = "backend_url"

function getInitialBackendUrl(): string {
  const electron = window.electronAPI

  if (electron?.backendUrl) return electron.backendUrl

  const cached = localStorage.getItem(BACKEND_URL_CACHE_KEY)
  if (cached) return cached
  const envUrl = import.meta.env.VITE_BACKEND_URL
  if (envUrl) return envUrl
  return "http://localhost:3001"
}

let backendUrl = getInitialBackendUrl()

const listeners = new Set<(url: string) => void>()

export function getBackendUrl(): string {
  return backendUrl
}

export function setBackendUrl(url: string): void {
  const normalized = url.trim().replace(/\/+$/, "")
  if (!normalized || normalized === backendUrl) return
  backendUrl = normalized
  localStorage.setItem(BACKEND_URL_CACHE_KEY, normalized)
  listeners.forEach((l) => l(normalized))
}

export function subscribeBackendUrl(cb: (url: string) => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

const api = axios.create({
  baseURL: backendUrl,
})

api.interceptors.request.use((config) => {
  config.baseURL = backendUrl
  const token = localStorage.getItem("token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token")
      goToLogin()
    }
    return Promise.reject(error)
  }
)

export default api

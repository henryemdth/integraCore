import axios from "axios"

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

function getBackendUrl(): string {
  const envUrl = import.meta.env.VITE_BACKEND_URL
  const electron = window.electronAPI
  if (electron?.backendUrl) return electron.backendUrl
  if (envUrl) return envUrl
  return "http://localhost:3001"
}

const BACKEND_URL = getBackendUrl()

const api = axios.create({
  baseURL: BACKEND_URL,
})

api.interceptors.request.use((config) => {
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
      window.location.hash = "/login"
    }
    return Promise.reject(error)
  }
)

export default api
export { getBackendUrl }

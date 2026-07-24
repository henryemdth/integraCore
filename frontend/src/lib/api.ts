import axios from "axios"
import { loadEnv } from "vite"

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001"

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
      window.location.href = "/login"
    }
    return Promise.reject(error)
  }
)

export default api

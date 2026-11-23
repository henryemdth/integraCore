import { createContext, useCallback, useContext, useState, useEffect, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import api, { setUnauthorizedHandler } from "@/lib/api"
import type { User } from "@integracore/shared"

interface AuthContextType {
  user: User | null
  loading: boolean
  isAdmin: boolean
  login: (username: string, password: string) => Promise<void>
  setup: (username: string, password: string, fullName: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()

  // Stable identity so effects that react to session loss (e.g. the socket
  // provider's auth-failure handler and the axios 401 interceptor) don't
  // re-run on every provider render.
  const logout = useCallback(() => {
    localStorage.removeItem("token")
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem("token")
    if (!token) return
    try {
      const res = await api.get("/api/auth/me")
      setUser(res.data.user)
    } catch {
      logout()
    }
  }, [logout])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(null)
  }, [logout])

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      setLoading(false)
      return
    }
    api
      .get("/api/auth/me")
      .then((res) => setUser(res.data.user))
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false))
  }, [])

  const login = async (username: string, password: string) => {
    queryClient.clear()
    const res = await api.post("/api/auth/login", { username, password })
    localStorage.setItem("token", res.data.token)
    setUser(res.data.user)
  }

  const setup = async (username: string, password: string, fullName: string) => {
    queryClient.clear()
    const res = await api.post("/api/auth/setup", {
      username,
      password,
      full_name: fullName,
    })
    localStorage.setItem("token", res.data.token)
    setUser(res.data.user)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin: user?.role === "admin",
        login,
        setup,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

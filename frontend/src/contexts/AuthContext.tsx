import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { User } from "@integracore/shared"

interface AuthContextType {
  user: User | null
  loading: boolean
  isAdmin: boolean
  login: (username: string, password: string) => Promise<void>
  setup: (username: string, password: string, fullName: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()

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
    console.log(username, password, ' Frontend - HTTP')
    console.log(api.options, ' Frontend - HTTP')
    const res = await api.post("/api/auth/login", { username, password })

    localStorage.setItem("token", res.data.token)
    setUser(res.data.user)
  }

  const setup = async (username: string, password: string, fullName: string) => {
    const res = await api.post("/api/auth/setup", {
      username,
      password,
      full_name: fullName,
    })
    localStorage.setItem("token", res.data.token)
    setUser(res.data.user)
  }

  const logout = () => {
    localStorage.removeItem("token")
    setUser(null)
    queryClient.clear()
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

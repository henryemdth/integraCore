import { useEffect, useState, type ReactNode } from "react"
import { io } from "socket.io-client"
import { useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/contexts/AuthContext"
import { getBackendUrl, subscribeBackendUrl } from "@/lib/api"

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const queryClient = useQueryClient()
  const [backendUrl, setBackendUrl] = useState(getBackendUrl())

  useEffect(() => {
    return subscribeBackendUrl(setBackendUrl)
  }, [])

  useEffect(() => {
    // Only connect once a user is authenticated; pass the JWT so the server
    // accepts the socket (it rejects unauthenticated handshakes).
    if (!user) return

    const token = localStorage.getItem("token")
    const socket = io(backendUrl, { autoConnect: true, auth: { token } })

    socket.on("product:updated", () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      queryClient.invalidateQueries({ queryKey: ["discounts"] })
    })

    socket.on("notification:new", () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
    })

    socket.on("db:restored", () => {
      queryClient.invalidateQueries()
    })

    // Server rejected the handshake JWT (expired token, deactivated account):
    // the API 401 path only triggers on requests, so end the session here too.
    socket.on("connect_error", (err) => {
      if (err.message === "Not authenticated") {
        logout()
      }
    })

    return () => {
      socket.disconnect()
    }
  }, [user, backendUrl, queryClient, logout])

  return <>{children}</>
}

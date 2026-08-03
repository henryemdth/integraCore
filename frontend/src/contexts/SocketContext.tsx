import { useEffect, type ReactNode } from "react"
import { io, Socket } from "socket.io-client"
import { useQueryClient } from "@tanstack/react-query"
import { getBackendUrl } from "@/lib/api"

let socket: Socket | null = null

function getSocketUrl(): string {
  const electron = window.electronAPI
  if (electron?.backendUrl) {
    return electron.backendUrl
  }
  if (import.meta.env.DEV) {
    return "http://localhost:3001"
  }
  const url = getBackendUrl()
  if (url) return url
  return window.location.origin
}

function getSocket(): Socket {
  if (!socket) {
    socket = io(getSocketUrl(), { autoConnect: true })
  }
  return socket
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const s = getSocket()

    s.on("product:updated", () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      queryClient.invalidateQueries({ queryKey: ["discounts"] })
    })

    s.on("notification:new", () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
    })

    s.on("db:restored", () => {
      queryClient.invalidateQueries()
    })

    return () => {
      s.off("product:updated")
      s.off("notification:new")
      s.off("db:restored")
    }
  }, [queryClient])

  return <>{children}</>
}

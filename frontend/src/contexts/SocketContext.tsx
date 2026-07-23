import { useEffect, type ReactNode } from "react"
import { io, Socket } from "socket.io-client"
import { useQueryClient } from "@tanstack/react-query"

let socket: Socket | null = null

function getSocket(): Socket {
  if (!socket) {
    const url = import.meta.env.DEV ? "http://localhost:3001" : window.location.origin
    socket = io(url, { autoConnect: true })
  }
  return socket
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const s = getSocket()

    s.on("product:updated", () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
    })

    s.on("notification:new", () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
    })

    return () => {
      s.off("product:updated")
      s.off("notification:new")
    }
  }, [queryClient])

  return <>{children}</>
}

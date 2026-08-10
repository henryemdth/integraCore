import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { getAdapter } from "../db/index.js";

let io: Server;

interface JwtPayload {
  id: number;
  username: string;
  role: "admin" | "user";
}

export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: config.corsOrigin,
      methods: ["GET", "POST"],
    },
  });

  // Require a valid, active user JWT before accepting any socket. Prevents
  // unauthenticated LAN peers from connecting and receiving price/stock
  // broadcasts.
  io.use(async (socket, next) => {
    const token = (socket.handshake.auth as { token?: string } | undefined)?.token;
    if (!token) return next(new Error("Not authenticated"));

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
      const db = getAdapter();
      const user = await db.get(
        "SELECT id, username, role, active FROM users WHERE id = ?",
        [decoded.id]
      ) as { id: number; username: string; role: "admin" | "user"; active: number | boolean } | undefined;

      if (!user || !user.active) return next(new Error("Not authenticated"));
      (socket as any).data.user = { id: user.id, username: user.username, role: user.role };
      next();
    } catch {
      next(new Error("Not authenticated"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`[socket] Client connected: ${socket.id}`);
    socket.on("disconnect", () => {
      console.log(`[socket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function emitProductUpdated(product: { id: number; name: string; sku: string; price: number; sell_price: number; stock: number; status: string; discounted_price?: number | null; discount_end_date?: string | null }) {
  if (io) io.emit("product:updated", product);
}

export function emitNotification(notification: { id: number; type: string; message: string }) {
  if (io) io.emit("notification:new", notification);
}

export function emitDbRestored() {
  if (io) io.emit("db:restored", { timestamp: new Date().toISOString() });
}

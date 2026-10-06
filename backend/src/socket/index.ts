import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { getAdapter } from "../db/index.js";
import { fetchUserProjection } from "../services/userProjection.js";
import type { JwtPayload } from "../types/auth.js";
import type { ProductStatus } from "@integracore/shared";

// Per-socket data set by the auth middleware below — typed via module
// augmentation so consumers never need a cast.
declare module "socket.io" {
  interface SocketData {
    user?: { id: number; username: string; role: JwtPayload["role"] };
  }
}

let io: Server;

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
      const user = await fetchUserProjection(db, decoded.id);

      if (!user || !user.active) return next(new Error("Not authenticated"));
      socket.data.user = { id: user.id, username: user.username, role: user.role };
      next();
    } catch {
      next(new Error("Not authenticated"));
    }
  });

  return io;
}

export function emitProductUpdated(product: { id: number; name: string; sku: string; price: number; sell_price: number; stock: number; status: ProductStatus; discounted_price?: number | null; discount_end_date?: string | null }) {
  if (io) io.emit("product:updated", product);
}

export function emitNotification(notification: { id: number; type: string; message: string }) {
  if (io) io.emit("notification:new", notification);
}

export function emitUsersChanged() {
  if (io) io.emit("users:changed");
}

export function emitDbRestored() {
  if (io) io.emit("db:restored", { timestamp: new Date().toISOString() });
}

import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { config } from "../config.js";

let io: Server;

export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: config.corsOrigin,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`[socket] Client connected: ${socket.id}`);
    socket.on("disconnect", () => {
      console.log(`[socket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function emitProductUpdated(product: { id: number; name: string; sku: string; price: number; sell_price: number; stock: number; status: string; discounted_price?: number | null }) {
  if (io) io.emit("product:updated", product);
}

export function emitNotification(notification: { id: number; type: string; message: string }) {
  if (io) io.emit("notification:new", notification);
}

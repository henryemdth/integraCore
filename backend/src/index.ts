import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { initDatabase } from "./db/index.js";
import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import salesRoutes from "./routes/sales.js";
import usersRoutes from "./routes/users.js";

const app = express();
const server = createServer(app);

const PORT = parseInt(process.env.PORT || "3001", 10);

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/users", usersRoutes);

initDatabase();

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[backend] Running on http://0.0.0.0:${PORT}`);
});

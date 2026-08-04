import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";


export default defineConfig(({ mode }) => {

  const env = loadEnv(mode, process.cwd(), "");
  const BACKEND_URL = env.VITE_BACKEND_URL || "http://localhost:3001";
  return {
    
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    base: "./",
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: BACKEND_URL || "http://localhost:3001",
          changeOrigin: true,
        },
        "/socket.io": {
          target: BACKEND_URL ||"http://localhost:3001",
          ws: true,
        },
      },
    },
  }
});

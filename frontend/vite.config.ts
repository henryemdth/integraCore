import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";


export default defineConfig(({ mode }) => {

  const env = loadEnv(mode, process.cwd(), "");
  const BACKEND_URL = env.VITE_BACKEND_URL || "http://localhost:3001";
  // "./" is required for the packaged Electron file:// load. Web/cloud builds
  // set VITE_BASE=/ so absolute asset paths survive BrowserRouter deep links.
  const base = env.VITE_BASE || "./";

  // Strict CSP injected only into the production bundle. Skipped in dev
  // because @vitejs/plugin-react injects an inline react-refresh preamble
  // module that `script-src 'self'` would block.
  const cspPlugin = {
    name: "inject-csp",
    transformIndexHtml() {
      if (mode === "development") return [];
      return [{
        tag: "meta",
        attrs: {
          "http-equiv": "Content-Security-Policy",
          content:
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self' http: ws: https: wss:; object-src 'none'; base-uri 'self'; form-action 'self'",
        },
      }];
    },
  };

  return {
    plugins: [react(), cspPlugin],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    base,
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: BACKEND_URL,
          changeOrigin: true,
        },
        "/socket.io": {
          target: BACKEND_URL,
          ws: true,
        },
      },
    },
  }
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiTarget = process.env.API_TARGET || "http://localhost:5000";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "disable-vite-hmr-client",
      transformIndexHtml: {
        order: "post",
        handler(html) {
          return html.replace('<script type="module" src="/@vite/client"></script>', "");
        }
      }
    }
  ],
  server: {
    hmr: false,
    ws: false,
    proxy: { "/api": { target: apiTarget, changeOrigin: true } }
  }
});

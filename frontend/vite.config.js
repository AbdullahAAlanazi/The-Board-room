import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@tabler/icons-react": "@tabler/icons-react/dist/esm/tabler-icons-react.mjs",
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api":     "http://localhost:8000",
      "/onboard": "http://localhost:8000",
      "/board":   "http://localhost:8000",
      "/health":  "http://localhost:8000",
    },
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/client",
    rollupOptions: {
      output: {
        manualChunks: {
          ui: ["@mui/material", "@emotion/react", "@emotion/styled"],
        },
      },
    },
  },
  server: {
    proxy: { "/api": { target: "http://127.0.0.1:3000", changeOrigin: false } },
  },
});

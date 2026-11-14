import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// Konfigurasi minimal untuk 24 jam: satu entry, satu bahasa, tanpa router
// eksternal. Navigasi cukup dengan state di dalam `src/App.tsx`.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
})

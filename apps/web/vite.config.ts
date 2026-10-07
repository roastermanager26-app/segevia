import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Lee .env.local de la raíz en desarrollo local; en Vercel usa el directorio actual
  envDir: process.env.VERCEL ? "." : "../../",
  server: { port: 5173 },
});

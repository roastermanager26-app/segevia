import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Un único .env.local en la raíz del monorepo. Vite solo expone variables VITE_*.
  envDir: "../../",
  server: { port: 5173 },
});
